import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface ForceUpdateModalProps {
  visible: boolean;
  minVersion: string;
  currentVersion: string;
  onClose?: () => void;
}

export default function ForceUpdateModal({
  visible,
  minVersion,
  currentVersion,
  onClose,
}: ForceUpdateModalProps) {
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(50)).current;

  React.useEffect(() => {
    console.log('🔍 [FORCE UPDATE MODAL] Modal visible prop changed:', visible);
    console.log('🔍 [FORCE UPDATE MODAL] minVersion:', minVersion);
    console.log('🔍 [FORCE UPDATE MODAL] currentVersion:', currentVersion);
    if (visible) {
      console.log('🔍 [FORCE UPDATE MODAL] Starting animation...');
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start(() => {
        console.log('🔍 [FORCE UPDATE MODAL] Animation completed');
      });
    } else {
      fadeAnim.setValue(0);
      slideAnim.setValue(50);
    }
  }, [visible, minVersion, currentVersion]);

  const storeUrl = Platform.select({
    ios: 'https://apps.apple.com/app/id6753679575',
    android: 'https://play.google.com/store/apps/details?id=com.marte.marte&hl=en',
  });
  const updateButtonLabel = Platform.select({
    ios: 'განახლება (App Store)',
    android: 'განახლება (Play Store)',
    default: 'განახლება',
  });

  const handleUpdate = () => {
    if (storeUrl) {
      Linking.openURL(storeUrl).catch((err) => {
        console.error('Error opening store:', err);
      });
    }
  };

  const handleClose = () => {
    if (onClose) {
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose} // შეიძლება დახურულ იქნას
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={handleClose}
      >
        <Animated.View
          style={[
            styles.modalContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
          onStartShouldSetResponder={() => true}
        >
          {/* Close Button */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClose}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={24} color="#6B7280" />
          </TouchableOpacity>

          {/* Icon */}
          <View style={styles.iconContainer}>
            <LinearGradient
              colors={['#F59E0B', '#EF4444']}
              style={styles.iconGradient}
            >
              <Ionicons name="cloud-download-outline" size={48} color="#FFFFFF" />
            </LinearGradient>
          </View>

          {/* Title */}
          <View style={styles.titleContainer}>
            <Text style={styles.title}>განახლება საჭიროა</Text>
            <Text style={styles.subtitle}>
              აპლიკაციის გამოსაყენებლად გთხოვთ დაააფდეითოთ ახალი ვერსია
            </Text>
          </View>

          {/* Version Info */}
          <View style={styles.versionContainer}>
            <View style={styles.versionRow}>
              <Text style={styles.versionLabel}>მიმდინარე ვერსია:</Text>
              <Text style={styles.versionValue}>{currentVersion}</Text>
            </View>
            <View style={styles.versionRow}>
              <Text style={styles.versionLabel}>მინიმალური ვერსია:</Text>
              <Text style={styles.versionValueRequired}>{minVersion}</Text>
            </View>
          </View>

          {/* Update Button */}
          <TouchableOpacity
            style={styles.updateButton}
            onPress={handleUpdate}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#3B82F6', '#2563EB']}
              style={styles.updateButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons name="cloud-download" size={20} color="#FFFFFF" />
              <Text style={styles.updateButtonText}>{updateButtonLabel}</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Info Text */}
          <Text style={styles.infoText}>
            განახლების შემდეგ თქვენ შეძლებთ აპლიკაციის გამოყენებას
          </Text>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  iconContainer: {
    marginBottom: 20,
  },
  iconGradient: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
    fontFamily: 'Outfit',
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    fontFamily: 'Outfit',
  },
  versionContainer: {
    width: '100%',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  versionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  versionLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Outfit',
  },
  versionValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    fontFamily: 'Outfit',
  },
  versionValueRequired: {
    fontSize: 14,
    fontWeight: '700',
    color: '#EF4444',
    fontFamily: 'Outfit',
  },
  updateButton: {
    width: '100%',
    marginBottom: 16,
  },
  updateButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  updateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Outfit',
  },
  infoText: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    fontFamily: 'Outfit',
  },
});

