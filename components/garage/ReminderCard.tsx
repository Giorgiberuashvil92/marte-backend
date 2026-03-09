import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Reminder } from '../../services/garageApi';

interface ReminderCardProps {
  reminder: Reminder;
  onPress?: () => void;
}

export default function ReminderCard({ reminder, onPress }: ReminderCardProps) {
  const reminderDate = new Date(reminder.reminderDate);
  const isPast = reminderDate < new Date();
  const daysUntil = Math.ceil((reminderDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'service': return 'build';
      case 'oil': return 'water';
      case 'tires': return 'disc';
      case 'battery': return 'battery-half';
      case 'inspection': return 'search';
      case 'carwash': return 'water';
      case 'insurance': return 'shield';
      case 'fuel': return 'car';
      case 'parts': return 'construct';
      default: return 'alarm';
    }
  };

  const getTypeName = (type: string) => {
    switch (type) {
      case 'service': return 'სერვისი';
      case 'oil': return 'ზეთი';
      case 'tires': return 'ბორბლები';
      case 'battery': return 'აკუმულატორი';
      case 'inspection': return 'ტექდათვალიერება';
      case 'carwash': return 'სამრეცხაო';
      case 'insurance': return 'დაზღვევა';
      case 'fuel': return 'საწვავი';
      case 'parts': return 'ნაწილები';
      default: return 'მოვლა';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return '#EF4444';
      case 'medium': return '#F59E0B';
      default: return '#3B82F6';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high': return 'arrow-up';
      case 'medium': return 'remove';
      default: return 'arrow-down';
    }
  };

  const getPriorityName = (priority: string) => {
    switch (priority) {
      case 'high': return 'მაღალი';
      case 'medium': return 'საშუალო';
      default: return 'დაბალი';
    }
  };

  const priorityColor = getPriorityColor(reminder.priority);

  return (
    <TouchableOpacity
      style={[
        styles.reminderCard,
        isPast && styles.reminderCardPast
      ]}
      activeOpacity={0.7}
      onPress={onPress}
    >
      <View style={[
        styles.reminderIconContainer,
        reminder.priority === 'high' && styles.reminderIconHigh,
        reminder.priority === 'medium' && styles.reminderIconMedium,
      ]}>
        <Ionicons
          name={getTypeIcon(reminder.type) as any}
          size={22}
          color={priorityColor}
        />
      </View>
      <View style={styles.reminderContent}>
        <View style={styles.reminderHeader}>
          <Text style={styles.reminderTitle}>{reminder.title}</Text>
          {reminder.type && (
            <View style={styles.reminderTypeBadge}>
              <Text style={styles.reminderTypeText}>
                {getTypeName(reminder.type)}
              </Text>
            </View>
          )}
        </View>
        {reminder.description && (
          <Text style={styles.reminderDescription} numberOfLines={2}>
            {reminder.description}
          </Text>
        )}
        <View style={styles.reminderFooter}>
          <View style={styles.reminderDateContainer}>
            <Ionicons name="calendar-outline" size={14} color="#6B7280" />
            <Text style={styles.reminderDate}>
              {reminderDate.toLocaleDateString('ka-GE', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })}
            </Text>
          </View>
          {!isPast && daysUntil <= 7 && (
            <View style={styles.reminderUrgentBadge}>
              <Text style={styles.reminderUrgentText}>
                {daysUntil === 0 ? 'დღეს' :
                  daysUntil === 1 ? 'ხვალ' :
                    `${daysUntil} დღე`}
              </Text>
            </View>
          )}
        </View>
      </View>
      <View style={[
        styles.reminderPriorityBadge,
        reminder.priority === 'high' && styles.reminderPriorityHigh,
        reminder.priority === 'medium' && styles.reminderPriorityMedium,
        reminder.priority === 'low' && styles.reminderPriorityLow,
      ]}>
        <Ionicons
          name={getPriorityIcon(reminder.priority) as any}
          size={12}
          color="#FFFFFF"
        />
        <Text style={styles.reminderPriorityText}>
          {getPriorityName(reminder.priority)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  reminderCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  reminderCardPast: {
    opacity: 0.7,
    borderColor: '#D1D5DB',
  },
  reminderIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  reminderIconHigh: {
    backgroundColor: '#FEE2E2',
  },
  reminderIconMedium: {
    backgroundColor: '#FEF3C7',
  },
  reminderContent: {
    flex: 1,
    paddingRight: 8,
  },
  reminderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 8,
  },
  reminderTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
  },
  reminderTypeBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  reminderTypeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
  },
  reminderDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 10,
    fontFamily: 'HelveticaMedium',
  },
  reminderFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  reminderDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reminderDate: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
    fontFamily: 'HelveticaMedium',
  },
  reminderUrgentBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  reminderUrgentText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#D97706',
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
  },
  reminderPriorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#111827',
  },
  reminderPriorityHigh: {
    backgroundColor: '#EF4444',
  },
  reminderPriorityMedium: {
    backgroundColor: '#F59E0B',
  },
  reminderPriorityLow: {
    backgroundColor: '#22C55E',
  },
  reminderPriorityText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
  },
});
