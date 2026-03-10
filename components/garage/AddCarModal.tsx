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
  Pressable,
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
  const [bottomSheet, setBottomSheet] = useState<{ type: 'brand' | 'model' | 'year'; label: string; options: string[] } | null>(null);

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

  const closeBottomSheet = () => setBottomSheet(null);

  const selectBrand = (brand: string) => {
    setNewCarData(prev => ({ ...prev, brand, model: '', submodel: '' }));
    closeBottomSheet();
  };

  const selectModel = (model: string) => {
    setNewCarData(prev => ({ ...prev, model, submodel: '' }));
    closeBottomSheet();
  };

  const selectYear = (year: string) => {
    setNewCarData(prev => ({ ...prev, year }));
    closeBottomSheet();
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
              <Ionicons name="close" size={24} color="#6B7280" />
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
                          <ActivityIndicator size="large" color="#3B82F6" />
                          <Text style={styles.uploadText}>ავტვირთვა...</Text>
                        </View>
                    )}
                  </View>
                ) : (
                  <>
                    {isUploadingImage ? (
                      <>
                          <ActivityIndicator size="large" color="#3B82F6" />
                          <Text style={{ color: '#3B82F6', marginTop: 8, fontWeight: '600' }}>ავტვირთვა...</Text>
                      </>
                    ) : (
                      <>
                        <Ionicons name="camera-outline" size={32} color="#9CA3AF" />
                        <Text style={{ color: '#6B7280', marginTop: 8 }}>ფოტოს დამატება</Text>
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
                  onPress={() => setBottomSheet({ type: 'brand', label: 'ბრენდი', options: CAR_BRANDS })}
                >
                  <Text style={[styles.dropdownText, !newCarData.brand && styles.dropdownPlaceholder]}>
                    {newCarData.brand || 'აირჩიეთ ბრენდი'}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>მოდელი</Text>
              <View style={styles.dropdownContainer}>
                <TouchableOpacity
                  style={[styles.dropdownButton, !newCarData.brand && styles.dropdownDisabled]}
                  onPress={() => newCarData.brand && setBottomSheet({ type: 'model', label: 'მოდელი', options: getAvailableModels() })}
                  disabled={!newCarData.brand}
                >
                  <Text style={[styles.dropdownText, !newCarData.model && styles.dropdownPlaceholder]}>
                    {newCarData.model || (newCarData.brand ? 'აირჩიეთ მოდელი' : 'ჯერ აირჩიეთ ბრენდი')}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>წელი</Text>
              <View style={styles.dropdownContainer}>
                <TouchableOpacity
                  style={styles.dropdownButton}
                  onPress={() => setBottomSheet({ type: 'year', label: 'წელი', options: CAR_YEARS })}
                >
                  <Text style={[styles.dropdownText, !newCarData.year && styles.dropdownPlaceholder]}>
                    {newCarData.year || 'აირჩიეთ წელი'}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color="#9CA3AF" />
                </TouchableOpacity>
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
                  onPress={() => {
                    if (bottomSheet.type === 'brand') selectBrand(option);
                    else if (bottomSheet.type === 'model') selectModel(option);
                    else selectYear(option);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.bottomSheetItemText}>{option}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.bottomSheetCancel} onPress={closeBottomSheet} activeOpacity={0.7}>
              <Text style={styles.bottomSheetCancelText}>გაუქმება</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    maxHeight: height * 0.9,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#D1D5DB',
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
    color: '#111827',
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
    color: '#111827',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    color: '#111827',
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
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#E5E7EB',
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
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 50,
  },
  dropdownText: {
    color: '#111827',
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
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  bottomSheetScroll: { maxHeight: 320 },
  bottomSheetScrollContent: { paddingHorizontal: 20, paddingBottom: 12 },
  bottomSheetItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 4,
    backgroundColor: '#F9FAFB',
  },
  bottomSheetItemText: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
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
    fontWeight: '600',
    color: '#6B7280',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    paddingHorizontal: 20,
  },
  cancelModalButton: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelModalButtonText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '600',
  },
  saveModalButton: {
    flex: 1,
    backgroundColor: '#3B82F6',
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

