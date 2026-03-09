import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ServiceHistory } from '../../services/garageApi';

interface ServiceCardProps {
  service: ServiceHistory;
  onPress?: () => void;
}

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

export default function ServiceCard({ service, onPress }: ServiceCardProps) {
  const serviceInfo = SERVICE_TYPE_INFO[service.serviceType] || SERVICE_TYPE_INFO.other;
  const serviceDate = new Date(service.date);

  return (
    <TouchableOpacity
      style={styles.serviceCard}
      activeOpacity={0.7}
      onPress={onPress}
    >
      <View style={[styles.iconContainer, { backgroundColor: `${serviceInfo.color}15` }]}>
        <Ionicons
          name={serviceInfo.icon as any}
          size={24}
          color={serviceInfo.color}
        />
      </View>
      
      <View style={styles.content}>
        <Text style={styles.serviceType} numberOfLines={1}>
          {serviceInfo.name}
        </Text>
        
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="calendar-outline" size={12} color="#6B7280" />
            <Text style={styles.metaText}>
              {serviceDate.toLocaleDateString('ka-GE', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </Text>
          </View>
          
          <View style={styles.metaItem}>
            <Ionicons name="speedometer-outline" size={12} color="#6B7280" />
            <Text style={styles.metaText}>{service.mileage.toLocaleString()} კმ</Text>
          </View>
        </View>

        {service.provider && (
          <View style={styles.providerRow}>
            <Ionicons name="location-outline" size={12} color="#6B7280" />
            <Text style={styles.providerText} numberOfLines={1}>
              {service.provider}
            </Text>
          </View>
        )}

        {service.cost && (
          <View style={styles.costRow}>
            <Text style={styles.costText}>{service.cost} ₾</Text>
          </View>
        )}
      </View>

      <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  serviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
    gap: 6,
  },
  serviceType: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  metaRow: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  providerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  providerText: {
    fontSize: 12,
    color: '#6B7280',
  },
  costRow: {
    marginTop: 4,
  },
  costText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#10B981',
  },
});
