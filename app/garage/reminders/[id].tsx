import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCars } from '../../../contexts/CarContext';
import { useToast } from '../../../contexts/ToastContext';

export default function ReminderDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const reminderId = params.id as string;
  const { reminders, selectedCar, deleteReminder, markReminderCompleted } = useCars();
  const { success, error } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);

  const reminder = reminders.find(r => r.id === reminderId);

  if (!reminder) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent />
        <View style={styles.topBar}>
          <SafeAreaView edges={['top']}>
            <View style={styles.topBarContent}>
              <TouchableOpacity
                style={styles.topBarButton}
                onPress={() => router.back()}
                activeOpacity={0.7}
              >
                <Ionicons name="arrow-back" size={24} color="#111827" />
              </TouchableOpacity>
              <Text style={styles.topBarTitle}>შეხსენება</Text>
              <View style={styles.topBarButton} />
            </View>
          </SafeAreaView>
        </View>
        <View style={styles.emptyState}>
          <View style={styles.emptyIconContainer}>
            <Ionicons name="alert-circle-outline" size={48} color="#9CA3AF" />
          </View>
          <Text style={styles.emptyTitle}>შეხსენება ვერ მოიძებნა</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Text style={styles.backButtonText}>უკან დაბრუნება</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const reminderDate = new Date(reminder.reminderDate);
  const now = new Date();
  
  let isPast = false;
  let daysUntil = 0;
  
  if (reminder.recurringInterval && reminder.recurringInterval !== 'none') {
    if (reminder.endDate) {
      const endDate = new Date(reminder.endDate);
      isPast = endDate < now;
      daysUntil = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    } else {
      if (reminder.startDate) {
        const startDate = new Date(reminder.startDate);
        isPast = false;
        daysUntil = Math.ceil((startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      } else {
        isPast = reminderDate < now;
        daysUntil = Math.ceil((reminderDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      }
    }
  } else {
    isPast = reminderDate < now;
    daysUntil = Math.ceil((reminderDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }
  
  const isCompleted = reminder.isCompleted;

  const handleDelete = () => {
    Alert.alert(
      'შეხსენების წაშლა',
      'დარწმუნებული ხართ რომ გსურთ ამ შეხსენების წაშლა?',
      [
        { text: 'გაუქმება', style: 'cancel' },
        {
          text: 'წაშლა',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsDeleting(true);
              await deleteReminder(reminderId);
              success('შეხსენება წარმატებით წაიშალა');
              router.back();
            } catch (err) {
              console.error('Error deleting reminder:', err);
              error('შეხსენების წაშლა ვერ მოხერხდა');
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  const handleMarkCompleted = async () => {
    try {
      await markReminderCompleted(reminderId);
      success('შეხსენება მონიშნულია როგორც შესრულებული');
    } catch (err) {
      console.error('Error marking reminder as completed:', err);
      error('შეხსენების მონიშვნა ვერ მოხერხდა');
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
      default: return 'მოვლა-პატრონობა';
    }
  };

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

  const getPriorityName = (priority: string) => {
    switch (priority) {
      case 'high': return 'მაღალი';
      case 'medium': return 'საშუალო';
      default: return 'დაბალი';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return '#EF4444';
      case 'medium': return '#F59E0B';
      default: return '#22C55E';
    }
  };

  const getStatusInfo = () => {
    if (isCompleted) {
      return {
        text: 'შესრულებულია',
        color: '#22C55E',
        bgColor: '#D1FAE5',
        icon: 'checkmark-circle',
      };
    }
    if (isPast) {
      return {
        text: 'გავიდა',
        color: '#EF4444',
        bgColor: '#FEE2E2',
        icon: 'close-circle',
      };
    }
    if (daysUntil <= 7) {
      return {
        text: daysUntil === 0 ? 'დღეს' : daysUntil === 1 ? 'ხვალ' : `${daysUntil} დღე`,
        color: '#F59E0B',
        bgColor: '#FEF3C7',
        icon: 'time',
      };
    }
    return {
      text: `${daysUntil} დღე დარჩა`,
      color: '#3B82F6',
      bgColor: '#DBEAFE',
      icon: 'calendar',
    };
  };

  const statusInfo = getStatusInfo();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent />
      
      <View style={styles.topBar}>
        <SafeAreaView edges={['top']}>
          <View style={styles.topBarContent}>
            <TouchableOpacity
              style={styles.topBarButton}
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={24} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.topBarTitle}>შეხსენება</Text>
            <TouchableOpacity
              style={styles.topBarButton}
              onPress={handleDelete}
              disabled={isDeleting}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={22} color={isDeleting ? "#9CA3AF" : "#EF4444"} />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={[styles.typeIconContainer, { backgroundColor: `${getPriorityColor(reminder.priority)}15` }]}>
            <Ionicons
              name={getTypeIcon(reminder.type) as any}
              size={40}
              color={getPriorityColor(reminder.priority)}
            />
          </View>
          <Text style={styles.heroTitle}>{reminder.title}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.bgColor }]}>
            <Ionicons name={statusInfo.icon as any} size={16} color={statusInfo.color} />
            <Text style={[styles.statusText, { color: statusInfo.color }]}>
              {statusInfo.text}
            </Text>
          </View>
        </View>

        {/* Main Info Card */}
        <View style={styles.mainCard}>
          <Text style={styles.cardSectionTitle}>თარიღი და დრო</Text>
          
          {reminder.recurringInterval && reminder.recurringInterval !== 'none' ? (
            <>
              {reminder.startDate && (
                <View style={styles.infoRow}>
                  <View style={[styles.infoIconContainer, { backgroundColor: '#DBEAFE' }]}>
                    <Ionicons name="play-circle" size={20} color="#3B82F6" />
                  </View>
                  <View style={styles.infoTextContainer}>
                    <Text style={styles.infoLabel}>დაწყება</Text>
                    <Text style={styles.infoValue}>
                      {new Date(reminder.startDate).toLocaleDateString('ka-GE', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </Text>
                  </View>
                </View>
              )}
              {reminder.endDate && (
                <View style={styles.infoRow}>
                  <View style={[styles.infoIconContainer, { backgroundColor: '#FEE2E2' }]}>
                    <Ionicons name="stop-circle" size={20} color="#EF4444" />
                  </View>
                  <View style={styles.infoTextContainer}>
                    <Text style={styles.infoLabel}>დასრულება</Text>
                    <Text style={styles.infoValue}>
                      {new Date(reminder.endDate).toLocaleDateString('ka-GE', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </Text>
                  </View>
                </View>
              )}
              {reminder.reminderTime && (
                <View style={styles.infoRow}>
                  <View style={[styles.infoIconContainer, { backgroundColor: '#F0FDF4' }]}>
                    <Ionicons name="time" size={20} color="#22C55E" />
                  </View>
                  <View style={styles.infoTextContainer}>
                    <Text style={styles.infoLabel}>დრო</Text>
                    <Text style={styles.infoValue}>
                      {reminder.reminderTime}
                      {reminder.reminderTime2 && ` და ${reminder.reminderTime2}`}
                    </Text>
                  </View>
                </View>
              )}
            </>
          ) : (
            <>
              <View style={styles.infoRow}>
                <View style={[styles.infoIconContainer, { backgroundColor: '#EEF2FF' }]}>
                  <Ionicons name="calendar" size={20} color="#3B82F6" />
                </View>
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>თარიღი</Text>
                  <Text style={styles.infoValue}>
                    {reminderDate.toLocaleDateString('ka-GE', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </Text>
                </View>
              </View>
              {reminder.reminderTime && (
                <View style={styles.infoRow}>
                  <View style={[styles.infoIconContainer, { backgroundColor: '#F0FDF4' }]}>
                    <Ionicons name="time" size={20} color="#22C55E" />
                  </View>
                  <View style={styles.infoTextContainer}>
                    <Text style={styles.infoLabel}>დრო</Text>
                    <Text style={styles.infoValue}>
                      {reminder.reminderTime}
                      {reminder.reminderTime2 && ` და ${reminder.reminderTime2}`}
                    </Text>
                  </View>
                </View>
              )}
            </>
          )}
        </View>

        {/* Type & Priority Card */}
        <View style={styles.mainCard}>
          <Text style={styles.cardSectionTitle}>ტიპი და პრიორიტეტი</Text>
          
          <View style={styles.infoRow}>
            <View style={[styles.infoIconContainer, { backgroundColor: '#F3F4F6' }]}>
              <Ionicons name="pricetag" size={20} color="#6B7280" />
            </View>
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>ტიპი</Text>
              <Text style={styles.infoValue}>{getTypeName(reminder.type)}</Text>
            </View>
          </View>
          
          <View style={styles.infoRow}>
            <View style={[styles.infoIconContainer, { backgroundColor: `${getPriorityColor(reminder.priority)}15` }]}>
              <Ionicons name="flag" size={20} color={getPriorityColor(reminder.priority)} />
            </View>
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>პრიორიტეტი</Text>
              <Text style={[styles.infoValue, { color: getPriorityColor(reminder.priority) }]}>
                {getPriorityName(reminder.priority)}
              </Text>
            </View>
          </View>

          {reminder.recurringInterval && reminder.recurringInterval !== 'none' && (
            <View style={styles.infoRow}>
              <View style={[styles.infoIconContainer, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="repeat" size={20} color="#F59E0B" />
              </View>
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>განმეორებადობა</Text>
                <Text style={styles.infoValue}>
                  {reminder.recurringInterval === 'daily' ? 'ყოველდღე' :
                   reminder.recurringInterval === 'weekly' ? 'ყოველ კვირაში' :
                   reminder.recurringInterval === 'monthly' ? 'ყოველ თვეში' :
                   reminder.recurringInterval === 'yearly' ? 'ყოველ წელს' :
                   reminder.recurringInterval}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Car Info Card */}
        {selectedCar && (
          <View style={styles.mainCard}>
            <Text style={styles.cardSectionTitle}>მანქანა</Text>
            <View style={styles.infoRow}>
              <View style={[styles.infoIconContainer, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="car" size={20} color="#3B82F6" />
              </View>
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoValue}>
                  {selectedCar.make} {selectedCar.model}
                </Text>
                <Text style={styles.infoSubtext}>{selectedCar.plateNumber}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Description Card */}
        {reminder.description && (
          <View style={styles.mainCard}>
            <Text style={styles.cardSectionTitle}>აღწერა</Text>
            <Text style={styles.descriptionText}>{reminder.description}</Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          {!isCompleted && (
            <TouchableOpacity
              style={styles.completeButton}
              onPress={handleMarkCompleted}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#22C55E', '#16A34A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.completeButtonGradient}
              >
                <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" />
                <Text style={styles.completeButtonText}>მონიშნე როგორც შესრულებული</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => router.push(`/garage/add-reminder?edit=${reminderId}`)}
            activeOpacity={0.8}
          >
            <Ionicons name="create-outline" size={22} color="#111827" />
            <Text style={styles.editButtonText}>რედაქტირება</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topBar: {
    backgroundColor: '#FFFFFF',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  topBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  topBarTitle: {
    fontSize: 18,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    textAlign: 'center',
  },
  topBarButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  heroSection: {
    paddingTop: 28,
    paddingBottom: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  typeIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 20,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 28,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 13,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  mainCard: {
    marginTop: 16,
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  cardSectionTitle: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  infoIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTextContainer: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 3,
  },
  infoValue: {
    fontSize: 15,
    fontFamily: 'HelveticaMedium',
    fontWeight: '600',
    color: '#111827',
  },
  infoSubtext: {
    fontSize: 13,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '400',
    color: '#9CA3AF',
    marginTop: 2,
  },
  descriptionText: {
    fontSize: 15,
    fontFamily: 'HelveticaMedium',
    color: '#374151',
    lineHeight: 24,
  },
  actionsContainer: {
    marginTop: 24,
    paddingHorizontal: 20,
    gap: 12,
  },
  completeButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  completeButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    borderRadius: 16,
  },
  completeButtonText: {
    fontSize: 16,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#FFFFFF',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 16,
    paddingVertical: 18,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  editButtonText: {
    fontSize: 16,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#111827',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  backButton: {
    backgroundColor: '#111827',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 24,
  },
  backButtonText: {
    fontSize: 15,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
