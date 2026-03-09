import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCars } from '../../contexts/CarContext';
import ReminderCard from '../../components/garage/ReminderCard';

export default function RemindersScreen() {
  const router = useRouter();
  const { selectedCar, reminders } = useCars();

  const carReminders = selectedCar
    ? reminders.filter(r => r.carId === selectedCar.id && !r.isCompleted)
    : [];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header */}
      <View style={styles.topBar}>
        <View style={styles.topBarContent}>
          <TouchableOpacity
            style={styles.topBarButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>შეხსენებები</Text>
          <TouchableOpacity
            style={styles.topBarButton}
            onPress={() => {
              router.push('/garage/add-reminder');
            }}
          >
            <Ionicons name="add" size={24} color="#111827" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {selectedCar ? (
          <>
            <View style={styles.carInfo}>
              <Text style={styles.carName}>
                {selectedCar.make} {selectedCar.model}
              </Text>
              <Text style={styles.carPlate}>{selectedCar.plateNumber}</Text>
            </View>

            {carReminders.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="alarm-outline" size={64} color="#9CA3AF" />
                <Text style={styles.emptyTitle}>შეხსენებები არ არის</Text>
                <Text style={styles.emptySubtitle}>
                  დაამატე შეხსენება და არ გამოტოვო მნიშვნელოვანი თარიღები
                </Text>
                <TouchableOpacity 
                  style={styles.addButton}
                  onPress={() => router.push('/garage/add-reminder')}
                >
                  <Ionicons name="add" size={20} color="#FFFFFF" />
                  <Text style={styles.addButtonText}>შეხსენების დამატება</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.remindersList}>
                {carReminders.map((reminder) => (
                  <ReminderCard
                    key={reminder.id}
                    reminder={reminder}
                    onPress={() => {
                      router.push(`/garage/reminders/${reminder.id}`);
                    }}
                  />
                ))}
              </View>
            )}
          </>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="car-outline" size={64} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>მანქანა არ არის არჩეული</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => router.push('/(tabs)/garage')}
            >
              <Text style={styles.addButtonText}>გარაჟში დაბრუნება</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
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
  topBarButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  carInfo: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  carName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
  },
  carPlate: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
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
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 20,
    fontFamily: 'HelveticaMedium',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#111827',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
  },
  remindersList: {
    gap: 16,
  },
});
