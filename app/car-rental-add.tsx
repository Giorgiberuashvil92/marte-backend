import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import API_BASE_URL from '../config/api';
import Colors from '../constants/Colors';
import { useUser } from '../contexts/UserContext';
import PhotoPicker from '../components/ui/PhotoPicker';
import photoService from '../services/photoService';
import { analyticsService } from '../services/analytics';
import { analyticsApi } from '../services/analyticsApi';
import AnalyticsTracker from '../components/AnalyticsTracker';
import { bogApi } from '../services/bogApi';
import BOGPaymentModal from '../components/ui/BOGPaymentModal';
import { useEffect } from 'react';

const CATEGORIES = ['ეკონომი', 'კომფორტი', 'ლუქსი', 'SUV', 'მინივენი'];
const LOCATIONS = ['თბილისი', 'ბათუმი', 'ქუთაისი', 'რუსთავი', 'გორი', 'ზუგდიდი', 'ფოთი', 'სხვა'];
const TRANSMISSIONS = ['მექანიკა', 'ავტომატიკა'];
const FUEL_TYPES = ['ბენზინი', 'დიზელი', 'ჰიბრიდი', 'ელექტრო'];

export default function CarRentalAddScreen() {
  const router = useRouter();
  const { user } = useUser();
  const colors = Colors['light'];

  const [loading, setLoading] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [bogPaymentUrl, setBogPaymentUrl] = useState('');
  const [bogOAuthStatus, setBogOAuthStatus] = useState<any>(null);
  const [paymentCompleted, setPaymentCompleted] = useState(false);
  const LISTING_FEE = 10; // განცხადების დადების საფასური
  const [form, setForm] = useState({
    brand: '',
    model: '',
    year: new Date().getFullYear().toString(),
    category: '',
    pricePerDay: '',
    pricePerWeek: '',
    pricePerMonth: '',
    description: '',
    transmission: '',
    fuelType: '',
    seats: '5',
    location: '',
    address: '',
    phone: user?.phone || '',
    email: user?.email || '',
    deposit: '100',
    minRentalDays: '1',
    maxRentalDays: '30',
  });

  const [features, setFeatures] = useState<string[]>([]);
  const [featureInput, setFeatureInput] = useState('');
  const [photos, setPhotos] = useState<{ uri: string; isLocal: boolean; cloudinaryUrl?: string }[]>([]);
  const [bottomSheet, setBottomSheet] = useState<{ label: string; options: string[]; fieldKey: string } | null>(null);

  // Check BOG OAuth status on mount
  useEffect(() => {
    bogApi.getOAuthStatus().then(setBogOAuthStatus).catch(() => setBogOAuthStatus(null));
  }, []);

  const normalizePhone = (phone: string) => {
    if (!phone) return '';
    if (phone.startsWith('+995') || phone.startsWith('995')) return phone;
    return '+995' + phone.replace(/^\+?/, '');
  };

  const addFeature = () => {
    if (featureInput.trim() && !features.includes(featureInput.trim())) {
      setFeatures([...features, featureInput.trim()]);
      setFeatureInput('');
    }
  };

  const removeFeature = (index: number) => {
    setFeatures(features.filter((_, i) => i !== index));
  };

  const handlePhotosSelected = (selectedPhotos: { uri: string; isLocal: boolean; cloudinaryUrl?: string }[]) => {
    setPhotos(selectedPhotos);
  };

  const uploadImages = async (): Promise<string[]> => {
    if (photos.length === 0) return [];

    setUploadingImages(true);
    const uploadedUrls: string[] = [];

    try {
      for (const photo of photos) {
        if (photo.cloudinaryUrl) {
          // Already uploaded
          uploadedUrls.push(photo.cloudinaryUrl);
        } else if (photo.isLocal) {
          // Upload to Cloudinary
          const result = await photoService.uploadPhoto(photo.uri, 'car-rental');
          if (result.success && result.url) {
            uploadedUrls.push(result.url);
          }
        }
      }
    } catch (error) {
      console.error('Error uploading images:', error);
      throw new Error('ფოტოების ავტვირთვა ვერ მოხერხდა');
    } finally {
      setUploadingImages(false);
    }

    return uploadedUrls;
  };

  const initiatePayment = async () => {
    if (!bogOAuthStatus?.isTokenValid) {
      Alert.alert('შეცდომა', 'BOG გადახდის სერვისი არ არის ხელმისაწვდომი');
      return;
    }

    try {
      const externalOrderId = `car_rental_listing_${Date.now()}_${user?.id || 'unknown'}`;
      
      const orderData = {
        callback_url: `${API_BASE_URL}/bog/callback`,
        external_order_id: externalOrderId,
        total_amount: LISTING_FEE,
        currency: 'GEL',
        product_id: 'car_rental_listing',
        description: `განცხადების დადება - ${form.brand} ${form.model}`,
        success_url: `${API_BASE_URL}/payment/success?type=car_rental_listing&orderId=${externalOrderId}`,
        fail_url: `${API_BASE_URL}/payment/fail`,
        save_card: true,
      };

      const result = await bogApi.createOrder(orderData);
      setBogPaymentUrl(result.redirect_url);
      setShowPaymentModal(true);
    } catch (error: any) {
      console.error('Error initiating payment:', error);
      Alert.alert('შეცდომა', 'გადახდის ინიციალიზაცია ვერ მოხერხდა');
    }
  };

  const handlePaymentSuccess = async () => {
    setPaymentCompleted(true);
    setShowPaymentModal(false);
    // ახლა შეგვიძლია განცხადების დადება
    await handleSubmitAfterPayment();
  };

  const handleSubmit = async () => {
    // Validation
    if (!form.brand?.trim() || !form.model?.trim() || !form.category || !form.transmission || !form.fuelType || !form.location || !form.phone) {
      Alert.alert('შეცდომა', 'გთხოვთ შეავსოთ ყველა სავალდებულო ველი');
      return;
    }

    if (!form.pricePerDay || parseFloat(form.pricePerDay) <= 0) {
      Alert.alert('შეცდომა', 'გთხოვთ მიუთითოთ სწორი ფასი დღეში');
      return;
    }

    if (!form.description?.trim()) {
      Alert.alert('შეცდომა', 'გთხოვთ მიუთითოთ მანქანის აღწერა');
      return;
    }

    if (photos.length === 0) {
      Alert.alert('შეცდომა', 'გთხოვთ დაამატოთ მინიმუმ ერთი ფოტო');
      return;
    }

    // თუ გადახდა უკვე გაკეთებულია, პირდაპირ დავამატოთ განცხადება
    if (paymentCompleted) {
      await handleSubmitAfterPayment();
      return;
    }

    // თუ გადახდა არ არის გაკეთებული, ჯერ გადახდა
    Alert.alert(
      'გადახდა საჭიროა',
      `განცხადების დადება ღირს ${LISTING_FEE} ლარი. გადახდა განხორციელდება BOG-ის მეშვეობით.`,
      [
        { text: 'გაუქმება', style: 'cancel' },
        { 
          text: 'გადახდა', 
          onPress: initiatePayment 
        }
      ]
    );
  };

  const handleSubmitAfterPayment = async () => {
    setLoading(true);

    try {
      // Upload images first
      const imageUrls = await uploadImages();

      const payload = {
        brand: form.brand.trim(),
        model: form.model.trim(),
        year: parseInt(form.year),
        category: form.category,
        pricePerDay: parseFloat(form.pricePerDay),
        pricePerWeek: form.pricePerWeek ? parseFloat(form.pricePerWeek) : undefined,
        pricePerMonth: form.pricePerMonth ? parseFloat(form.pricePerMonth) : undefined,
        images: imageUrls,
        description: form.description.trim(),
        features: features.filter(Boolean),
        transmission: form.transmission,
        fuelType: form.fuelType,
        seats: parseInt(form.seats),
        location: form.location,
        address: form.address.trim() || undefined,
        phone: normalizePhone(form.phone.trim()),
        email: form.email.trim() || undefined,
        deposit: form.deposit ? parseFloat(form.deposit) : 100,
        minRentalDays: form.minRentalDays ? parseInt(form.minRentalDays) : undefined,
        maxRentalDays: form.maxRentalDays ? parseInt(form.maxRentalDays) : undefined,
        available: true,
        ownerId: user?.id,
        ownerName: user?.name,
      };

      const response = await fetch(`${API_BASE_URL}/car-rental`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'განცხადების დადება ვერ მოხერხდა');
      }

      const createdCar = await response.json().catch(() => ({}));

      // Track analytics
      analyticsService.logButtonClick('განცხადების დადება', 'განცხადების დადება', {
        car_id: createdCar._id || createdCar.id,
        brand: form.brand,
        model: form.model,
        category: form.category,
        price_per_day: form.pricePerDay,
      }, user?.id);

      analyticsApi.trackEvent(
        'car_rental_listing_created',
        `განცხადება: ${form.brand} ${form.model}`,
        user?.id,
        'განცხადების დადება',
        {
          car_id: createdCar._id || createdCar.id,
          brand: form.brand,
          model: form.model,
          year: form.year,
          category: form.category,
          price_per_day: form.pricePerDay,
          location: form.location,
          images_count: imageUrls.length,
          features_count: features.length,
        }
      ).catch(() => {});

      Alert.alert('წარმატება', 'განცხადება წარმატებით დაემატა!', [
        {
          text: 'კარგი',
          onPress: () => {
            setPaymentCompleted(false); // Reset payment status
            router.back();
          },
        },
      ]);
    } catch (error: any) {
      console.error('Error creating car rental:', error);
      Alert.alert('შეცდომა', error.message || 'განცხადების დადება ვერ მოხერხდა');
    } finally {
      setLoading(false);
    }
  };

  const openBottomSheet = (label: string, options: string[], fieldKey: string) => {
    setBottomSheet({ label, options, fieldKey });
  };
  const closeBottomSheet = () => setBottomSheet(null);
  const onSelectOption = (value: string) => {
    if (!bottomSheet) return;
    setForm(prev => ({ ...prev, [bottomSheet.fieldKey]: value }));
    closeBottomSheet();
  };

  const renderPickerTrigger = (
    options: string[],
    selected: string,
    fieldKey: string,
    label: string,
    placeholder: string
  ) => (
    <View style={styles.dropdownContainer}>
      <TouchableOpacity
        style={styles.dropdownButton}
        onPress={() => openBottomSheet(label, options, fieldKey)}
        activeOpacity={0.7}
      >
        <Text style={[styles.dropdownText, !selected && styles.placeholder]}>
          {selected || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={20} color="#6B7280" />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>განცხადების დადება</Text>
          <View style={{ width: 40 }} />
        </View>

        <TouchableWithoutFeedback onPress={closeBottomSheet}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <AnalyticsTracker screenName="განცხადების დადება" />
          {/* Photos Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ფოტოები *</Text>
            <Text style={styles.sectionSubtitle}>დაამატეთ მინიმუმ 1 ფოტო</Text>
            <PhotoPicker
              onPhotosSelected={handlePhotosSelected}
              maxPhotos={10}
              initialPhotos={photos}
            />
          </View>

          {/* Basic Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ძირითადი ინფორმაცია</Text>

            <View style={styles.row}>
              <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.label}>ბრენდი *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="მაგ: Toyota"
                  placeholderTextColor="#9CA3AF"
                  value={form.brand}
                  onChangeText={(text) => setForm({ ...form, brand: text })}
                />
              </View>

              <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.label}>მოდელი *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="მაგ: Camry"
                  placeholderTextColor="#9CA3AF"
                  value={form.model}
                  onChangeText={(text) => setForm({ ...form, model: text })}
                />
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>წელი *</Text>
              <TextInput
                style={styles.input}
                placeholder="მაგ: 2023"
                placeholderTextColor="#9CA3AF"
                value={form.year}
                onChangeText={(text) => setForm({ ...form, year: text })}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>კატეგორია *</Text>
              {renderPickerTrigger(CATEGORIES, form.category, 'category', 'კატეგორია', 'აირჩიეთ კატეგორია')}
            </View>
          </View>

          {/* Price Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ფასები</Text>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>ფასი დღეში (₾) *</Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                placeholderTextColor="#9CA3AF"
                value={form.pricePerDay}
                onChangeText={(text) => setForm({ ...form, pricePerDay: text })}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.label}>ფასი კვირაში (₾)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor="#9CA3AF"
                  value={form.pricePerWeek}
                  onChangeText={(text) => setForm({ ...form, pricePerWeek: text })}
                  keyboardType="numeric"
                />
              </View>

              <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.label}>ფასი თვეში (₾)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor="#9CA3AF"
                  value={form.pricePerMonth}
                  onChangeText={(text) => setForm({ ...form, pricePerMonth: text })}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>დეპოზიტი (₾)</Text>
              <TextInput
                style={styles.input}
                placeholder="100"
                placeholderTextColor="#9CA3AF"
                value={form.deposit}
                onChangeText={(text) => setForm({ ...form, deposit: text })}
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* Specs Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ტექნიკური მონაცემები</Text>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>ტრანსმისია *</Text>
              {renderPickerTrigger(TRANSMISSIONS, form.transmission, 'transmission', 'ტრანსმისია', 'აირჩიეთ ტრანსმისია')}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>საწვავის ტიპი *</Text>
              {renderPickerTrigger(FUEL_TYPES, form.fuelType, 'fuelType', 'საწვავის ტიპი', 'აირჩიეთ საწვავის ტიპი')}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>ადგილების რაოდენობა *</Text>
              <TextInput
                style={styles.input}
                placeholder="5"
                placeholderTextColor="#9CA3AF"
                value={form.seats}
                onChangeText={(text) => setForm({ ...form, seats: text })}
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* Location Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>მდებარეობა</Text>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>ქალაქი *</Text>
              {renderPickerTrigger(LOCATIONS, form.location, 'location', 'ქალაქი', 'აირჩიეთ ქალაქი')}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>მისამართი</Text>
              <TextInput
                style={styles.input}
                placeholder="ზუსტი მისამართი"
                placeholderTextColor="#9CA3AF"
                value={form.address}
                onChangeText={(text) => setForm({ ...form, address: text })}
              />
            </View>
          </View>

          {/* Contact Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>კონტაქტი</Text>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>ტელეფონი *</Text>
              <TextInput
                style={styles.input}
                placeholder="+995 555 123 456"
                placeholderTextColor="#9CA3AF"
                value={form.phone}
                onChangeText={(text) => setForm({ ...form, phone: text })}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="email@example.com"
                placeholderTextColor="#9CA3AF"
                value={form.email}
                onChangeText={(text) => setForm({ ...form, email: text })}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>აღწერა *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="დაწერეთ მანქანის დეტალური აღწერა..."
              placeholderTextColor="#9CA3AF"
              value={form.description}
              onChangeText={(text) => setForm({ ...form, description: text })}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
          </View>

          {/* Features */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ფუნქციები</Text>
            <View style={styles.featureInputContainer}>
              <TextInput
                style={[styles.input, styles.featureInput]}
                placeholder="მაგ: GPS, კონდიციონერი..."
                placeholderTextColor="#9CA3AF"
                value={featureInput}
                onChangeText={setFeatureInput}
                onSubmitEditing={addFeature}
              />
              <TouchableOpacity
                style={styles.addFeatureButton}
                onPress={addFeature}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            {features.length > 0 && (
              <View style={styles.featuresList}>
                {features.map((feature, index) => (
                  <View key={index} style={styles.featureChip}>
                    <Text style={styles.featureText}>{feature}</Text>
                    <TouchableOpacity
                      onPress={() => removeFeature(index)}
                      style={styles.removeFeatureButton}
                    >
                      <Ionicons name="close" size={16} color="#6B7280" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Rental Days */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>გაქირავების პერიოდი</Text>
            <View style={styles.row}>
              <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.label}>მინ. დღეები</Text>
                <TextInput
                  style={styles.input}
                  placeholder="1"
                  placeholderTextColor="#9CA3AF"
                  value={form.minRentalDays}
                  onChangeText={(text) => setForm({ ...form, minRentalDays: text })}
                  keyboardType="numeric"
                />
              </View>

              <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.label}>მაქს. დღეები</Text>
                <TextInput
                  style={styles.input}
                  placeholder="30"
                  placeholderTextColor="#9CA3AF"
                  value={form.maxRentalDays}
                  onChangeText={(text) => setForm({ ...form, maxRentalDays: text })}
                  keyboardType="numeric"
                />
              </View>
            </View>
          </View>

          {/* Payment Info */}
          <View style={styles.paymentInfoContainer}>
            <View style={styles.paymentInfoRow}>
              <Ionicons name="information-circle" size={20} color="#3B82F6" />
              <View style={styles.paymentInfoText}>
                <Text style={styles.paymentInfoTitle}>განცხადების დადება</Text>
                <Text style={styles.paymentInfoSubtitle}>
                  განცხადების დადება ღირს {LISTING_FEE} ლარი. გადახდა განხორციელდება BOG-ის მეშვეობით.
                </Text>
              </View>
            </View>
            {paymentCompleted && (
              <View style={styles.paymentSuccessBadge}>
                <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
                <Text style={styles.paymentSuccessText}>გადახდა დასრულებულია</Text>
              </View>
            )}
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, (loading || uploadingImages) && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading || uploadingImages}
            activeOpacity={0.8}
          >
            {loading || uploadingImages ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <LinearGradient
                colors={['#111827', '#1F2937']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.submitGradient}
              >
                <Text style={styles.submitButtonText}>
                  {paymentCompleted ? 'განცხადების დადება' : `გადახდა ${LISTING_FEE}₾ და დადება`}
                </Text>
                <Ionicons name={paymentCompleted ? "checkmark-circle" : "card"} size={20} color="#FFFFFF" />
              </LinearGradient>
            )}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      {/* BOG Payment Modal */}
      <BOGPaymentModal
        visible={showPaymentModal}
        paymentUrl={bogPaymentUrl}
        onClose={() => {
          setShowPaymentModal(false);
          setBogPaymentUrl('');
        }}
        onSuccess={handlePaymentSuccess}
        onError={(error) => {
          Alert.alert('შეცდომა', error || 'გადახდა ვერ მოხერხდა');
          setShowPaymentModal(false);
          setBogPaymentUrl('');
        }}
      />

      <Modal visible={!!bottomSheet} transparent animationType="slide" onRequestClose={closeBottomSheet}>
        <Pressable style={styles.bottomSheetOverlay} onPress={closeBottomSheet}>
          <Pressable style={styles.bottomSheetPane} onPress={() => {}}>
            <View style={styles.bottomSheetHandle} />
            <Text style={styles.bottomSheetTitle}>{bottomSheet ? `აირჩიეთ ${bottomSheet.label}` : ''}</Text>
            <ScrollView
              style={styles.bottomSheetScroll}
              contentContainerStyle={styles.bottomSheetScrollContent}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
            >
              {bottomSheet?.options.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={styles.bottomSheetItem}
                  onPress={() => onSelectOption(option)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.bottomSheetItemText}>{option}</Text>
                  {bottomSheet && form[bottomSheet.fieldKey as keyof typeof form] === option && (
                    <Ionicons name="checkmark" size={18} color="#111827" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.bottomSheetCancel} onPress={closeBottomSheet} activeOpacity={0.7}>
              <Text style={styles.bottomSheetCancelText}>გაუქმება</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'Outfit',
    color: '#111827',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Outfit',
    color: '#111827',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    fontFamily: 'Outfit',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'Outfit',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: 'Outfit',
    color: '#111827',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  textArea: {
    minHeight: 120,
    paddingTop: 12,
  },
  dropdownContainer: {
    position: 'relative',
    zIndex: 10,
  },
  dropdownButton: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dropdownText: {
    fontSize: 15,
    fontFamily: 'Outfit',
    color: '#111827',
  },
  placeholder: {
    color: '#9CA3AF',
  },
  bottomSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  bottomSheetPane: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    maxHeight: '70%',
  },
  bottomSheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginBottom: 16,
  },
  bottomSheetTitle: {
    fontSize: 18,
    fontFamily: 'Outfit',
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  bottomSheetScroll: { maxHeight: 320 },
  bottomSheetScrollContent: { paddingHorizontal: 20, paddingBottom: 12 },
  bottomSheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 4,
    backgroundColor: '#F9FAFB',
  },
  bottomSheetItemText: {
    fontSize: 15,
    fontFamily: 'Outfit',
    color: '#111827',
  },
  bottomSheetCancel: {
    marginTop: 12,
    marginHorizontal: 20,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  bottomSheetCancelText: {
    fontSize: 15,
    fontFamily: 'Outfit',
    fontWeight: '600',
    color: '#6B7280',
  },
  featureInputContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  featureInput: {
    flex: 1,
  },
  addFeatureButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featuresList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  featureChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  featureText: {
    fontSize: 14,
    fontFamily: 'Outfit',
    color: '#111827',
  },
  removeFeatureButton: {
    padding: 2,
  },
  submitButton: {
    marginTop: 8,
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Outfit',
    color: '#FFFFFF',
  },
  paymentInfoContainer: {
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  paymentInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  paymentInfoText: {
    flex: 1,
  },
  paymentInfoTitle: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Outfit',
    color: '#1E40AF',
    marginBottom: 4,
  },
  paymentInfoSubtitle: {
    fontSize: 13,
    fontFamily: 'Outfit',
    color: '#3B82F6',
    lineHeight: 18,
  },
  paymentSuccessBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#BFDBFE',
  },
  paymentSuccessText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Outfit',
    color: '#22C55E',
  },
});
