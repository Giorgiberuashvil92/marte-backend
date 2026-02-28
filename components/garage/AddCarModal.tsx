import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  Image,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { uploadCarImage } from '../../utils/cloudinaryUpload';
import { carBrandsApi } from '../../services/carBrandsApi';

const { height } = Dimensions.get('window');

type AddCarModalProps = {
  visible: boolean;
  onClose: () => void;
  onAddCar: (car: { make: string; model: string; year: number; plateNumber: string; imageUri?: string }) => Promise<void> | void;
};

// Car brands and models loaded from API

const CAR_YEARS = Array.from({ length: 25 }, (_, i) => (2024 - i).toString());

export default function AddCarModal({ visible, onClose, onAddCar }: AddCarModalProps) {
  const insets = useSafeAreaInsets();
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [showBrandDropdown, setShowBrandDropdown] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const [showSubmodelDropdown] = useState(false);

  // Car brands and models from API
  const [CAR_BRANDS, setCAR_BRANDS] = useState<string[]>([]);
  const [CAR_MODELS, setCAR_MODELS] = useState<{ [key: string]: string[] }>({});

  // Load car brands from API
  useEffect(() => {
    const loadCarBrands = async () => {
      try {
        const brandsList = await carBrandsApi.getBrandsList();
        const brands = brandsList.map(b => b.name);
        const modelsMap: { [key: string]: string[] } = {};
        brandsList.forEach(brand => {
          modelsMap[brand.name] = brand.models || [];
        });
        setCAR_BRANDS(brands);
        setCAR_MODELS(modelsMap);
      } catch (err) {
        console.error('Error loading car brands:', err);
      }
    };
    loadCarBrands();
  }, []);

  const [newCarData, setNewCarData] = useState<{
    brand?: string;
    model?: string;
    submodel?: string;
    year?: string;
    licensePlate?: string;
    image?: string;
    mileage?: number;
    vin?: string;
    color?: string;
  }>({
    color: '#3B82F6',
  });

  const getAvailableModels = () => {
    const key = (newCarData.brand || '').trim();
    return key ? (CAR_MODELS[key] || []) : [];
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      if (!result.canceled) {
        const localUri = result.assets[0].uri;
        setNewCarData({ ...newCarData, image: localUri });
        setIsUploadingImage(true);
        const uploadResult = await uploadCarImage(localUri);
        if (uploadResult.success && uploadResult.url) {
          setNewCarData({ ...newCarData, image: uploadResult.url });
        }
      }
    } finally {
      setIsUploadingImage(false);
    }
  };

  const selectBrand = (brand: string) => {
    setNewCarData({ ...newCarData, brand, model: '', submodel: '' });
    setShowBrandDropdown(false);
  };

  const selectModel = (model: string) => {
    setNewCarData({ ...newCarData, model, submodel: '' });
    setShowModelDropdown(false);
  };

  const selectYear = (year: string) => {
    setNewCarData({ ...newCarData, year });
    setShowYearDropdown(false);
  };

  const submit = async () => {
    if (!newCarData.brand || !newCarData.model || !newCarData.year || !newCarData.licensePlate) return;
    await onAddCar({
      make: newCarData.brand,
      model: newCarData.model,
      year: parseInt(newCarData.year),
      plateNumber: newCarData.licensePlate,
      imageUri: newCarData.image,
    });
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        style={[styles.modal, { paddingBottom: insets.bottom, paddingTop: insets.top }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.modalContent, { paddingBottom: 24 + insets.bottom }]}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>ახალი მანქანა</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#E5E7EB" />
            </TouchableOpacity>
          </View>
          <ScrollView style={[styles.modalBody, { paddingBottom: 32 + insets.bottom }]}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>ფოტო</Text>
              <TouchableOpacity 
                style={[styles.imagePickerButton, isUploadingImage && { opacity: 0.7 }]} 
                onPress={pickImage}
                disabled={isUploadingImage}
              >
                {newCarData.image ? (
                  <View style={{ position: 'relative', width: '100%', height: '100%' }}>
                    <Image source={{ uri: newCarData.image }} style={styles.selectedImage} />
                    {isUploadingImage && (
                      <View style={styles.uploadOverlay}>
                        <ActivityIndicator size="large" color="#6366F1" />
                        <Text style={styles.uploadText}>ავტვირთვა...</Text>
                      </View>
                    )}
                  </View>
                ) : (
                  <>
                    {isUploadingImage ? (
                      <>
                        <ActivityIndicator size="large" color="#6366F1" />
                        <Text style={{ color: '#6366F1', marginTop: 8, fontWeight: '600' }}>ავტვირთვა...</Text>
                      </>
                    ) : (
                      <>
                        <Ionicons name="camera-outline" size={32} color="#9CA3AF" />
                        <Text style={{ color: '#9CA3AF', marginTop: 8 }}>ფოტოს დამატება</Text>
                      </>
                    )}
                  </>
                )}
              </TouchableOpacity>
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>ბრენდი</Text>
              <View style={styles.dropdownContainer}>
                <TouchableOpacity 
                  style={styles.dropdownButton}
                  onPress={() => setShowBrandDropdown(!showBrandDropdown)}
                >
                  <Text style={[styles.dropdownText, !newCarData.brand && styles.dropdownPlaceholder]}>
                    {newCarData.brand || 'აირჩიეთ ბრენდი'}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color="#9CA3AF" />
                </TouchableOpacity>
                
                {showBrandDropdown && (
                  <View style={styles.dropdownList}>
                    <ScrollView style={styles.dropdownScroll} showsVerticalScrollIndicator={false}>
                      {CAR_BRANDS.map((brand) => (
                        <TouchableOpacity
                          key={brand}
                          style={styles.dropdownItem}
                          onPress={() => selectBrand(brand)}
                        >
                          <Text style={styles.dropdownItemText}>{brand}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>მოდელი</Text>
              <View style={styles.dropdownContainer}>
                <TouchableOpacity 
                  style={[styles.dropdownButton, !newCarData.brand && styles.dropdownDisabled]}
                  onPress={() => newCarData.brand && setShowModelDropdown(!showModelDropdown)}
                  disabled={!newCarData.brand}
                >
                  <Text style={[styles.dropdownText, !newCarData.model && styles.dropdownPlaceholder]}>
                    {newCarData.model || (newCarData.brand ? 'აირჩიეთ მოდელი' : 'ჯერ აირჩიეთ ბრენდი')}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color="#9CA3AF" />
                </TouchableOpacity>
                
                {showModelDropdown && newCarData.brand && (
                  <View style={styles.dropdownList}>
                    <ScrollView style={styles.dropdownScroll} showsVerticalScrollIndicator={false}>
                      {getAvailableModels().map((model) => (
                        <TouchableOpacity
                          key={model}
                          style={styles.dropdownItem}
                          onPress={() => selectModel(model)}
                        >
                          <Text style={styles.dropdownItemText}>{model}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>წელი</Text>
              <View style={styles.dropdownContainer}>
                <TouchableOpacity 
                  style={styles.dropdownButton}
                  onPress={() => setShowYearDropdown(!showYearDropdown)}
                >
                  <Text style={[styles.dropdownText, !newCarData.year && styles.dropdownPlaceholder]}>
                    {newCarData.year || 'აირჩიეთ წელი'}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color="#9CA3AF" />
                </TouchableOpacity>
                
                {showYearDropdown && (
                  <View style={styles.dropdownList}>
                    <ScrollView style={styles.dropdownScroll} showsVerticalScrollIndicator={false}>
                      {CAR_YEARS.map((year) => (
                        <TouchableOpacity
                          key={year}
                          style={styles.dropdownItem}
                          onPress={() => selectYear(year)}
                        >
                          <Text style={styles.dropdownItemText}>{year}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>სახელმწიფო ნომერი</Text>
              <TextInput
                style={styles.input}
                placeholder="ABC-123"
                placeholderTextColor="#6B7280"
                value={newCarData.licensePlate}
                onChangeText={(text) => setNewCarData({...newCarData, licensePlate: text})}
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>გარბენი (კმ)</Text>
              <TextInput
                style={styles.input}
                placeholder="50000"
                placeholderTextColor="#6B7280"
                keyboardType="numeric"
                value={newCarData.mileage?.toString()}
                onChangeText={(text) => setNewCarData({...newCarData, mileage: parseInt(text) || 0})}
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>VIN კოდი (არასავალდებულო)</Text>
              <TextInput
                style={styles.input}
                placeholder="VIN კოდი"
                placeholderTextColor="#6B7280"
                value={newCarData.vin}
                onChangeText={(text) => setNewCarData({...newCarData, vin: text})}
              />
            </View>
            
           
            
            <View style={[styles.modalActions, { paddingBottom: insets.bottom ? insets.bottom : 12 }]}>
              <TouchableOpacity style={styles.cancelModalButton} onPress={onClose}>
                <Text style={styles.cancelModalButtonText}>გაუქმება</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveModalButton} onPress={submit}>
                <Text style={styles.saveModalButtonText}>დამატება</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    maxHeight: height * 0.9,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#4B5563',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalBody: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#E5E7EB',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(55, 65, 81, 0.4)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(156, 163, 175, 0.2)',
    color: '#FFFFFF',
  },
  colorPicker: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  colorOption: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  selectedColor: {
    borderColor: '#6366F1',
  },
  imagePickerButton: {
    backgroundColor: 'rgba(55, 65, 81, 0.3)',
    borderRadius: 12,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(156, 163, 175, 0.3)',
  },
  selectedImage: {
    width: '100%',
    height: 120,
    borderRadius: 12,
  },
  uploadOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  uploadText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  dropdownContainer: {
    marginBottom: 16,
    position: 'relative',
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#374151',
    borderWidth: 1,
    borderColor: '#4B5563',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 50,
  },
  dropdownText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  dropdownPlaceholder: {
    color: '#9CA3AF',
  },
  dropdownDisabled: {
    opacity: 0.5,
  },
  dropdownList: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    backgroundColor: '#374151',
    borderWidth: 1,
    borderColor: '#4B5563',
    borderRadius: 12,
    maxHeight: 200,
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  dropdownScroll: {
    maxHeight: 200,
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#4B5563',
  },
  dropdownItemText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    paddingHorizontal: 20,
  },
  cancelModalButton: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelModalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  saveModalButton: {
    flex: 1,
    backgroundColor: '#10B981',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveModalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

