import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  StatusBar,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useCars } from '@/contexts/CarContext';
import { useToast } from '@/contexts/ToastContext';
import { carBrandsApi } from '@/services/carBrandsApi';
import { uploadCarImage } from '@/utils/cloudinaryUpload';

const CAR_YEARS = Array.from({ length: 25 }, (_, i) => (2024 - i).toString());
const FUEL_TYPES = ['ბენზინი', 'დიზელი', 'ელექტრო', 'ჰიბრიდი', 'გაზი'];
const COLORS = ['თეთრი', 'შავი', 'ნაცრისფერი', 'წითელი', 'ლურჯი', 'მწვანე', 'ყვითელი', 'ნარინჯისფერი', 'ვერცხლისფერი', 'ყავისფერი'];
const CATEGORIES = ['სედანი', 'ჯიპი', 'კუპე', 'ჰეჩბეკი', 'უნივერსალი', 'მინივენი', 'პიკაპი', 'კროსოვერი', 'სპორტული'];

export default function EditCarScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { cars, updateCar } = useCars();
  const { success, error } = useToast();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [carBrands, setCarBrands] = useState<string[]>([]);
  const [carModels, setCarModels] = useState<string[]>([]);
  const [carModelsMap, setCarModelsMap] = useState<{ [key: string]: string[] }>({});

  const [formData, setFormData] = useState({
    vin: '',
    make: '',
    model: '',
    category: '',
    year: '',
    fuelType: '',
    color: '',
    engine: '',
    plateNumber: '',
    techPassport: '',
  });

  const [showDropdown, setShowDropdown] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [originalImageUri, setOriginalImageUri] = useState<string | undefined>(undefined);
  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});

  // მანქანის მონაცემების ჩატვირთვა
  useEffect(() => {
    if (id && cars.length > 0) {
      const car = cars.find(c => c.id === id);
      if (car) {
        setFormData({
          vin: (car as any).vin || '',
          make: car.make || '',
          model: car.model || '',
          category: '',
          year: car.year ? String(car.year) : '',
          fuelType: '',
          color: '',
          engine: '',
          plateNumber: car.plateNumber || '',
          techPassport: (car as any).techPassport || '',
        });
        if (car.imageUri) {
          setOriginalImageUri(car.imageUri);
          setSelectedImage(car.imageUri);
        }
      }
    }
  }, [id, cars]);

  useEffect(() => {
    const loadCarBrands = async () => {
      try {
        const brandsList = await carBrandsApi.getBrandsList();
        const brands = brandsList.map(b => b.name);
        const modelsMap: { [key: string]: string[] } = {};
        brandsList.forEach(brand => {
          modelsMap[brand.name] = brand.models || [];
        });
        setCarBrands(brands);
        setCarModelsMap(modelsMap);
      } catch (err) {
        console.error('Error loading car brands:', err);
      }
    };
    loadCarBrands();
  }, []);

  useEffect(() => {
    if (formData.make && carModelsMap[formData.make]) {
      setCarModels(carModelsMap[formData.make]);
    } else {
      setCarModels([]);
    }
  }, [formData.make, carModelsMap]);

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        error('გთხოვთ, მიეცით ფოტოების წვდომის ნებართვა');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (err) {
      console.error('Error picking image:', err);
      error('ფოტოს არჩევის შეცდომა');
    }
  };

  const handleCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        error('გთხოვთ, მიეცით კამერის წვდომის ნებართვა');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (err) {
      console.error('Error taking photo:', err);
      error('ფოტოს გადაღების შეცდომა');
    }
  };

  const validateForm = () => {
    const errors: { [key: string]: string } = {};

    if (!formData.make) {
      errors.make = 'გთხოვთ აირჩიოთ მწარმოებელი';
    }
    if (!formData.model) {
      errors.model = 'გთხოვთ აირჩიოთ მოდელი';
    }
    if (!formData.year) {
      errors.year = 'გთხოვთ აირჩიოთ წელი';
    }
    if (!formData.plateNumber || formData.plateNumber.trim() === '') {
      errors.plateNumber = 'გთხოვთ შეიყვანოთ სარეგისტრაციო ნომერი';
    }

    setValidationErrors(errors);
    return { isValid: Object.keys(errors).length === 0, errors };
  };

  const handleSubmit = async () => {
    if (!id) return;
    
    const { isValid, errors } = validateForm();
    if (!isValid) {
      const errorMessages = Object.values(errors).join(', ');
      if (errorMessages) {
        error(`გთხოვთ შეავსოთ: ${errorMessages}`);
      }
      return;
    }

    setLoading(true);
    try {
      let imageUri: string | undefined = originalImageUri;

      // თუ ახალი ფოტო აირჩია (განსხვავებული ორიგინალისგან)
      if (selectedImage && selectedImage !== originalImageUri) {
        setUploading(true);
        try {
          const uploadResult = await uploadCarImage(selectedImage);
          if (uploadResult.success && uploadResult.url) {
            imageUri = uploadResult.url;
          }
        } catch (uploadErr) {
          console.error('Image upload error:', uploadErr);
          error('ფოტოს ატვირთვის შეცდომა');
          setLoading(false);
          setUploading(false);
          return;
        }
        setUploading(false);
      }

      await updateCar(id, {
        make: formData.make,
        model: formData.model,
        year: parseInt(formData.year),
        plateNumber: formData.plateNumber,
        imageUri,
        vin: formData.vin || undefined,
        techPassport: formData.techPassport || undefined,
      });

      success('მანქანა წარმატებით განახლდა');
      router.back();
    } catch (err) {
      console.error('Error updating car:', err);
      error('მანქანის განახლების შეცდომა');
    } finally {
      setLoading(false);
    }
  };

  const renderDropdown = (key: string, options: string[], label: string, index: number) => {
    const isOpen = showDropdown === key;
    const value = formData[key as keyof typeof formData] || '';
    const err = validationErrors[key];

    return (
      <View style={[styles.inputContainer, { zIndex: isOpen ? 1000 - index : 1 }]}>
        <Text style={styles.inputLabel}>{label}</Text>
        <TouchableOpacity
          style={[styles.dropdown, err && styles.inputError]}
          onPress={() => {
            setShowDropdown(isOpen ? null : key);
            if (err) {
              setValidationErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[key];
                return newErrors;
              });
            }
          }}
          activeOpacity={0.7}
        >
          <Text style={[styles.dropdownText, !value && styles.dropdownPlaceholder]}>
            {value || `აირჩიეთ ${label.toLowerCase()}`}
          </Text>
          <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={20} color="#9CA3AF" />
        </TouchableOpacity>
        {err && (
          <Text style={styles.errorText}>{err}</Text>
        )}
        {isOpen && (
          <View style={[styles.dropdownList, { zIndex: 10000 }]}>
            <ScrollView style={styles.dropdownScroll} nestedScrollEnabled>
              {options.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={styles.dropdownItem}
                  onPress={() => {
                    setFormData(prev => ({ ...prev, [key]: option }));
                    setShowDropdown(null);
                    if (validationErrors[key]) {
                      setValidationErrors(prev => {
                        const newErrors = { ...prev };
                        delete newErrors[key];
                        return newErrors;
                      });
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.dropdownItemText}>{option}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color="#3B82F6" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>მანქანის რედაქტირება</Text>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleCamera}
            activeOpacity={0.7}
          >
            <Ionicons name="camera-outline" size={24} color="#3B82F6" />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Image Upload */}
          {selectedImage ? (
            <TouchableOpacity
              style={styles.imageContainer}
              onPress={handlePickImage}
              activeOpacity={0.9}
            >
              <Image source={{ uri: selectedImage }} style={styles.carImage} />
              <View style={styles.imageOverlay}>
                <Ionicons name="camera" size={32} color="#FFFFFF" />
                <Text style={styles.imageOverlayText}>ფოტოს შეცვლა</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.imagePlaceholder}
              onPress={handlePickImage}
              activeOpacity={0.7}
            >
              <Ionicons name="image-outline" size={48} color="#9CA3AF" />
              <Text style={styles.imagePlaceholderText}>ფოტოს დამატება</Text>
            </TouchableOpacity>
          )}

          {/* Form Section */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>მწარმოებელი და მანქანის მოდელი</Text>

            {renderDropdown('make', carBrands, 'მწარმოებელი', 0)}
            {renderDropdown('model', carModels, 'მოდელი', 1)}
            {renderDropdown('year', CAR_YEARS, 'წელი', 2)}
            {renderDropdown('category', CATEGORIES, 'კატეგორია', 3)}
            {renderDropdown('fuelType', FUEL_TYPES, 'საწვავის ტიპი', 4)}
            {renderDropdown('color', COLORS, 'ფერი', 5)}
            {renderDropdown('engine', ['1.0L', '1.2L', '1.4L', '1.6L', '1.8L', '2.0L', '2.2L', '2.5L', '3.0L', '3.5L', '4.0L', '5.0L'], 'ძრავი', 6)}

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>VIN კოდი</Text>
              <TextInput
                style={styles.textInput}
                placeholder="მაგ: WDDUG8CBXEA057788"
                value={formData.vin}
                onChangeText={(text) => setFormData(prev => ({ ...prev, vin: text.toUpperCase() }))}
                placeholderTextColor="#9CA3AF"
                autoCapitalize="characters"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>სარეგისტრაციო ნომერი</Text>
              <TextInput
                style={[styles.textInput, validationErrors.plateNumber && styles.inputError]}
                placeholder="მაგ: HG-568-GH"
                value={formData.plateNumber}
                onChangeText={(text) => {
                  setFormData(prev => ({ ...prev, plateNumber: text.toUpperCase() }));
                  if (validationErrors.plateNumber) {
                    setValidationErrors(prev => {
                      const newErrors = { ...prev };
                      delete newErrors.plateNumber;
                      return newErrors;
                    });
                  }
                }}
                placeholderTextColor="#9CA3AF"
                autoCapitalize="characters"
              />
              {validationErrors.plateNumber && (
                <Text style={styles.errorText}>{validationErrors.plateNumber}</Text>
              )}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>ტექპასპორტის ნომერი</Text>
              <TextInput
                style={styles.textInput}
                placeholder="ტექპასპორტის ნომერი"
                value={formData.techPassport}
                onChangeText={(text) => setFormData(prev => ({ ...prev, techPassport: text }))}
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, (loading || uploading) && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading || uploading}
            activeOpacity={0.8}
          >
            {loading || uploading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>შენახვა</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
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
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  imageContainer: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 24,
    position: 'relative',
    backgroundColor: '#F3F4F6',
  },
  carImage: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  imageOverlayText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  imagePlaceholder: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 24,
  },
  imagePlaceholderText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  formSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
  },
  inputContainer: {
    marginBottom: 16,
    position: 'relative',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 8,
    fontFamily: 'HelveticaMedium',
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 52,
  },
  dropdownText: {
    fontSize: 16,
    color: '#111827',
    flex: 1,
    fontWeight: '500',
  },
  dropdownPlaceholder: {
    color: '#9CA3AF',
  },
  dropdownList: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: 4,
    maxHeight: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 10000,
  },
  dropdownScroll: {
    maxHeight: 200,
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
  },
  textInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111827',
    minHeight: 52,
    fontWeight: '500',
  },
  submitButton: {
    backgroundColor: '#6366F1',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
  },
  inputError: {
    borderColor: '#EF4444',
    borderWidth: 2,
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
    fontWeight: '500',
  },
});
