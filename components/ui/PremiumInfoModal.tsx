import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSubscription } from '../../contexts/SubscriptionContext';

interface PremiumInfoModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function PremiumInfoModal({
  visible,
  onClose,
}: PremiumInfoModalProps) {
  const { subscription } = useSubscription();

  // Show modal for both premium and basic plans
  if (!subscription || (subscription.plan !== 'premium' && subscription.plan !== 'basic')) {
    return null;
  }

  // განახლების თარიღის ფორმატირება
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'უცნობი';
    try {
      const date = new Date(dateString);
      const day = date.getDate();
      const month = date.toLocaleDateString('ka-GE', { month: 'long' });
      const year = date.getFullYear();
      return `${day} ${month}, ${year}`;
    } catch {
      return 'უცნობი';
    }
  };

  const renewalDate = subscription.endDate
    ? formatDate(subscription.endDate)
    : 'უცნობი';

  const price = subscription.price || 0;
  const currency = subscription.currency || '₾';

  const features = [
    { icon: 'checkmark-circle' as const, text: 'ყველა ძირითადი ფუნქცია' },
    { icon: 'checkmark-circle' as const, text: 'CarFAX მოხსენებები' },
    { icon: 'checkmark-circle' as const, text: 'უსაზღვრო AI რეკომენდაციები' },
    { icon: 'checkmark-circle' as const, text: 'ჯარიმების მონიტორინგი' },
    { icon: 'checkmark-circle' as const, text: 'პრიორიტეტული მხარდაჭერა' },
  ];

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Icon */}
            <View style={styles.iconCircle}>
              <Ionicons name="diamond" size={36} color="#F59E0B" />
            </View>

            {/* Title */}
            <Text style={styles.modalTitle}>პრემიუმ გამოწერა</Text>
            <Text style={styles.modalSubtitle}>
              თქვენ გაქვთ აქტიური პრემიუმ პაკეტი
            </Text>

            {/* Info Card */}
            <View style={styles.statusCard}>
              <View style={styles.statusRow}>
                <View style={styles.statusLeft}>
                  <Ionicons name="calendar-outline" size={18} color="#6B7280" />
                  <Text style={styles.statusLabel}>განახლება</Text>
                </View>
                <Text style={styles.statusValue}>{renewalDate}</Text>
              </View>
              <View style={styles.statusDivider} />
              <View style={styles.statusRow}>
                <View style={styles.statusLeft}>
                  <Ionicons name="card-outline" size={18} color="#6B7280" />
                  <Text style={styles.statusLabel}>გადახდილი</Text>
                </View>
                <Text style={styles.statusValue}>
                  {price.toFixed(2)} {currency}
                </Text>
              </View>
              {subscription.planPeriod && (
                <>
                  <View style={styles.statusDivider} />
                  <View style={styles.statusRow}>
                    <View style={styles.statusLeft}>
                      <Ionicons name="time-outline" size={18} color="#6B7280" />
                      <Text style={styles.statusLabel}>პერიოდი</Text>
                    </View>
                    <Text style={styles.statusValue}>
                      {subscription.planPeriod === 'monthly' ||
                      subscription.planPeriod === 'თვეში'
                        ? 'თვიური'
                        : subscription.planPeriod === 'yearly' ||
                          subscription.planPeriod === 'წლიური'
                        ? 'წლიური'
                        : subscription.planPeriod}
                    </Text>
                  </View>
                </>
              )}
            </View>

            {/* Features */}
            <View style={styles.featuresCard}>
              <Text style={styles.featuresTitle}>პრემიუმ ფუნქციები</Text>
              {features.map((feature, index) => (
                <View key={index} style={styles.featureRow}>
                  <View style={styles.featureIconCircle}>
                    <Ionicons name={feature.icon} size={16} color="#22C55E" />
                  </View>
                  <Text style={styles.featureText}>{feature.text}</Text>
                </View>
              ))}
            </View>
          </ScrollView>

          {/* Close Button */}
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text style={styles.closeBtnText}>დახურვა</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 28,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    maxHeight: '85%',
  },
  scrollContent: {
    alignItems: 'center',
    paddingBottom: 4,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'HelveticaMedium',
    textAlign: 'center',
    marginBottom: 20,
  },
  statusCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 16,
    width: '100%',
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontFamily: 'HelveticaMedium',
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    fontFamily: 'HelveticaMedium',
  },
  statusDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 4,
  },
  featuresCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 14,
    padding: 16,
    width: '100%',
    marginBottom: 8,
  },
  featuresTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  featureIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    fontSize: 13,
    color: '#111827',
    fontFamily: 'HelveticaMedium',
    fontWeight: '500',
    flex: 1,
  },
  closeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
    borderRadius: 14,
    paddingVertical: 16,
    width: '100%',
    marginTop: 12,
  },
  closeBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
  },
});
