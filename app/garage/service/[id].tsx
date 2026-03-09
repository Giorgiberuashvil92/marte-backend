import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useToast } from '../../../contexts/ToastContext';
import { useCars } from '../../../contexts/CarContext';
import { ServiceHistory } from '../../../services/garageApi';

const SERVICE_TYPE_INFO: Record<string, { name: string; icon: string; color: string }> = {
  maintenance: { name: 'მოვლა-პატრონობა', icon: 'build-outline', color: '#2563EB' },
  service: { name: 'სერვისი', icon: 'settings-outline', color: '#3B82F6' },
  oil: { name: 'ზეთის შეცვლა', icon: 'water-outline', color: '#0EA5E9' },
  tires: { name: 'ბორბლები', icon: 'ellipse-outline', color: '#8B5CF6' },
  battery: { name: 'აკუმულატორი', icon: 'battery-half-outline', color: '#F59E0B' },
  inspection: { name: 'ტექდათვალიერება', icon: 'search-outline', color: '#10B981' },
  carwash: { name: 'სამრეცხაო', icon: 'water-outline', color: '#22C55E' },
  insurance: { name: 'დაზღვევა', icon: 'shield-outline', color: '#EF4444' },
  fuel: { name: 'საწვავი', icon: 'car-outline', color: '#F97316' },
  parts: { name: 'ნაწილები', icon: 'construct-outline', color: '#EC4899' },
};

export default function ServiceDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const serviceId = params.id as string;
  const { success, error } = useToast();
  const { serviceHistory, deleteServiceHistory } = useCars();
  const insets = useSafeAreaInsets();
  const [isDeleting, setIsDeleting] = useState(false);

  const service = serviceHistory.find(s => s.id === serviceId) || null;

  const handleDelete = () => {
    Alert.alert(
      'სერვისის წაშლა',
      'დარწმუნებული ხართ რომ გსურთ ამ სერვისის წაშლა?',
      [
        { text: 'გაუქმება', style: 'cancel' },
        {
          text: 'წაშლა',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsDeleting(true);
              await deleteServiceHistory(serviceId);
              success('სერვისი წარმატებით წაიშალა');
              router.back();
            } catch (err) {
              console.error('Error deleting service:', err);
              error('სერვისის წაშლა ვერ მოხერხდა');
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  const handleEdit = () => {
    router.push(`/garage/add-service?edit=${serviceId}`);
  };

  if (!service) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>სერვისი</Text>
          <View style={styles.headerButton} />
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={64} color="#9CA3AF" />
          <Text style={styles.emptyTitle}>სერვისი ვერ მოიძებნა</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>უკან დაბრუნება</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const serviceInfo = SERVICE_TYPE_INFO[service.serviceType] || SERVICE_TYPE_INFO.other;
  const serviceDate = new Date(service.date);
  const warrantyDate = service.warrantyUntil ? new Date(service.warrantyUntil) : null;
  const now = new Date();
  const isWarrantyActive = warrantyDate ? warrantyDate > now : false;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>სერვისი</Text>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={handleDelete}
          disabled={isDeleting}
        >
          <Ionicons name="trash-outline" size={24} color={isDeleting ? "#9CA3AF" : "#EF4444"} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={[styles.typeIconContainer, { backgroundColor: `${serviceInfo.color}15` }]}>
            <Ionicons
              name={serviceInfo.icon as any}
              size={48}
              color={serviceInfo.color}
            />
          </View>
          <Text style={styles.heroTitle}>{serviceInfo.name}</Text>
          {isWarrantyActive && (
            <View style={[styles.warrantyBadge, { backgroundColor: '#D1FAE5' }]}>
              <Ionicons name="shield-checkmark" size={16} color="#059669" />
              <Text style={[styles.warrantyText, { color: '#059669' }]}>
                გარანტია აქტიურია
              </Text>
            </View>
          )}
        </View>

        {/* Main Info Card */}
        <View style={styles.mainCard}>
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Ionicons name="calendar-outline" size={20} color="#6B7280" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>თარიღი</Text>
                <Text style={styles.infoValue}>
                  {serviceDate.toLocaleDateString('ka-GE', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Ionicons name="speedometer-outline" size={20} color="#6B7280" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>მილაჟი</Text>
                <Text style={styles.infoValue}>{service.mileage.toLocaleString()} კმ</Text>
              </View>
            </View>
          </View>

          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Ionicons name="cash-outline" size={20} color="#6B7280" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>ღირებულება</Text>
                <Text style={[styles.infoValue, service.cost ? styles.costValue : styles.emptyValue]}>
                  {service.cost ? `${service.cost} ₾` : 'არ არის მითითებული'}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Ionicons name="location-outline" size={20} color="#6B7280" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>სად გაკეთდა</Text>
                <Text style={[styles.infoValue, !service.provider && styles.emptyValue]}>
                  {service.provider || 'არ არის მითითებული'}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Ionicons name="map-outline" size={20} color="#6B7280" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>მდებარეობა</Text>
                <Text style={[styles.infoValue, !service.location && styles.emptyValue]}>
                  {service.location || 'არ არის მითითებული'}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Ionicons name="shield-outline" size={20} color="#6B7280" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>გარანტია სადამდე</Text>
                <Text style={[styles.infoValue, !warrantyDate && styles.emptyValue]}>
                  {warrantyDate
                    ? warrantyDate.toLocaleDateString('ka-GE', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })
                    : 'არ არის მითითებული'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Description Card */}
        <View style={styles.descriptionCard}>
          <Text style={styles.descriptionLabel}>აღწერა</Text>
          <Text style={[styles.descriptionText, !service.description && styles.emptyValue]}>
            {service.description || 'არ არის მითითებული'}
          </Text>
        </View>

        </ScrollView>

        {/* Footer with Action Button */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={handleEdit}
            activeOpacity={0.7}
          >
            <Ionicons name="create-outline" size={20} color="#FFFFFF" />
            <Text style={styles.primaryText}>რედაქტირება</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  typeIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'center',
  },
  warrantyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  warrantyText: {
    fontSize: 12,
    fontWeight: '600',
  },
  mainCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  infoRow: {
    marginVertical: 4,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '600',
  },
  costValue: {
    color: '#10B981',
  },
  emptyValue: {
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 12,
  },
  descriptionCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  descriptionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  descriptionText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
    shadowColor: '#2563EB',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 4,
  },
  primaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  backButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 24,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
