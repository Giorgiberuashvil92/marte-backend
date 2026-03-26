import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Platform,
  ActivityIndicator,
  Alert,
  Keyboard,
  type KeyboardEvent,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import API_BASE_URL from '@/config/api';
import { useUser } from '@/contexts/UserContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import SubscriptionModal from '@/components/ui/SubscriptionModal';
import { analyticsService } from '@/services/analytics';

export default function ExclusiveFuelOfferScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const { isPremiumUser } = useSubscription();
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  /** iOS: კლავიატურის სიმაღლე — ფუტერის marginBottom-ით ღილაკი ზემოთ ჯდება */
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [personalId, setPersonalId] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const prefill = useMemo(() => {
    const raw = (user?.name || '').trim();
    const parts = raw.split(/\s+/).filter(Boolean);
    return {
      firstName: parts[0] || '',
      lastName: parts.slice(1).join(' ') || '',
      phone: user?.phone || '',
      email: user?.email || '',
    };
  }, [user?.name, user?.phone, user?.email]);

  useEffect(() => {
    setFirstName(prefill.firstName);
    setLastName(prefill.lastName);
    setPhone(prefill.phone);
    setEmail(prefill.email);
  }, [prefill.firstName, prefill.lastName, prefill.phone, prefill.email]);

  useEffect(() => {
    const onShow = (e: KeyboardEvent) => {
      if (Platform.OS === 'android') {
        setKeyboardHeight(0);
        return;
      }
      setKeyboardHeight(e.endCoordinates.height);
    };
    const onHide = () => setKeyboardHeight(0);

    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      onShow,
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      onHide,
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const submit = async () => {
    if (!isPremiumUser) {
      setShowSubscriptionModal(true);
      return;
    }

    const pid = personalId.replace(/\s/g, '');
    const ph = phone.replace(/\s/g, '');
    const em = email.trim().toLowerCase();

    if (firstName.trim().length < 2) {
      Alert.alert('შეცდომა', 'შეიყვანეთ სახელი (მინ. 2 სიმბოლო).');
      return;
    }
    if (lastName.trim().length < 2) {
      Alert.alert('შეცდომა', 'შეიყვანეთ გვარი (მინ. 2 სიმბოლო).');
      return;
    }
    if (!/^\d{11}$/.test(pid)) {
      Alert.alert('შეცდომა', 'პირადი ნომერი უნდა იყოს 11 ციფრი.');
      return;
    }
    if (ph.length < 9) {
      Alert.alert('შეცდომა', 'შეიყვანეთ სწორი ტელეფონის ნომერი.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      Alert.alert('შეცდომა', 'შეიყვანეთ სწორი ელ. ფოსტა.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/exclusive-offer-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          personalId: pid,
          phone: ph,
          email: em,
          userId: user?.id,
          source: 'fuel_exclusive_portal',
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || 'request_failed');
      }
      analyticsService.logButtonClick('ექსკლუზიური შეთავაზება გაგზავნა', 'exclusive_fuel_offer', undefined, user?.id);
      Alert.alert(
        'მადლობა',
        'განაცხადი მიღებულია. Marte-ის გუნდი მალე დაგიკავშირდებათ.',
        [
          { text: 'კარგი', onPress: () => router.back() },
          {
            text: 'საწვავის ფასები',
            onPress: () => router.replace('/fuel-stations' as any),
          },
        ],
      );
    } catch {
      Alert.alert('შეცდომა', 'გაგზავნა ვერ მოხერხდა. სცადეთ ხელახლა.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#FFFFFF', '#F8FAFC']} style={StyleSheet.absoluteFillObject} />
      <SafeAreaView style={styles.header} edges={['top']}>
        <View style={styles.headerContent}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            ექსკლუზიური შეთავაზება
          </Text>
          <View style={{ width: 44 }} />
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.flex1}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: 20 },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
          <View style={styles.introCard}>
            <View style={styles.introPill}>
              <Ionicons name="sparkles" size={14} color="#2563EB" />
              <Text style={styles.introPillText}>Marte</Text>
            </View>
            <Text style={styles.introTitle}>ბარათის აქტივაცია</Text>
            <Text style={styles.introBody}>
              განაცხადის გაგზავნა ხელმისაწვდომია მხოლოდ პრემიუმ მომხმარებლებისთვის. ბარათის
              გასააქტიურებლად შეავსეთ ქვევით მოცემული მონაცემები — Marte-ის გუნდი მალე
              დაგიკავშირდებათ.
            </Text>
            {!isPremiumUser && (
              <View style={styles.premiumHint}>
                <Ionicons name="lock-closed" size={16} color="#1D4ED8" />
                <Text style={styles.premiumHintText}>
                  პრემიუმის გარეშე გაგზავნა ვერ მოხერხდება — დააჭირე „გაგზავნას“ პაკეტის ასარჩევად.
                </Text>
              </View>
            )}
          </View>

          <View style={styles.formCard}>
            <Text style={styles.label}>სახელი</Text>
            <TextInput
              style={styles.input}
              value={firstName}
              onChangeText={setFirstName}
              placeholder="სახელი"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="words"
            />

            <Text style={styles.label}>გვარი</Text>
            <TextInput
              style={styles.input}
              value={lastName}
              onChangeText={setLastName}
              placeholder="გვარი"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="words"
            />

            <Text style={styles.label}>პირადი ნომერი</Text>
            <TextInput
              style={styles.input}
              value={personalId}
              onChangeText={(t) => setPersonalId(t.replace(/[^\d]/g, '').slice(0, 11))}
              placeholder="11 ციფრი"
              placeholderTextColor="#9CA3AF"
              keyboardType="number-pad"
              maxLength={11}
            />

            <Text style={styles.label}>ტელეფონი</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="მაგ. 599123456"
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
              returnKeyType="next"
              blurOnSubmit={false}
            />

            <Text style={styles.label}>ელ. ფოსტა</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="email@example.com"
              placeholderTextColor="#9CA3AF"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={() => Keyboard.dismiss()}
            />
          </View>
        </ScrollView>

      <View
        style={[
          styles.footerBar,
          {
            marginBottom:
              (Platform.OS === 'ios' ? keyboardHeight : 0) +
              (keyboardHeight > 0 ? 0 : Math.max(insets.bottom, 12)),
            paddingBottom: keyboardHeight > 0 ? 10 : 0,
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.submitBtn,
            submitting && { opacity: 0.7 },
            !isPremiumUser && !submitting && styles.submitBtnLocked,
          ]}
          onPress={submit}
          disabled={submitting}
          activeOpacity={0.9}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              {!isPremiumUser && (
                <Ionicons name="lock-closed" size={18} color="#FFFFFF" />
              )}
              <Text style={styles.submitText}>
                {isPremiumUser ? 'გაგზავნა' : 'პრემიუმი'}
              </Text>
              {isPremiumUser && <Ionicons name="send" size={18} color="#FFFFFF" />}
            </>
          )}
        </TouchableOpacity>
      </View>

      <SubscriptionModal
        visible={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
        onSuccess={() => setShowSubscriptionModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex1: { flex: 1 },
  header: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 8,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  headerTitle: {
    flex: 1,
    marginHorizontal: 8,
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    fontFamily: 'HelveticaMedium',
    textAlign: 'center',
  },
  scroll: { padding: 16, paddingBottom: 32 },
  introCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E8EEE9',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  introPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 10,
  },
  introPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  introTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    fontFamily: 'HelveticaMedium',
    marginBottom: 8,
  },
  introBody: {
    fontSize: 14,
    lineHeight: 21,
    color: '#64748B',
    fontFamily: 'HelveticaMedium',
  },
  premiumHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 14,
    padding: 12,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  premiumHintText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: '#1E40AF',
    fontFamily: 'HelveticaMedium',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    fontFamily: 'HelveticaMedium',
    marginBottom: 6,
    marginTop: 4,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
    fontFamily: 'HelveticaMedium',
    backgroundColor: '#F9FAFB',
    marginBottom: 12,
  },
  footerBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0F172A',
    paddingVertical: 16,
    borderRadius: 14,
  },
  submitBtnLocked: {
    backgroundColor: '#2563EB',
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
  },
});
