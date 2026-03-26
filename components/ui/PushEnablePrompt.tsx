import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Image,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import messaging from '@react-native-firebase/messaging';
import notifee, { AuthorizationStatus } from '@notifee/react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import API_BASE_URL from '../../config/api';

type Props = {
  userId?: string;
};

const STORAGE_KEY = 'push_prompt_state_v2';
const DEFAULT_IMAGE = require('../../assets/images/simulator_screenshot_C5D1855E-F04F-4FD0-8EEA-1741B0D71A6E.png');

export default function PushEnablePrompt({ userId }: Props) {
  const [visible, setVisible] = useState<boolean>(false);
  const [blocked, setBlocked] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewSource, setPreviewSource] = useState<any>(null);

  // Auto-show logic
  useEffect(() => {
    (async () => {
      try {
        if (!userId) return;
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const stored = raw ? JSON.parse(raw) : null;
        const now = Date.now();

        if (stored?.never || stored?.done) return;
        if (stored?.snoozedUntil && now < stored.snoozedUntil) return;

        const settings = await notifee.getNotificationSettings();
        const authorized =
          settings.authorizationStatus === AuthorizationStatus.AUTHORIZED ||
          settings.authorizationStatus === AuthorizationStatus.PROVISIONAL;

        if (authorized) {
          await AsyncStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ ...(stored || {}), done: true, lastSuccess: now })
          );
          return;
        }

        setBlocked(settings.authorizationStatus === AuthorizationStatus.DENIED);
        setVisible(true);
        if (settings.authorizationStatus === AuthorizationStatus.DENIED) {
          await sendConsent('blocked', { authorizationStatus: settings.authorizationStatus });
        }
        await AsyncStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ ...(stored || {}), lastShown: now })
        );
      } catch (error) {
        console.warn('⚠️ [PUSH PROMPT] Failed to show:', error);
      }
    })();
  }, [userId]);

  const registerPushToken = async (token: string) => {
    if (!userId || !token) return;
    try {
      const deviceInfo = {
        deviceName: Device.deviceName || null,
        modelName: Device.modelName || null,
        brand: Device.brand || null,
        manufacturer: Device.manufacturer || null,
        osName: Device.osName || null,
        osVersion: Device.osVersion || null,
        deviceType: Device.deviceType || null,
        appVersion: Constants.expoConfig?.version || null,
        appBuildNumber: Constants.expoConfig?.ios?.buildNumber || Constants.expoConfig?.android?.versionCode || null,
        platform: Platform.OS,
        platformVersion: Platform.Version?.toString() || null,
      };

      await fetch(`${API_BASE_URL}/notifications/register-device`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          token,
          platform: Platform.OS,
          deviceInfo,
        }),
      });
    } catch (error) {
      console.warn('⚠️ [PUSH PROMPT] Failed to register token:', error);
    }
  };

  const sendConsent = async (status: 'granted' | 'denied' | 'never' | 'snoozed' | 'blocked', extra?: Record<string, any>) => {
    if (!userId) return;
    try {
      await fetch(`${API_BASE_URL}/notifications/consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          status,
          platform: Platform.OS,
          ...extra,
        }),
      });
    } catch (error) {
      console.warn('⚠️ [PUSH PROMPT] Failed to send consent:', error);
    }
  };

  const handleEnable = async () => {
    setLoading(true);
    try {
      const permission = await notifee.requestPermission();
      const status = permission.authorizationStatus;
      const granted =
        status === AuthorizationStatus.AUTHORIZED ||
        status === AuthorizationStatus.PROVISIONAL;

      if (!granted) {
        setBlocked(status === AuthorizationStatus.DENIED);
        await AsyncStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ snoozedUntil: Date.now() + 6 * 60 * 60 * 1000, lastAttempt: Date.now() })
        );
        Alert.alert('შეტყობინებები გამორთულია', 'გახსენით Settings > Notifications და დაასრულეთ ჩართვა.');
        await sendConsent('denied', { authorizationStatus: status });
        return;
      }

      await messaging().requestPermission();
      const token = await messaging().getToken();
      if (token) {
        await registerPushToken(token);
      }
      await sendConsent('granted', { authorizationStatus: status });

      setVisible(false);
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ done: true, lastSuccess: Date.now() })
      );
      Alert.alert('შეტყობინებები ჩაირთო', 'ახლა რეალურ დროში მიიღებ გაფრთხილებებს.');
    } catch (error) {
      console.warn('⚠️ [PUSH PROMPT] Enable failed:', error);
      Alert.alert('შეცდომა', 'ვერ ჩავრთეთ, სცადე კიდევ ერთხელ.');
    } finally {
      setLoading(false);
    }
  };

  const handleLater = async () => {
    setVisible(false);
    try {
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ snoozedUntil: Date.now() + 24 * 60 * 60 * 1000 })
      );
      await sendConsent('snoozed');
    } catch {}
  };

  const handleNever = async () => {
    setVisible(false);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ never: true }));
      await sendConsent('never');
    } catch {}
  };

  const handleOpenSettings = async () => {
    try {
      if (Platform.OS === 'android') {
        await notifee.openNotificationSettings();
      } else {
        await notifee.openNotificationSettings();
      }
    } catch (error) {
      console.warn('⚠️ [PUSH PROMPT] open settings failed:', error);
    }
  };

  if (!visible) return null;

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.card}>
            <View style={styles.header}>
              <View style={styles.iconCircle}>
                <Ionicons name="notifications" size={20} color="#111827" />
              </View>
              <TouchableOpacity
                onPress={handleNever}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
            <Text style={styles.title}>ჩართე push გაფრთხილებები</Text>
            <Text style={styles.subtitle}>
              მიიღე ფასდაკლებები შეთავაზებები, ნახე ჯარიმები და მიიღე სიახლეები ყოველდღე.
            </Text>

            <View style={styles.previewRow}>
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.previewImageWrap}
                onPress={() => {
                  setPreviewSource(DEFAULT_IMAGE);
                  setPreviewVisible(true);
                }}
              >
                <Image source={DEFAULT_IMAGE} style={styles.previewImage} />
                <Text style={styles.previewLabel}>მაგალითი</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.previewImageWrap}
                onPress={() => {
                  setPreviewSource(DEFAULT_IMAGE);
                  setPreviewVisible(true);
                }}
              >
                <Image source={DEFAULT_IMAGE} style={styles.previewImage} />
                <Text style={styles.previewLabel}>შეტყობინებები</Text>
              </TouchableOpacity>
            </View>

           

            <View style={styles.instructions}>
              <Text style={styles.instructionsTitle}>როგორ ჩართო:</Text>
              <Text style={styles.instructionsText}>1) დააჭირე „გააქტიურე“.</Text>
              <Text style={styles.instructionsText}>2) სისტემურ ფანჯარაზე აირჩიე Allow/Allow Notifications.</Text>
              <Text style={styles.instructionsText}>3) თუ დაბლოკილია, გახსენი Settings → Notifications და ჩართე სახელით „Marte“.</Text>
            </View>

            {blocked && (
              <View style={styles.warning}>
                <Ionicons name="alert-circle" size={16} color="#B91C1C" />
                <Text style={styles.warningText}>
                  ნებართვა დაბლოკილია. გახსენი Settings › Notifications და დაუშვი შეტყობინებები.
                </Text>
                <TouchableOpacity style={styles.settingsBtn} onPress={handleOpenSettings}>
                  <Text style={styles.settingsText}>გახსენი Settings</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={handleLater}
                disabled={loading}
              >
                <Text style={styles.secondaryText}>მოგვიანებით</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
                onPress={handleEnable}
                disabled={loading}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryText}>{loading ? 'იტვირთება...' : 'გააქტიურე'}</Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </Modal>

      <Modal
        visible={previewVisible}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        statusBarTranslucent
        onRequestClose={() => setPreviewVisible(false)}
      >
        <View style={styles.previewOverlay}>
          <View style={styles.previewCard}>
            <Image
              source={previewSource || DEFAULT_IMAGE}
              style={styles.previewFull}
            />
            <TouchableOpacity style={styles.previewCloseBtn} onPress={() => setPreviewVisible(false)}>
              <Ionicons name="close" size={20} color="#111827" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontFamily: 'HelveticaMedium',
    fontWeight: '800',
    color: '#111827',
    textTransform: 'uppercase',
  },
  subtitle: {
    fontSize: 13,
    color: '#4B5563',
    fontFamily: 'HelveticaMedium',
    lineHeight: 18,
    textTransform: 'uppercase',
  },
  previewRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
    marginBottom: 4,
  },
  previewImageWrap: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  previewImage: {
    width: '100%',
    height: 90,
    borderRadius: 10,
    resizeMode: 'cover',
  },
  previewLabel: {
    fontSize: 11,
    color: '#111827',
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
  },
  perks: {
    gap: 8,
    marginTop: 4,
  },
  perkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  perkText: {
    color: '#111827',
    fontSize: 13,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
  },
  instructions: {
    marginTop: 6,
    gap: 4,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  instructionsTitle: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    color: '#111827',
    textTransform: 'uppercase',
  },
  instructionsText: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    color: '#4B5563',
  },
  warning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  warningText: {
    flex: 1,
    color: '#991B1B',
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
  },
  settingsBtn: {
    marginLeft: 'auto',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#991B1B',
    borderRadius: 10,
  },
  settingsText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    fontSize: 13,
    color: '#374151',
    fontFamily: 'HelveticaMedium',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  primaryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  neverBtn: {
    marginTop: 6,
    alignItems: 'center',
    paddingVertical: 8,
  },
  neverText: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  previewCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    position: 'relative',
  },
  previewFull: {
    width: '100%',
    aspectRatio: 9 / 19.5,
    resizeMode: 'cover',
  },
  previewCloseBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
