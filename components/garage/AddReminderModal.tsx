import React, { useEffect, useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToast } from '../../contexts/ToastContext';
import DateTimePicker from '@react-native-community/datetimepicker';
import Toast from '../ui/Toast';

const { width } = Dimensions.get('window');

interface ReminderData {
  title: string;
  description: string;
  carId: string;
  reminderDate: string;
  reminderTime: string;
  reminderTime2?: string; // მეორე დრო "ყოველდღე"-სთვის
  startDate?: string; // დაწყების თარიღი recurring-ისთვის
  endDate?: string; // დასრულების თარიღი recurring-ისთვის
  type: string;
  priority: string;
  recurringInterval?: string; // 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'
}

interface AddReminderModalProps {
  visible: boolean;
  onClose: () => void;
  onAddReminder: (reminderData: ReminderData) => void;
  cars: Array<{ id: string; make: string; model: string; plateNumber: string }>;
  defaultCarId?: string;
}

const REMINDER_TYPES = [
  { id: 'maintenance', name: 'მოვლა-პატრონობა', icon: 'build-outline', accent: '#2563EB' },
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

export default function AddReminderModal({ visible, onClose, onAddReminder, cars, defaultCarId }: AddReminderModalProps) {
  const insets = useSafeAreaInsets();
  const { error: globalError } = useToast();

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerType, setTimePickerType] = useState<'first' | 'second'>('first'); // რომელი დრო აირჩევა
  const [datePickerType, setDatePickerType] = useState<'start' | 'end'>('start'); // რომელი თარიღი აირჩევა
  const [tempDate, setTempDate] = useState(new Date());
  const [tempTime, setTempTime] = useState(new Date());
  const [localToast, setLocalToast] = useState<{ id: string; title: string; message?: string } | null>(null);

  const formatDate = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatTime = (d: Date) => {
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
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
    carId: defaultCarId || '',
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
    if (visible && defaultCarId) {
      setReminderData(prev => ({
        ...prev,
        carId: defaultCarId,
      }));
    }
  }, [visible, defaultCarId]);

  useEffect(() => {
    if (!visible) {
      setReminderData({
        title: '',
        description: '',
        carId: defaultCarId || '',
        reminderDate: formatDate(new Date()),
        reminderTime: formatTime(new Date()),
        reminderTime2: undefined,
        startDate: formatDate(new Date()),
        endDate: undefined,
        type: 'maintenance',
        priority: 'medium',
        recurringInterval: 'none',
      });
      setTempDate(new Date());
      setTempTime(new Date());
      setLocalToast(null);
      setTimePickerType('first');
      setDatePickerType('start');
    }
  }, [visible, defaultCarId]);

  const showLocalError = useCallback((title: string, message?: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    setLocalToast({ id, title, message });
    setTimeout(() => {
      setLocalToast(null);
    }, 4000);
  }, []);

  const handleSubmit = () => {
    if (!reminderData.carId || !reminderData.title) {
      showLocalError('აუცილებელია მანქანა და სათაური');
      return;
    }
    // თუ recurringInterval არის 'none', მაშინ თარიღი და დრო საჭიროა
    if (reminderData.recurringInterval === 'none' && (!reminderData.reminderDate || !reminderData.reminderTime)) {
      showLocalError('ერთჯერადი შეხსენებისთვის საჭიროა თარიღი და დრო');
      return;
    }
    // თუ recurringInterval არის 'daily', მაშინ ორივე დრო საჭიროა
    if (reminderData.recurringInterval === 'daily' && (!reminderData.reminderTime || !reminderData.reminderTime2)) {
      showLocalError('ყოველდღე შეხსენებისთვის საჭიროა ორივე დრო');
      return;
    }
    onAddReminder(reminderData);
  };

  const selectedCar = cars.find(c => c.id === reminderData.carId);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => {}}
    >
      <View style={styles.backdrop} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'flex-end' }}
        keyboardVerticalOffset={0}
      >
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.handle} />
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>ახალი შეხსენება</Text>
            <Text style={styles.subtitle}>დააფიქსირე სერვისი ან მოვლენა</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={20} color="#0F172A" />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.body}
          contentContainerStyle={{ paddingBottom: 12 }}
          showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
        >
          {selectedCar && (
            <View style={styles.selectedCarCard}>
              <View style={styles.selectedCarIcon}>
                <Ionicons name="car-sport" size={18} color="#2563EB" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.selectedCarTitle}>{selectedCar.make} {selectedCar.model}</Text>
                <Text style={styles.selectedCarSubtitle}>{selectedCar.plateNumber}</Text>
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
                <Ionicons name="car" size={14} color={reminderData.carId === car.id ? '#0B64D4' : '#475569'} />
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
                  color={reminderData.recurringInterval === interval.id ? '#2563EB' : '#64748B'} 
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
                  <Ionicons name="checkmark-circle" size={20} color="#2563EB" />
                )}
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>თარიღი</Text>
              <TouchableOpacity
                style={styles.inputRow}
                onPress={() => {
                  setTempDate(parseDate(reminderData.reminderDate));
                  setShowDatePicker(true);
                }}
              >
                <Text style={styles.inputRowText}>
                  {reminderData.reminderDate}
                </Text>
                <Ionicons name="calendar-outline" size={16} color="#94A3B8" />
              </TouchableOpacity>
            </View>
            <View style={{ width: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>დრო</Text>
              <TouchableOpacity
                style={styles.inputRow}
                onPress={() => {
                  setTempTime(parseTime(reminderData.reminderTime));
                  setShowTimePicker(true);
                }}
              >
                <Text style={styles.inputRowText}>
                  {reminderData.reminderTime}
                </Text>
                <Ionicons name="time-outline" size={16} color="#94A3B8" />
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.label}>სათაური</Text>
          <TextInput
            style={styles.textInput}
            placeholder="მაგ: ზეთის შეცვლა"
            placeholderTextColor="#94A3B8"
            value={reminderData.title}
            onChangeText={(text) => setReminderData({ ...reminderData, title: text })}
          />

          <Text style={styles.label}>აღწერა</Text>
          <TextInput
            style={[styles.textInput, { height: 96 }]}
            placeholder="დეტალები, სერვის ცენტრი, საჭირო ნაწილები..."
            placeholderTextColor="#94A3B8"
            multiline
            value={reminderData.description}
            onChangeText={(text) => setReminderData({ ...reminderData, description: text })}
          />
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 6 }]}>
          <TouchableOpacity style={styles.secondaryBtn} onPress={onClose}>
            <Text style={styles.secondaryText}>გაუქმება</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryBtn} onPress={handleSubmit}>
            <Text style={styles.primaryText}>შენახვა</Text>
          </TouchableOpacity>
        </View>
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

      {localToast && (
        <View style={[styles.toastWrapper, { paddingTop: insets.top + 12 }]} pointerEvents="box-none">
          <Toast
            id={localToast.id}
            type="error"
            title={localToast.title}
            message={localToast.message}
            onDismiss={() => setLocalToast(null)}
            position="top"
          />
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 8,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: -4 },
    shadowRadius: 12,
    elevation: 6,
  },
  handle: {
    width: 48,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginVertical: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#475569',
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    maxHeight: '78%',
  },
  sectionHeader: {
    marginTop: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 12,
    marginBottom: 6,
  },
  chipsRow: {
    gap: 8,
    paddingVertical: 4,
    paddingRight: 8,
  },
  selectedCarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0EAFF',
    marginBottom: 8,
  },
  selectedCarIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#E0EAFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedCarTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  selectedCarSubtitle: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  chipActive: {
    borderColor: '#0B64D4',
    backgroundColor: '#E8F0FF',
  },
  chipText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#0B64D4',
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
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  typeText: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '700',
  },
  priorityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  priorityText: {
    fontSize: 12,
    fontWeight: '700',
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
    borderColor: '#2563EB',
    backgroundColor: '#EEF2FF',
  },
  recurringText: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '600',
    marginBottom: 2,
  },
  recurringTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
  recurringDescription: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E0EAFF',
    marginTop: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#1E40AF',
    fontWeight: '500',
    lineHeight: 18,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
  },
  inputRow: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputRowText: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '600',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  secondaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
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
  pickerOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-end',
    padding: 12,
  },
  pickerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 6,
  },
  pickerActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  toastWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10000,
    pointerEvents: 'box-none',
  },
});
