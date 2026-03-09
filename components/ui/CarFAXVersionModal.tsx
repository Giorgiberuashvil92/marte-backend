import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSubscription } from '../../contexts/SubscriptionContext';

interface CarFAXVersionModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function CarFAXVersionModal({
  visible,
  onClose,
}: CarFAXVersionModalProps) {
  const router = useRouter();
  const { hasActiveSubscription, subscription, isPremiumUser, isBasicUser } = useSubscription();
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(50)).current;

  React.useEffect(() => {
    if (visible) {
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
      ]).start();
    } else {
      fadeAnim.setValue(0);
      slideAnim.setValue(50);
    }
  }, [visible]);

  const handleSelectVersion = (version: 'guest' | 'subscription') => {
    onClose();
    if (version === 'guest') {
      // Guest ვერსია - მხოლოდ premium-ს აქვს
      if (isPremiumUser) {
        router.push('/carfax');
      } else {
        // Show subscription modal
        // For now, navigate to carfax and show prompt there
        router.push('/carfax');
      }
    } else {
      // Subscription ვერსია - მხოლოდ premium-ს აქვს
      if (isPremiumUser) {
        router.push('/carfax');
      } else {
        // Show subscription modal to upgrade to premium
        // For now, navigate to carfax and show prompt there
        router.push('/carfax');
      }
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <Animated.View
          style={[
            styles.modalContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logo}>
              <Text style={styles.logoC}>C</Text>
              <Text style={styles.logoText}>ARFAX</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          {/* Title */}
          <View style={styles.titleContainer}>
            <Text style={styles.title}>აირჩიე ვერსია</Text>
            <Text style={styles.subtitle}>
              აირჩიე შენთვის შესაფერისი ვერსია
            </Text>
          </View>

          {/* Version Cards */}
          <View style={styles.versionsContainer}>
            {/* Basic Version - არ აქვს კარფაქსი */}
            <TouchableOpacity
              style={[styles.versionCard, !isPremiumUser && styles.disabledCard]}
              onPress={() => {
                if (!isPremiumUser) {
                  // Show message that CarFAX is only for Premium
                  return;
                }
                handleSelectVersion('guest');
              }}
              activeOpacity={isPremiumUser ? 0.7 : 1}
              disabled={!isPremiumUser}
            >
              <View style={styles.versionCardHeader}>
                <View style={styles.versionIconContainer}>
                  <Ionicons name="person-outline" size={20} color={isPremiumUser ? "#0066CC" : "#9CA3AF"} />
                </View>
                <View style={[styles.versionBadge, !isPremiumUser && styles.disabledBadge]}>
                  <Text style={[styles.versionBadgeText, !isPremiumUser && styles.disabledBadgeText]}>
                    {isPremiumUser ? 'უფასო' : 'Basic'}
                  </Text>
                </View>
              </View>
              <Text style={[styles.versionTitle, !isPremiumUser && styles.disabledText]}>Basic</Text>
              <Text style={[styles.versionDescription, !isPremiumUser && styles.disabledText]}>
                {isPremiumUser ? 'ძირითადი ინფორმაცია' : 'კარფაქსი მხოლოდ Premium-ისთვის'}
              </Text>
              {!isPremiumUser && (
                <View style={styles.lockMessage}>
                  <Ionicons name="lock-closed" size={14} color="#F59E0B" />
                  <Text style={styles.lockMessageText}>
                    CarFAX მხოლოდ Premium პაკეტისთვის
                  </Text>
                </View>
              )}
              {isPremiumUser && (
                <View style={styles.featuresList}>
                  <View style={styles.featureItem}>
                    <View style={styles.checkIcon}>
                      <Ionicons name="checkmark" size={12} color="#10B981" />
                    </View>
                    <Text style={styles.featureText}>VIN შემოწმება</Text>
                  </View>
                  <View style={styles.featureItem}>
                    <View style={styles.checkIcon}>
                      <Ionicons name="checkmark" size={12} color="#10B981" />
                    </View>
                    <Text style={styles.featureText}>ძირითადი მონაცემები</Text>
                  </View>
                  <View style={styles.featureItem}>
                    <View style={styles.checkIcon}>
                      <Ionicons name="checkmark" size={12} color="#10B981" />
                    </View>
                    <Text style={styles.featureText}>წარსული შემოწმებები</Text>
                  </View>
                </View>
              )}
              <TouchableOpacity 
                style={[styles.versionButton, !isPremiumUser && styles.disabledButton]} 
                activeOpacity={isPremiumUser ? 0.8 : 1}
                disabled={!isPremiumUser}
              >
                <Text style={[styles.versionButtonText, !isPremiumUser && styles.disabledButtonText]}>
                  {isPremiumUser ? 'დაწყება' : 'Premium საჭიროა'}
                </Text>
                {isPremiumUser && (
                  <Ionicons name="arrow-forward" size={14} color="#0066CC" />
                )}
              </TouchableOpacity>
            </TouchableOpacity>

            {/* Premium Version */}
            <TouchableOpacity
              style={[
                styles.versionCard,
                styles.subscriptionCard,
                !isPremiumUser && styles.lockedCard,
              ]}
              onPress={() => handleSelectVersion('subscription')}
              activeOpacity={0.7}
            >
              <View style={styles.versionCardHeader}>
                <View style={[styles.versionIconContainer, styles.subscriptionIcon]}>
                  <Ionicons name="diamond" size={20} color="#FFFFFF" />
                </View>
                {isPremiumUser ? (
                  <View style={styles.activeBadge}>
                    <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                    <Text style={styles.activeBadgeText}>აქტიური</Text>
                  </View>
                ) : (
                  <View style={styles.premiumBadge}>
                    <Text style={styles.premiumBadgeText}>Premium</Text>
                  </View>
                )}
              </View>
              <Text style={styles.versionTitle}>Premium</Text>
              <Text style={styles.versionDescription}>
                სრული ინფორმაცია და დეტალური მოხსენება
              </Text>
              <View style={styles.featuresList}>
                <View style={styles.featureItem}>
                  <View style={styles.checkIcon}>
                    <Ionicons name="checkmark" size={12} color="#10B981" />
                  </View>
                  <Text style={styles.featureText}>ყველაფერი Guest-დან</Text>
                </View>
                <View style={styles.featureItem}>
                  <View style={styles.checkIcon}>
                    <Ionicons name="checkmark" size={12} color="#10B981" />
                  </View>
                  <Text style={styles.featureText}>სრული ისტორია</Text>
                </View>
                <View style={styles.featureItem}>
                  <View style={styles.checkIcon}>
                    <Ionicons name="checkmark" size={12} color="#10B981" />
                  </View>
                  <Text style={styles.featureText}>ავარიების დეტალები</Text>
                </View>
                <View style={styles.featureItem}>
                  <View style={styles.checkIcon}>
                    <Ionicons name="checkmark" size={12} color="#10B981" />
                  </View>
                  <Text style={styles.featureText}>სერვისის ისტორია</Text>
                </View>
                <View style={styles.featureItem}>
                  <View style={styles.checkIcon}>
                    <Ionicons name="checkmark" size={12} color="#10B981" />
                  </View>
                  <Text style={styles.featureText}>PDF მოხსენება</Text>
                </View>
              </View>
              {!isPremiumUser && (
                <View style={styles.upgradePrompt}>
                  <Ionicons name="lock-closed" size={12} color="#F59E0B" />
                  <Text style={styles.upgradePromptText}>
                    საჭიროა Premium პაკეტი (3.99₾/თვე)
                  </Text>
                </View>
              )}
              <TouchableOpacity
                style={[
                  styles.versionButton,
                  styles.subscriptionButton,
                  !isPremiumUser && styles.lockedButton,
                ]}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.versionButtonText,
                    styles.subscriptionButtonText,
                  ]}
                >
                  {isPremiumUser ? 'გამოყენება' : 'გახდი Premium'}
                </Text>
                <Ionicons
                  name="arrow-forward"
                  size={14}
                  color={isPremiumUser ? '#FFFFFF' : '#0066CC'}
                />
              </TouchableOpacity>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingBottom: 32,
    paddingHorizontal: 20,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  logo: {
    width: 44,
    height: 44,
    backgroundColor: '#0066CC',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoC: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 20,
    lineHeight: 20,
  },
  logoText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 7,
    letterSpacing: 0.4,
    marginTop: -1,
  },
  closeButton: {
    padding: 6,
    borderRadius: 8,
  },
  titleContainer: {
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0B1220',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  versionsContainer: {
    gap: 12,
  },
  versionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    padding: 16,
  },
  subscriptionCard: {
    borderColor: '#0066CC',
    backgroundColor: '#F8FAFF',
  },
  lockedCard: {
    opacity: 0.95,
  },
  disabledCard: {
    opacity: 0.7,
    borderColor: '#D1D5DB',
  },
  disabledBadge: {
    backgroundColor: '#F3F4F6',
  },
  disabledBadgeText: {
    color: '#9CA3AF',
  },
  disabledText: {
    color: '#9CA3AF',
  },
  disabledButton: {
    backgroundColor: '#F3F4F6',
    borderColor: '#D1D5DB',
  },
  disabledButtonText: {
    color: '#9CA3AF',
  },
  lockMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    marginBottom: 14,
  },
  lockMessageText: {
    fontSize: 11,
    color: '#92400E',
    fontWeight: '600',
  },
  versionCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  versionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#E6F2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  subscriptionIcon: {
    backgroundColor: '#0066CC',
  },
  versionBadge: {
    backgroundColor: '#E6F2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  versionBadgeText: {
    color: '#0066CC',
    fontSize: 11,
    fontWeight: '600',
  },
  premiumBadge: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  premiumBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  activeBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  activeBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  versionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0B1220',
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  versionDescription: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 14,
    lineHeight: 18,
  },
  featuresList: {
    gap: 10,
    marginBottom: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureText: {
    fontSize: 13,
    color: '#374151',
    flex: 1,
  },
  upgradePrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 14,
  },
  upgradePromptText: {
    fontSize: 11,
    color: '#92400E',
    fontWeight: '600',
  },
  versionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#0066CC',
    gap: 6,
  },
  subscriptionButton: {
    backgroundColor: '#0066CC',
    borderColor: '#0066CC',
  },
  lockedButton: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
  },
  versionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0066CC',
  },
  subscriptionButtonText: {
    color: '#FFFFFF',
  },
});

