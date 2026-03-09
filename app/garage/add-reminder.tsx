import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCars } from '../../contexts/CarContext';
import { useToast } from '../../contexts/ToastContext';
import DateTimePicker from '@react-native-community/datetimepicker';

const { width } = Dimensions.get('window');

interface ReminderData {
  title: string;
  description: string;
  carId: string;
  reminderDate: string;
  reminderTime: string;
  reminderTime2?: string;
  startDate?: string;
  endDate?: string;
  type: string;
  priority: string;
  recurringInterval?: string;
}

const REMINDER_TYPES = [
  { id: 'maintenance', name: 'მოვლა-პატრონობა', icon: 'build-outline', accent: '#111827' },
  { id: 'service', name: 'სერვისი', icon: 'settings-outline', accent: '#3B82F6' },
  { id: 'oil', name: 'ზეთის შეცვლა', icon: 'water-outline', accent: '#0EA5E9' },
  { id: 'tires', name: 'ბორბლები', icon: 'ellipse-outline', accent: '#8B5CF6' },
  { id: 'battery', name: 'აკუმულატორი', icon: 'battery-half-outline', accent: '#F59E0B' },
  { id: 'inspection', name: 'ტექდათვალიერება', icon: 'search-outline', accent: '#10B981' },
  { id: 'carwash', name: 'სამრეცხაო', icon: 'water-outline', accent: '#22C55E' },
  { id: 'insurance', name: 'დაზღვევა', icon: 'shield-outline', accent: '#EF4444' },
  { id: 'fuel', name: 'საწვავი', icon: 'car-outline', accent: '#F97316' },
  { id: 'parts', name: 'ნაწილები', icon: 'construct-outline', accent: '#EC4899' },
];

const PRIORITY_LEVELS = [
  { id: 'low', name: 'დაბალი', color: '#22C55E', icon: 'arrow-down' },
  { id: 'medium', name: 'საშუალო', color: '#F59E0B', icon: 'remove' },
  { id: 'high', name: 'მაღალი', color: '#EF4444', icon: 'arrow-up' },
];

const RECURRING_INTERVALS = [
  { id: 'none', name: 'ერთხელ', icon: 'close-circle-outline', description: 'მხოლოდ ერთხელ' },
  { id: 'daily', name: 'ყოველდღე', icon: 'calendar-outline', description: 'დღეში 2 ჯერ' },
  { id: 'weekly', name: 'ყოველ კვირაში', icon: 'calendar-outline', description: 'ყოველ კვირას' },
  { id: 'monthly', name: 'ყოველ თვეში', icon: 'calendar-outline', description: 'ყოველ თვეს' },
  { id: 'yearly', name: 'ყოველ წელს', icon: 'calendar-outline', description: 'ყოველ წელს' },
];

const formatTime = (d: Date) => {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
};

export default function AddReminderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const editReminderId = params.edit as string | undefined;
  const { selectedCar: contextSelectedCar, cars, addReminder, updateReminder, reminders } = useCars();
  const { success, error } = useToast();
  const insets = useSafeAreaInsets();
  
  const isEditMode = !!editReminderId;
  const editingReminder = isEditMode ? reminders.find(r => r.id === editReminderId) : null;

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerType, setTimePickerType] = useState<'first' | 'second'>('first');
  const [datePickerType, setDatePickerType] = useState<'start' | 'end'>('start');
  const [tempDate, setTempDate] = useState(new Date());
  const [tempTime, setTempTime] = useState(new Date());

  const formatDate = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const parseDate = (str?: string) => {
    if (!str) return new Date();
    const parts = str.split('-').map(Number);
    if (parts.length === 3 && !parts.some(isNaN)) {
      const [y, m, d] = parts;
      return new Date(y, m - 1, d);
    }
    return new Date();
  };

  const parseTime = (str?: string) => {
    const now = new Date();
    if (!str) return now;
    const parts = str.split(':').map(Number);
    if (parts.length >= 2 && !parts.some(isNaN)) {
      const [h, m] = parts;
      now.setHours(h);
      now.setMinutes(m);
      now.setSeconds(0);
      now.setMilliseconds(0);
      return now;
    }
    return now;
  };

  const [reminderData, setReminderData] = useState<ReminderData>({
    title: '',
    description: '',
    carId: contextSelectedCar?.id || '',
    reminderDate: formatDate(new Date()),
    reminderTime: formatTime(new Date()),
    reminderTime2: undefined,
    startDate: formatDate(new Date()),
    endDate: undefined,
    type: 'maintenance',
    priority: 'medium',
    recurringInterval: 'none',
  });

  useEffect(() => {
    if (contextSelectedCar) {
      setReminderData(prev => ({
        ...prev,
        carId: contextSelectedCar.id,
      }));
    }
  }, [contextSelectedCar]);

  useEffect(() => {
    if (editingReminder) {
      const reminderDate = new Date(editingReminder.reminderDate);
      setReminderData({
        title: editingReminder.title,
        description: editingReminder.description || '',
        carId: editingReminder.carId,
        reminderDate: formatDate(reminderDate),
        reminderTime: editingReminder.reminderTime || formatTime(new Date()),
        reminderTime2: editingReminder.reminderTime2,
        startDate: editingReminder.startDate,
        endDate: editingReminder.endDate,
        type: editingReminder.type,
        priority: editingReminder.priority,
        recurringInterval: editingReminder.recurringInterval || 'none',
      });
    }
  }, [editingReminder]);

  const showLocalError = useCallback((title: string, message?: string) => {
    error(title);
  }, [error]);

  const handleSubmit = async () => {
    if (!reminderData.carId || !reminderData.title) {
      showLocalError('აუცილებელია მანქანა და სათაური');
      return;
    }
    if (reminderData.recurringInterval === 'none' && (!reminderData.reminderDate || !reminderData.reminderTime)) {
      showLocalError('ერთჯერადი შეხსენებისთვის საჭიროა თარიღი და დრო');
      return;
    }
    if (reminderData.recurringInterval === 'daily' && (!reminderData.reminderTime || !reminderData.reminderTime2)) {
      showLocalError('ყოველდღე შეხსენებისთვის საჭიროა ორივე დრო');
      return;
    }

    if (isEditMode && !editReminderId) {
      showLocalError('შეხსენების ID არ მოიძებნა');
      return;
    }

    try {
      let isoDateString: string;
      let reminderTime: string | undefined;
      let reminderTime2: string | undefined;
      let startDate: string | undefined;
      let endDate: string | undefined;

      if (reminderData.recurringInterval === 'none') {
        const dateTime = new Date(`${reminderData.reminderDate}T${reminderData.reminderTime}:00`);
        isoDateString = dateTime.toISOString();
        reminderTime = reminderData.reminderTime;
      } else {
        const startDateTime = new Date(`${reminderData.startDate || reminderData.reminderDate}T00:00:00`);
        isoDateString = startDateTime.toISOString();
        startDate = reminderData.startDate || reminderData.reminderDate;
        endDate = reminderData.endDate;

        if (reminderData.recurringInterval === 'daily') {
          reminderTime = reminderData.reminderTime;
          reminderTime2 = reminderData.reminderTime2;
        } else {
          reminderTime = formatTime(new Date());
        }
      }

      const reminderPayload = {
        carId: reminderData.carId,
        title: reminderData.title,
        description: reminderData.description || undefined,
        type: reminderData.type,
        priority: reminderData.priority,
        reminderDate: isoDateString,
        reminderTime: reminderTime,
        reminderTime2: reminderTime2,
        startDate: startDate,
        endDate: endDate,
        recurringInterval: reminderData.recurringInterval && reminderData.recurringInterval !== 'none'
          ? reminderData.recurringInterval
          : undefined,
      };

      if (isEditMode && editReminderId) {
        await updateReminder(editReminderId, reminderPayload);
        success('შეხსენება წარმატებით განახლდა');
      } else {
        await addReminder(reminderPayload);
        success('შეხსენება წარმატებით დაემატა');
      }
      router.back();
    } catch (err) {
      console.error('Error adding reminder:', err);
      error('შეხსენების დამატება ვერ მოხერხდა');
    }
  };

  const selectedCarFromData = cars.find(c => c.id === reminderData.carId);

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
            <Text style={styles.topBarTitle}>
              {isEditMode ? 'რედაქტირება' : 'ახალი შეხსენება'}
            </Text>
            <View style={styles.topBarButton} />
          </View>
        </SafeAreaView>
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
          {selectedCarFromData && (
            <View style={styles.selectedCarCard}>
              <View style={styles.selectedCarIcon}>
                <Ionicons name="car-sport" size={18} color="#111827" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.selectedCarTitle}>{selectedCarFromData.make} {selectedCarFromData.model}</Text>
                <Text style={styles.selectedCarSubtitle}>{selectedCarFromData.plateNumber}</Text>
              </View>
            </View>
          )}

          <Text style={styles.label}>მანქანა</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            {cars.map((car) => (
              <TouchableOpacity
                key={car.id}
                style={[styles.chip, reminderData.carId === car.id && styles.chipActive]}
                onPress={() => setReminderData({ ...reminderData, carId: car.id })}
              >
                <Ionicons name="car" size={14} color={reminderData.carId === car.id ? '#111827' : '#6B7280'} />
                <Text style={[styles.chipText, reminderData.carId === car.id && styles.chipTextActive]}>
                  {car.make} {car.model}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.label}>ტიპი</Text>
          <View style={styles.chipsRowWrap}>
            {REMINDER_TYPES.map((type) => (
              <TouchableOpacity
                key={type.id}
                style={[
                  styles.typeCard,
                  reminderData.type === type.id && {
                    borderColor: type.accent,
                    backgroundColor: `${type.accent}14`,
                  },
                ]}
                onPress={() => setReminderData({ ...reminderData, type: type.id })}
              >
                <Ionicons name={type.icon as any} size={18} color={type.accent} />
                <Text style={styles.typeText}>{type.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>პრიორიტეტი</Text>
          <View style={styles.chipsRowWrap}>
            {PRIORITY_LEVELS.map((level) => (
              <TouchableOpacity
                key={level.id}
                style={[
                  styles.priorityPill,
                  reminderData.priority === level.id && {
                    backgroundColor: `${level.color}1A`,
                    borderColor: level.color,
                  },
                ]}
                onPress={() => setReminderData({ ...reminderData, priority: level.id })}
              >
                <Ionicons name={level.icon as any} size={14} color={level.color} />
                <Text style={[styles.priorityText, { color: level.color }]}>{level.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>როდის გინდათ რომ შეგახსენოთ?</Text>
            <Text style={styles.sectionSubtitle}>რამდენ ხანში ერთხელ</Text>
          </View>

          <View style={styles.chipsRowWrap}>
            {RECURRING_INTERVALS.map((interval) => (
              <TouchableOpacity
                key={interval.id}
                style={[
                  styles.recurringCard,
                  reminderData.recurringInterval === interval.id && styles.recurringCardActive,
                ]}
                onPress={() => setReminderData({ ...reminderData, recurringInterval: interval.id })}
              >
                <Ionicons
                  name={interval.icon as any}
                  size={18}
                  color={reminderData.recurringInterval === interval.id ? '#111827' : '#6B7280'}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[
                    styles.recurringText,
                    reminderData.recurringInterval === interval.id && styles.recurringTextActive
                  ]}>
                    {interval.name}
                  </Text>
                  {interval.description && (
                    <Text style={styles.recurringDescription}>{interval.description}</Text>
                  )}
                </View>
                {reminderData.recurringInterval === interval.id && (
                  <Ionicons name="checkmark-circle" size={20} color="#111827" />
                )}
              </TouchableOpacity>
            ))}
          </View>

          {reminderData.recurringInterval === 'none' && (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>თარიღი</Text>
                <TouchableOpacity
                  style={styles.inputRow}
                  onPress={() => {
                    setDatePickerType('start');
                    setTempDate(parseDate(reminderData.reminderDate));
                    setShowDatePicker(true);
                  }}
                >
                  <Text style={styles.inputRowText}>
                    {reminderData.reminderDate}
                  </Text>
                  <Ionicons name="calendar-outline" size={16} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
              <View style={{ width: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>დრო</Text>
                <TouchableOpacity
                  style={styles.inputRow}
                  onPress={() => {
                    setTimePickerType('first');
                    setTempTime(parseTime(reminderData.reminderTime));
                    setShowTimePicker(true);
                  }}
                >
                  <Text style={styles.inputRowText}>
                    {reminderData.reminderTime}
                  </Text>
                  <Ionicons name="time-outline" size={16} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {reminderData.recurringInterval === 'daily' && (
            <>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>დაწყების თარიღი</Text>
                  <TouchableOpacity
                    style={styles.inputRow}
                    onPress={() => {
                      setDatePickerType('start');
                      setTempDate(parseDate(reminderData.startDate || reminderData.reminderDate));
                      setShowDatePicker(true);
                    }}
                  >
                    <Text style={styles.inputRowText}>
                      {reminderData.startDate || formatDate(new Date())}
                    </Text>
                    <Ionicons name="calendar-outline" size={16} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>
                <View style={{ width: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>დასრულების თარიღი</Text>
                  <TouchableOpacity
                    style={styles.inputRow}
                    onPress={() => {
                      setDatePickerType('end');
                      setTempDate(parseDate(reminderData.endDate || reminderData.startDate || reminderData.reminderDate));
                      setShowDatePicker(true);
                    }}
                  >
                    <Text style={styles.inputRowText}>
                      {reminderData.endDate || 'არ არის'}
                    </Text>
                    <Ionicons name="calendar-outline" size={16} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={styles.label}>დრო (პირველი შეხსენება)</Text>
              <TouchableOpacity
                style={styles.inputRow}
                onPress={() => {
                  setTimePickerType('first');
                  setTempTime(parseTime(reminderData.reminderTime));
                  setShowTimePicker(true);
                }}
              >
                <Text style={styles.inputRowText}>
                  {reminderData.reminderTime || 'აირჩიეთ დრო'}
                </Text>
                <Ionicons name="time-outline" size={16} color="#9CA3AF" />
              </TouchableOpacity>

              <Text style={[styles.label, { marginTop: 12 }]}>დრო (მეორე შეხსენება)</Text>
              <TouchableOpacity
                style={styles.inputRow}
                onPress={() => {
                  setTimePickerType('second');
                  setTempTime(parseTime(reminderData.reminderTime2 || reminderData.reminderTime));
                  setShowTimePicker(true);
                }}
              >
                <Text style={styles.inputRowText}>
                  {reminderData.reminderTime2 || 'აირჩიეთ დრო'}
                </Text>
                <Ionicons name="time-outline" size={16} color="#9CA3AF" />
              </TouchableOpacity>

              <View style={styles.infoBox}>
                <Ionicons name="information-circle-outline" size={20} color="#111827" />
                <Text style={styles.infoText}>
                  შეხსენება დაიწყება არჩეულ თარიღზე და გაიგზავნება დღეში 2 ჯერ არჩეულ დროებში{reminderData.endDate ? ` ${reminderData.endDate}-მდე` : ''}
                </Text>
              </View>
            </>
          )}

          {reminderData.recurringInterval !== 'none' && reminderData.recurringInterval !== 'daily' && (
            <>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>დაწყების თარიღი</Text>
                  <TouchableOpacity
                    style={styles.inputRow}
                    onPress={() => {
                      setDatePickerType('start');
                      setTempDate(parseDate(reminderData.startDate || reminderData.reminderDate));
                      setShowDatePicker(true);
                    }}
                  >
                    <Text style={styles.inputRowText}>
                      {reminderData.startDate || formatDate(new Date())}
                    </Text>
                    <Ionicons name="calendar-outline" size={16} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>
                <View style={{ width: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>დასრულების თარიღი</Text>
                  <TouchableOpacity
                    style={styles.inputRow}
                    onPress={() => {
                      setDatePickerType('end');
                      setTempDate(parseDate(reminderData.endDate || reminderData.startDate || reminderData.reminderDate));
                      setShowDatePicker(true);
                    }}
                  >
                    <Text style={styles.inputRowText}>
                      {reminderData.endDate || 'არ არის'}
                    </Text>
                    <Ionicons name="calendar-outline" size={16} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.infoBox}>
                <Ionicons name="information-circle-outline" size={20} color="#111827" />
                <Text style={styles.infoText}>
                  შეხსენება დაიწყება არჩეულ თარიღზე და გაიგზავნება {reminderData.recurringInterval === 'weekly' ? 'ყოველ კვირაში' :
                    reminderData.recurringInterval === 'monthly' ? 'ყოველ თვეში' :
                    'ყოველ წელს'}{reminderData.endDate ? ` ${reminderData.endDate}-მდე` : ''}
                </Text>
              </View>
            </>
          )}

          <Text style={styles.label}>სათაური</Text>
          <TextInput
            style={styles.textInput}
            placeholder="მაგ: ზეთის შეცვლა"
            placeholderTextColor="#9CA3AF"
            value={reminderData.title}
            onChangeText={(text) => setReminderData({ ...reminderData, title: text })}
          />

          <Text style={styles.label}>აღწერა</Text>
          <TextInput
            style={[styles.textInput, { height: 96, textAlignVertical: 'top' }]}
            placeholder="დეტალები, სერვის ცენტრი, საჭირო ნაწილები..."
            placeholderTextColor="#9CA3AF"
            multiline
            value={reminderData.description}
            onChangeText={(text) => setReminderData({ ...reminderData, description: text })}
          />
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.back()}>
            <Text style={styles.secondaryText}>გაუქმება</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryBtn} onPress={handleSubmit}>
            <Text style={styles.primaryText}>შენახვა</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {showDatePicker && (
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerCard}>
            <DateTimePicker
              value={tempDate}
              mode="date"
              display="spinner"
              onChange={(_, date) => {
                if (date) setTempDate(date);
              }}
            />
            <View style={styles.pickerActions}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setShowDatePicker(false)}>
                <Text style={styles.secondaryText}>გაუქმება</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => {
                  if (datePickerType === 'start') {
                    setReminderData(prev => ({ ...prev, startDate: formatDate(tempDate) }));
                  } else {
                    setReminderData(prev => ({ ...prev, endDate: formatDate(tempDate) }));
                  }
                  if (reminderData.recurringInterval === 'none') {
                    setReminderData(prev => ({ ...prev, reminderDate: formatDate(tempDate) }));
                  }
                  setShowDatePicker(false);
                }}
              >
                <Text style={styles.primaryText}>არჩევა</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {showTimePicker && (
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerCard}>
            <DateTimePicker
              value={tempTime}
              mode="time"
              display="spinner"
              onChange={(_, date) => {
                if (date) setTempTime(date);
              }}
            />
            <View style={styles.pickerActions}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setShowTimePicker(false)}>
                <Text style={styles.secondaryText}>გაუქმება</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => {
                  if (timePickerType === 'first') {
                    setReminderData(prev => ({ ...prev, reminderTime: formatTime(tempTime) }));
                  } else {
                    setReminderData(prev => ({ ...prev, reminderTime2: formatTime(tempTime) }));
                  }
                  setShowTimePicker(false);
                }}
              >
                <Text style={styles.primaryText}>არჩევა</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
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
    padding: 20,
    paddingBottom: 100,
  },
  selectedCarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  selectedCarIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedCarTitle: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#111827',
  },
  selectedCarSubtitle: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: '#6B7280',
    fontWeight: '500',
    marginTop: 2,
  },
  label: {
    fontSize: 13,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  chipsRow: {
    gap: 8,
    paddingVertical: 4,
    paddingRight: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  chipActive: {
    borderColor: '#111827',
    backgroundColor: '#F3F4F6',
  },
  chipText: {
    fontSize: 13,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: '#6B7280',
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#111827',
  },
  chipsRowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  typeText: {
    fontSize: 13,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: '#111827',
    fontWeight: '600',
  },
  priorityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  priorityText: {
    fontSize: 13,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  sectionHeader: {
    marginTop: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '500',
    color: '#6B7280',
  },
  recurringCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    width: '100%',
    marginBottom: 8,
  },
  recurringCardActive: {
    borderColor: '#111827',
    backgroundColor: '#F3F4F6',
  },
  recurringText: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: '#111827',
    fontWeight: '600',
    marginBottom: 2,
  },
  recurringTextActive: {
    color: '#111827',
    fontWeight: '700',
  },
  recurringDescription: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: '#6B7280',
    fontWeight: '500',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'HelveticaMedium',
    color: '#374151',
    fontWeight: '500',
    lineHeight: 18,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  inputRow: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputRowText: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    color: '#111827',
    fontWeight: '600',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 14,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  secondaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  secondaryText: {
    fontSize: 15,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#111827',
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryText: {
    fontSize: 15,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#FFFFFF',
  },
  pickerOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
    padding: 16,
  },
  pickerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  pickerActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
});
