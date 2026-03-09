import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCars } from '../../contexts/CarContext';
import { useToast } from '../../contexts/ToastContext';
import DateTimePicker from '@react-native-community/datetimepicker';
import { CreateServiceHistoryData } from '../../services/garageApi';

const SERVICE_TYPES = [
  { id: 'maintenance', name: 'მოვლა-პატრონობა', icon: 'build-outline', color: '#2563EB' },
  { id: 'service', name: 'სერვისი', icon: 'settings-outline', color: '#3B82F6' },
  { id: 'oil', name: 'ზეთის შეცვლა', icon: 'water-outline', color: '#0EA5E9' },
  { id: 'tires', name: 'ბორბლები', icon: 'ellipse-outline', color: '#8B5CF6' },
  { id: 'battery', name: 'აკუმულატორი', icon: 'battery-half-outline', color: '#F59E0B' },
  { id: 'inspection', name: 'ტექდათვალიერება', icon: 'search-outline', color: '#10B981' },
  { id: 'carwash', name: 'სამრეცხაო', icon: 'water-outline', color: '#22C55E' },
  { id: 'insurance', name: 'დაზღვევა', icon: 'shield-outline', color: '#EF4444' },
  { id: 'fuel', name: 'საწვავი', icon: 'car-outline', color: '#F97316' },
  { id: 'parts', name: 'ნაწილები', icon: 'construct-outline', color: '#EC4899' },
];

const formatDate = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function AddServiceScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const editServiceId = params.edit as string | undefined;
  const { selectedCar, cars, addServiceHistory, updateServiceHistory, serviceHistory } = useCars();
  const { success, error } = useToast();
  const insets = useSafeAreaInsets();

  const isEditMode = !!editServiceId;

  const [loading, setLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showWarrantyPicker, setShowWarrantyPicker] = useState(false);
  const [tempDate, setTempDate] = useState(new Date());

  const [serviceData, setServiceData] = useState<CreateServiceHistoryData>({
    carId: selectedCar?.id || '',
    serviceType: '',
    date: formatDate(new Date()),
    mileage: 0,
    cost: undefined,
    description: '',
    provider: '',
    location: '',
    warrantyUntil: undefined,
  });

  useEffect(() => {
    if (isEditMode && editServiceId) {
      loadServiceData();
    } else if (selectedCar) {
      setServiceData(prev => ({ ...prev, carId: selectedCar.id }));
    }
  }, [isEditMode, editServiceId, selectedCar]);

  const loadServiceData = async () => {
    try {
      setLoading(true);
      const service = serviceHistory.find(s => s.id === editServiceId);
      if (!service) {
        error('სერვისი ვერ მოიძებნა');
        router.back();
        return;
      }
      setServiceData({
        carId: service.carId,
        serviceType: service.serviceType,
        date: typeof service.date === 'string' ? service.date : formatDate(new Date(service.date)),
        mileage: service.mileage,
        cost: service.cost,
        description: service.description || '',
        provider: service.provider || '',
        location: service.location || '',
        warrantyUntil: service.warrantyUntil
          ? typeof service.warrantyUntil === 'string'
            ? service.warrantyUntil
            : formatDate(new Date(service.warrantyUntil))
          : undefined,
      });
    } catch (err) {
      error('სერვისის ჩატვირთვა ვერ მოხერხდა');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!serviceData.carId) {
      error('აირჩიე მანქანა');
      return;
    }
    if (!serviceData.serviceType) {
      error('აირჩიე სერვისის ტიპი');
      return;
    }
    if (serviceData.mileage <= 0) {
      error('შეიყვანე მილაჟი');
      return;
    }

    try {
      setLoading(true);
      if (isEditMode) {
        await updateServiceHistory(editServiceId!, serviceData);
        success('სერვისი განახლებულია');
      } else {
        await addServiceHistory(serviceData);
        success('სერვისი დამატებულია');
      }
      router.back();
    } catch (err) {
      error(isEditMode ? 'სერვისის განახლება ვერ მოხერხდა' : 'სერვისის დამატება ვერ მოხერხდა');
    } finally {
      setLoading(false);
    }
  };

  const selectedServiceType = SERVICE_TYPES.find(t => t.id === serviceData.serviceType);

  if (loading && isEditMode) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>იტვირთება...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {isEditMode ? 'სერვისის რედაქტირება' : 'ახალი სერვისი'}
          </Text>
          <View style={styles.headerButton} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* Car Selection */}
          <View style={styles.section}>
            <Text style={styles.label}>მანქანა *</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carsScroll}
            >
              {cars.map((car) => (
                <TouchableOpacity
                  key={car.id}
                  style={[
                    styles.carChip,
                    serviceData.carId === car.id && styles.carChipActive,
                  ]}
                  onPress={() => setServiceData(prev => ({ ...prev, carId: car.id }))}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="car"
                    size={16}
                    color={serviceData.carId === car.id ? '#3B82F6' : '#6B7280'}
                  />
                  <Text
                    style={[
                      styles.carChipText,
                      serviceData.carId === car.id && styles.carChipTextActive,
                    ]}
                  >
                    {car.make} {car.model}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Service Type */}
          <View style={styles.section}>
            <Text style={styles.label}>სერვისის ტიპი *</Text>
            <View style={styles.chipsRowWrap}>
              {SERVICE_TYPES.map((type) => (
                <TouchableOpacity
                  key={type.id}
                  style={[
                    styles.typeCard,
                    serviceData.serviceType === type.id && {
                      borderColor: type.color,
                      backgroundColor: `${type.color}14`,
                    },
                  ]}
                  onPress={() => setServiceData(prev => ({ ...prev, serviceType: type.id }))}
                  activeOpacity={0.7}
                >
                  <Ionicons name={type.icon as any} size={18} color={type.color} />
                  <Text style={styles.typeText}>{type.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Date */}
          <View style={styles.section}>
            <Text style={styles.label}>თარიღი *</Text>
            <TouchableOpacity
              style={styles.inputRow}
              onPress={() => {
                setTempDate(new Date(serviceData.date));
                setShowDatePicker(true);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.inputRowText}>
                {serviceData.date}
              </Text>
              <Ionicons name="calendar-outline" size={16} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {/* Mileage */}
          <View style={styles.section}>
            <Text style={styles.label}>მილაჟი (კმ) *</Text>
            <TextInput
              style={styles.input}
              value={serviceData.mileage.toString()}
              onChangeText={(text) => {
                const num = parseInt(text, 10) || 0;
                setServiceData(prev => ({ ...prev, mileage: num }));
              }}
              placeholder="მაგ: 50000"
              keyboardType="numeric"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {/* Cost */}
          <View style={styles.section}>
            <Text style={styles.label}>ღირებულება (₾)</Text>
            <TextInput
              style={styles.input}
              value={serviceData.cost?.toString() || ''}
              onChangeText={(text) => {
                const num = text ? parseFloat(text) : undefined;
                setServiceData(prev => ({ ...prev, cost: num }));
              }}
              placeholder="მაგ: 150"
              keyboardType="decimal-pad"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {/* Provider */}
          <View style={styles.section}>
            <Text style={styles.label}>სად გაკეთდა</Text>
            <TextInput
              style={styles.input}
              value={serviceData.provider}
              onChangeText={(text) => setServiceData(prev => ({ ...prev, provider: text }))}
              placeholder="მაგ: AutoService Tbilisi"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {/* Location */}
          <View style={styles.section}>
            <Text style={styles.label}>მდებარეობა</Text>
            <TextInput
              style={styles.input}
              value={serviceData.location}
              onChangeText={(text) => setServiceData(prev => ({ ...prev, location: text }))}
              placeholder="მაგ: თბილისი, ვაკე"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.label}>აღწერა</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={serviceData.description}
              onChangeText={(text) => setServiceData(prev => ({ ...prev, description: text }))}
              placeholder="დამატებითი ინფორმაცია..."
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {/* Warranty Until */}
          <View style={styles.section}>
            <Text style={styles.label}>გარანტია სადამდე</Text>
            <TouchableOpacity
              style={styles.inputRow}
              onPress={() => {
                if (serviceData.warrantyUntil) {
                  setTempDate(new Date(serviceData.warrantyUntil));
                } else {
                  setTempDate(new Date());
                }
                setShowWarrantyPicker(true);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.inputRowText}>
                {serviceData.warrantyUntil || 'არ არის'}
              </Text>
              <Ionicons name="calendar-outline" size={16} color="#94A3B8" />
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Footer with Submit Button */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.back()}>
            <Text style={styles.secondaryText}>გაუქმება</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryBtn, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.7}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryText}>
                {isEditMode ? 'განახლება' : 'დამატება'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Date Pickers */}
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
                    setServiceData(prev => ({ ...prev, date: formatDate(tempDate) }));
                    setShowDatePicker(false);
                  }}
                >
                  <Text style={styles.primaryText}>არჩევა</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {showWarrantyPicker && (
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
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => setShowWarrantyPicker(false)}>
                  <Text style={styles.secondaryText}>გაუქმება</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={() => {
                    setServiceData(prev => ({ ...prev, warrantyUntil: formatDate(tempDate) }));
                    setShowWarrantyPicker(false);
                  }}
                >
                  <Text style={styles.primaryText}>არჩევა</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardView: {
    flex: 1,
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
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  carsScroll: {
    gap: 12,
    paddingRight: 20,
  },
  carChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  carChipActive: {
    borderColor: '#3B82F6',
    backgroundColor: '#EEF2FF',
  },
  carChipText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  carChipTextActive: {
    color: '#3B82F6',
    fontWeight: '600',
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
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  inputText: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
  },
  textArea: {
    minHeight: 100,
    alignItems: 'flex-start',
    paddingTop: 16,
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
  submitButtonDisabled: {
    opacity: 0.6,
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
});
