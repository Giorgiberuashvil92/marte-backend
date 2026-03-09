import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  KeyboardAvoidingView,
  Keyboard,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  Dimensions,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { subscribeToLocation } from '../../utils/LocationBus';
import { Ionicons } from '@expo/vector-icons';
import { carBrandsApi } from '../../services/carBrandsApi';
import { addItemApi, DismantlerData, PartData, StoreData } from '../../services/addItemApi';
import { mechanicsApi } from '../../services/mechanicsApi';
import PhotoPicker from './PhotoPicker';
import { useUser } from '../../contexts/UserContext';
import { carwashLocationApi } from '../../services/carwashLocationApi';
import photoService from '../../services/photoService';
import ServicesConfig, { CarwashService } from './ServicesConfig';
import TimeSlotsConfig, { TimeSlotsConfig as TimeSlotsConfigType } from './TimeSlotsConfig';
import RealTimeStatusConfig, { RealTimeStatus } from './RealTimeStatusConfig';

const { width } = Dimensions.get('window');

export type AddModalType = 'dismantler' | 'part' | 'store' | 'carwash' | 'mechanic' | 'service';

export interface AddModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (type: AddModalType, data: any) => void;
  defaultType?: AddModalType;
  defaultFormData?: Record<string, any>;
}

interface AddModalStep {
  step: 'type-selection' | 'form';
  selectedType?: AddModalType;
}

const AddModal: React.FC<AddModalProps> = ({ visible, onClose, onSave, defaultType, defaultFormData }) => {
  const { user } = useUser();
  const [currentStep, setCurrentStep] = useState<AddModalStep>({ 
    step: defaultType ? 'form' : 'type-selection',
    selectedType: defaultType
  });
  const [formData, setFormData] = useState<any>({});
  const [showDropdown, setShowDropdown] = useState<string | null>(null);
  const [dismantlerTier, setDismantlerTier] = useState<'regular' | 'vip'>('regular');
  const [storeTier, setStoreTier] = useState<'regular' | 'vip'>('regular');
  const router = useRouter();
  const [hideModal, setHideModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const { updateUserRole, addToOwnedCarwashes } = useUser();
  
  // Car brands and models state
  const [carBrands, setCarBrands] = useState<string[]>([]);
  const [carModelsMap, setCarModelsMap] = useState<{ [key: string]: string[] }>({});

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
        setCarBrands(brands);
        setCarModelsMap(modelsMap);
      } catch (err) {
        console.error('Error loading car brands:', err);
      }
    };
    loadCarBrands();
  }, []);
  
  const resetModal = useCallback(() => {
    setCurrentStep({ 
      step: defaultType ? 'form' : 'type-selection',
      selectedType: defaultType
    });
    setFormData(defaultType ? (defaultFormData ?? {}) : {});
    setDismantlerTier('regular');
    setStoreTier('regular');
  }, [defaultType, defaultFormData]);
  
  useEffect(() => {
    if (defaultType) {
      setCurrentStep({ 
        step: 'form', 
        selectedType: defaultType 
      });
      setFormData(defaultFormData ?? {});
    } else {
      setCurrentStep({ 
        step: 'type-selection',
        selectedType: undefined
      });
      setFormData({});
    }
  }, [defaultType, defaultFormData]);
  
  // Reset form when modal opens
  useEffect(() => {
    if (visible) {
      resetModal();
    }
  }, [visible, resetModal]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent as any, (e: any) => {
      const h = e?.endCoordinates?.height ?? 0;
      setKeyboardHeight(h);
    });
    const hideSub = Keyboard.addListener(hideEvent as any, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);
  
  useEffect(() => {
    const unsub = subscribeToLocation((e) => {
      if (e?.type === 'LOCATION_PICKED') {
        setFormData((prev: any) => ({
          ...prev,
          latitude: e.payload.latitude,
          longitude: e.payload.longitude,
          address: e.payload.address || prev?.address || '',
        }));
        setHideModal(false);
      }
    });
    return unsub;
  }, []);

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const handleTypeSelect = (type: AddModalType) => {
    setCurrentStep({ step: 'form', selectedType: type });
    setFormData({});
  };

  const handleBack = () => {
    if (defaultType) {
      // If defaultType is provided, don't go back to type selection
      onClose();
    } else {
      setCurrentStep({ step: 'type-selection' });
      setFormData({});
    }
  };

  const handlePayment = () => {
    if (!currentStep.selectedType) return;
    
    const config = getFormConfig();
    const requiredFields = config.fields.filter(field => field.required);
    const missingFields = requiredFields.filter(field => !formData[field.key]);

    if (missingFields.length > 0) {
      const fieldLabels = missingFields.map(field => field.label).join(', ');
      Alert.alert('შეცდომა', `გთხოვთ შეავსოთ ყველა სავალდებულო ველი: ${fieldLabels}`);
      return;
    }

    if (currentStep.selectedType === 'dismantler') {
      if (formData.yearFrom && formData.yearTo && parseInt(formData.yearFrom) > parseInt(formData.yearTo)) {
        Alert.alert('შეცდომა', 'წლიდან არ შეიძლება იყოს უფრო დიდი ვიდრე წლამდე');
        return;
      }

      
      const dismantlerPrice = dismantlerTier === 'vip' ? 20 : 5; // VIP: 20₾,
      const orderId = `dismantler_${user?.id || 'guest'}_${Date.now()}`;
      
      router.push({
        pathname: '/payment-card',
        params: {
          amount: dismantlerPrice.toString(),
          description: dismantlerTier === 'vip' ? 'VIP დაშლილების განცხადების დამატება' : 'დაშლილების განცხადების დამატება',
          context: 'dismantler',
          orderId: orderId,
          isSubscription: 'false', // ეს არ არის subscription payment
          metadata: JSON.stringify({
            formData: formData,
            type: 'dismantler',
            tier: dismantlerTier,
            userId: user?.id,
          }),
        }
      });
      
      // დავხუროთ მოდალი
      handleClose();
      return;
    }

    if (currentStep.selectedType === 'store') {
      // მაღაზიის განცხადებისთვის გადახდა
      const storePrice = storeTier === 'vip' ? 20 : 5; // VIP: 20₾, ჩვეულებრივი: 5₾
      const orderId = `store_${user?.id || 'guest'}_${Date.now()}`;
      
      router.push({
        pathname: '/payment-card',
        params: {
          amount: storePrice.toString(),
          description: storeTier === 'vip' ? 'VIP მაღაზიის განცხადების დამატება' : 'მაღაზიის განცხადების დამატება',
          context: 'store',
          orderId: orderId,
          isSubscription: 'false', // ეს არ არის subscription payment
          metadata: JSON.stringify({
            formData: formData,
            type: 'store',
            tier: storeTier,
            userId: user?.id,
          }),
        }
      });
      
      // დავხუროთ მოდალი
      handleClose();
      return;
    }

    if (currentStep.selectedType === 'service') {
      // ავტოსერვისის განცხადებისთვის გადახდა (5₾)
      const servicePrice = 5;
      const orderId = `service_${user?.id || 'guest'}_${Date.now()}`;
      
      router.push({
        pathname: '/payment-card',
        params: {
          amount: servicePrice.toString(),
          description: 'ავტოსერვისის განცხადების დამატება',
          context: 'service',
          orderId: orderId,
          isSubscription: 'false', // ეს არ არის subscription payment
          metadata: JSON.stringify({
            formData: formData,
            type: 'service',
            userId: user?.id,
          }),
        }
      });
      
      // დავხუროთ მოდალი
      handleClose();
      return;
    }

    if (currentStep.selectedType === 'mechanic') {
      const mechanicPrice = 5;
      const orderId = `mechanic_${user?.id || 'guest'}_${Date.now()}`;
      
      router.push({
        pathname: '/payment-card',
        params: {
          amount: mechanicPrice.toString(),
          description: 'ხელოსნის განცხადების დამატება',
          context: 'mechanic',
          orderId: orderId,
          isSubscription: 'false', // ეს არ არის subscription payment
          metadata: JSON.stringify({
            formData: formData,
            type: 'mechanic',
            userId: user?.id,
          }),
        }
      });
      
      // დავხუროთ მოდალი
      handleClose();
      return;
    }
  };

  const handleSave = async () => {
    if (!currentStep.selectedType) return;
    
    const config = getFormConfig();
    const requiredFields = config.fields.filter(field => field.required);
    const missingFields = requiredFields.filter(field => !formData[field.key]);

    if (missingFields.length > 0) {
      const fieldLabels = missingFields.map(field => field.label).join(', ');
      Alert.alert('შეცდომა', `გთხოვთ შეავსოთ ყველა სავალდებულო ველი: ${fieldLabels}`);
      return;
    }

    if (currentStep.selectedType === 'dismantler') {
      if (formData.yearFrom && formData.yearTo && parseInt(formData.yearFrom) > parseInt(formData.yearTo)) {
        Alert.alert('შეცდომა', 'წლიდან არ შეიძლება იყოს უფრო დიდი ვიდრე წლამდე');
        return;
      }
    }

    try {
      setSaving(true);
      let response;
      
      let uploadedPhotos: string[] = [];
      if (formData.photos && formData.photos.length > 0) {
        setUploadProgress('ფოტოების ატვირთვა...');
        console.log('Uploading photos...');
        uploadedPhotos = await photoService.processPhotosForSaving(formData.photos, 'carappx');
      }
      
      let uploadedImages: string[] = [];
      if (formData.images && formData.images.length > 0) {
        setUploadProgress('სურათების ატვირთვა...');
        console.log('Uploading images...');
        uploadedImages = await photoService.processPhotosForSaving(formData.images, 'carappx');
      }
      
      setUploadProgress('მონაცემების შენახვა...');
      
      switch (currentStep.selectedType) {
        case 'dismantler':
          // Normalize phone number format
          let dismantlerNormalizedPhone = formData.phone;
          if (dismantlerNormalizedPhone && !dismantlerNormalizedPhone.startsWith('+995') && !dismantlerNormalizedPhone.startsWith('995')) {
            dismantlerNormalizedPhone = '+995' + dismantlerNormalizedPhone;
          }
          
          const dismantlerData: DismantlerData = {
            brand: formData.brand,
            model: formData.model,
            yearFrom: parseInt(formData.yearFrom),
            yearTo: parseInt(formData.yearTo),
            photos: uploadedPhotos,
            description: formData.description,
            location: formData.location,
            phone: dismantlerNormalizedPhone,
            name: formData.name,
            latitude: formData.latitude,
            longitude: formData.longitude,
            address: formData.address,
          };
          console.log('Sending dismantler data:', dismantlerData);
          console.log('User ID for dismantler:', user?.id);
          response = await addItemApi.createDismantler(dismantlerData, user?.id);
          console.log('Dismantler response:', response);
          break;
          
        case 'part':
          // Normalize phone number format
          let normalizedPhone = formData.phone;
          if (normalizedPhone && !normalizedPhone.startsWith('+995') && !normalizedPhone.startsWith('995')) {
            normalizedPhone = '+995' + normalizedPhone;
          }
          
          const partData: PartData = {
            title: formData.title,
            description: formData.description,
            category: formData.category,
            condition: formData.condition,
            price: formData.price,
            images: uploadedImages || [],
            seller: formData.name, // Using name as seller
            location: formData.location,
            phone: normalizedPhone,
            name: formData.name,
            brand: formData.brand,
            model: formData.model,
            year: formData.year ? parseInt(formData.year) : 0,
            partNumber: formData.partNumber,
            warranty: formData.warranty,
            isNegotiable: formData.isNegotiable || false,
            latitude: formData.latitude,
            longitude: formData.longitude,
            address: formData.address,
          };
          console.log('Sending part data:', partData);
          response = await addItemApi.createPart(partData);
          break;
          
        case 'store':
          // Normalize phone number format
          let storeNormalizedPhone = formData.phone;
          if (storeNormalizedPhone && !storeNormalizedPhone.startsWith('+995') && !storeNormalizedPhone.startsWith('995')) {
            storeNormalizedPhone = '+995' + storeNormalizedPhone;
          }
          
          const storeData: StoreData = {
            title: formData.title,
            description: formData.description,
            type: formData.type,
            images: uploadedImages,
            location: formData.location,
            address: formData.address,
            phone: storeNormalizedPhone,
            name: formData.name,
            ownerId: user?.id || 'demo-user', // Add ownerId from user context
            workingHours: formData.workingHours,
            // optional geo, if later added from map
            latitude: formData.latitude,
            longitude: formData.longitude,
          };
          console.log('Sending store data:', storeData);
          response = await addItemApi.createStore(storeData);
          break;
          
        case 'carwash':
          // Normalize phone number format
          let carwashNormalizedPhone = formData.phone;
          if (carwashNormalizedPhone && !carwashNormalizedPhone.startsWith('+995') && !carwashNormalizedPhone.startsWith('995')) {
            carwashNormalizedPhone = '+995' + carwashNormalizedPhone;
          }
          
          const carwashData = {
            name: formData.name,
            phone: carwashNormalizedPhone,
            category: formData.category,
            location: formData.location,
            address: formData.address,
            price: parseFloat(formData.price) || 0,
            rating: parseFloat(formData.rating) || 4.5,
            reviews: parseInt(formData.reviews) || 0,
            services: formData.services, // ძველი ველი - backward compatibility
            detailedServices: formData.detailedServices || [], // ახალი დეტალური სერვისები
            features: formData.features,
            workingHours: formData.workingHours, // ძველი ველი - backward compatibility
            timeSlotsConfig: formData.timeSlotsConfig || {
              workingDays: [],
              interval: 30,
              breakTimes: []
            }, // ახალი დროის სლოტების კონფიგურაცია
            realTimeStatus: formData.realTimeStatus || {
              isOpen: true,
              currentWaitTime: 10,
              currentQueue: 0,
              estimatedWaitTime: 10,
              lastStatusUpdate: Date.now()
            }, // რეალური დროის სტატუსი
            images: uploadedImages,
            description: formData.description,
            latitude: formData.latitude,
            longitude: formData.longitude,
            isOpen: true, // ძველი ველი - backward compatibility
            distance: 0, // Will be calculated on frontend
            ownerId: user?.id || '',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          console.log('Sending carwash data:', carwashData);
          
          // Create carwash in backend
          const createdCarwash = await carwashLocationApi.createLocation(carwashData);
          
          // Update user role to owner
          if (user?.role !== 'owner') {
            await updateUserRole('owner');
          }
          
          // Add to owned carwashes
          await addToOwnedCarwashes(createdCarwash.id);
          
          response = { 
            success: true, 
            message: 'სამრეცხაო წარმატებით დაემატა!',
            data: createdCarwash
          };
          break;
          
        case 'service':
          // Normalize phone number format
          let serviceNormalizedPhone = formData.phone;
          if (serviceNormalizedPhone && !serviceNormalizedPhone.startsWith('+995') && !serviceNormalizedPhone.startsWith('995')) {
            serviceNormalizedPhone = '+995' + serviceNormalizedPhone;
          }
          
          const serviceData = {
            name: formData.name,
            description: formData.description,
            category: formData.category || 'ავტოსერვისი',
            location: formData.location,
            address: formData.address,
            phone: serviceNormalizedPhone,
            images: uploadedImages,
            services: formData.services ? formData.services.split(',').map((s: string) => s.trim()) : [],
            workingHours: formData.workingHours,
            latitude: formData.latitude,
            longitude: formData.longitude,
            ownerId: user?.id || '',
            status: 'pending',
          };
          console.log('Sending service data:', serviceData);
          response = await addItemApi.createService(serviceData, user?.id);
          break;
          
        case 'mechanic':
          // Normalize phone number format
          let mechanicNormalizedPhone = formData.phone;
          if (mechanicNormalizedPhone && !mechanicNormalizedPhone.startsWith('+995') && !mechanicNormalizedPhone.startsWith('995')) {
            mechanicNormalizedPhone = '+995' + mechanicNormalizedPhone;
          }
          
          // Split name into firstName and lastName for backend compatibility
          const nameParts = formData.name.split(' ');
          const firstName = nameParts[0] || '';
          const lastName = nameParts.slice(1).join(' ') || 'მექანიკოსი'; // Default lastName if empty
          
          const mechanicData = {
            firstName: firstName,
            lastName: lastName,
            specialty: formData.specialty,
            location: formData.location,
            phone: mechanicNormalizedPhone,
            address: formData.address,
            experience: formData.experience,
            services: formData.services ? formData.services.split(',').map((s: string) => s.trim()) : [],
            avatar: uploadedPhotos.length > 0 ? uploadedPhotos[0] : '',
            description: formData.description,
            isAvailable: true,
            latitude: formData.latitude,
            longitude: formData.longitude,
          };
          console.log('Sending mechanic data:', mechanicData);
          const mechanicResponse = await mechanicsApi.createMechanic(mechanicData);
          console.log('Mechanic response:', mechanicResponse);
          response = { 
            success: true, 
            message: 'ხელოსანი წარმატებით დაემატა!',
            data: mechanicResponse
          };
          break;
          
        default:
          throw new Error('უცნობი ტიპი');
      }

      if (response.success) {
        Alert.alert(
          'წარმატება!',
          response.message,
          [
            {
              text: 'კარგი',
              onPress: () => {
                onSave(currentStep.selectedType!, response);
                handleClose();
              }
            }
          ]
        );
      } else {
        Alert.alert('შეცდომა', response.message);
      }
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert(
        'შეცდომა',
        'შენახვისას დაფიქსირდა შეცდომა. გთხოვთ სცადოთ თავიდან.'
      );
    } finally {
      setSaving(false);
      setUploadProgress('');
    }
  };

  const renderTypeSelection = () => (
    <>
      <View style={styles.header}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <View style={{ flex: 1 }}>
                <Text style={styles.headerTitle}>ახალი დამატება</Text>
                <Text style={styles.headerSubtitle}>აირჩიეთ რას ამატებთ</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
              <Ionicons name="close" size={24} color="#111827" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.contentContainer}
      >
        <View style={styles.typeGrid}>
          <TouchableOpacity 
            style={styles.typeCard} 
            onPress={() => handleTypeSelect('dismantler')}
            activeOpacity={0.95}
          >
            <View style={styles.typeIconContainer}>
              <Ionicons name="build" size={32} color="#3B82F6" />
            </View>
            <View style={styles.typeContent}>
              <Text style={styles.typeTitle}>დაშლილების განცხადება</Text>
              <Text style={styles.typeDescription}>ავტომობილის დაშლა და ნაწილების გაყიდვა</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.typeCard} 
            onPress={() => handleTypeSelect('part')}
            activeOpacity={0.95}
          >
            <View style={styles.typeIconContainer}>
              <Ionicons name="settings" size={32} color="#3B82F6" />
            </View>
            <View style={styles.typeContent}>
              <Text style={styles.typeTitle}>ნაწილი</Text>
              <Text style={styles.typeDescription}>ავტონაწილის გაყიდვა ან შეძენა</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.typeCard} 
            onPress={() => handleTypeSelect('store')}
            activeOpacity={0.95}
          >
            <View style={styles.typeIconContainer}>
              <Ionicons name="storefront" size={32} color="#3B82F6" />
            </View>
            <View style={styles.typeContent}>
              <Text style={styles.typeTitle}>მაღაზია</Text>
              <Text style={styles.typeDescription}>ავტონაწილების მაღაზიის რეგისტრაცია</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.typeCard} 
            onPress={() => handleTypeSelect('carwash')}
            activeOpacity={0.95}
          >
            <View style={styles.typeIconContainer}>
              <Ionicons name="car" size={32} color="#3B82F6" />
            </View>
            <View style={styles.typeContent}>
              <Text style={styles.typeTitle}>სამრეცხაო</Text>
              <Text style={styles.typeDescription}>სამრეცხაოს ლოკაციის დამატება</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.typeCard} 
            onPress={() => handleTypeSelect('mechanic')}
            activeOpacity={0.95}
          >
            <View style={styles.typeIconContainer}>
              <Ionicons name="construct" size={32} color="#10B981" />
            </View>
            <View style={styles.typeContent}>
              <Text style={styles.typeTitle}>ხელოსანი</Text>
              <Text style={styles.typeDescription}>მექანიკოსის ან ხელოსნის რეგისტრაცია</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </>
  );

  const getFormConfig = () => {
    const selectedBrand = formData.brand;
    const carModels = selectedBrand ? (carModelsMap[selectedBrand] || []) : [];
    
    switch (currentStep.selectedType) {
      case 'dismantler':
        return {
          title: 'დაშლილების განცხადება',
          icon: 'build',
          fields: [
              { key: 'name', label: 'გამყიდველის სახელი', type: 'text', required: true, placeholder: 'მაგ. ნიკა მელაძე' },
            { key: 'brand', label: 'ბრენდი', type: 'select', required: true, options: carBrands },
            { key: 'model', label: 'მოდელი', type: 'select', required: true, options: carModels, disabled: !selectedBrand },
            { key: 'yearFrom', label: 'წლიდან', type: 'text', required: true, placeholder: 'მაგ. 2015' },
            { key: 'yearTo', label: 'წლამდე', type: 'text', required: true, placeholder: 'მაგ. 2020' },
            { key: 'photos', label: 'ფოტოები', type: 'photo', required: false },
            { key: 'description', label: 'აღწერა', type: 'textarea', required: true, placeholder: 'მანქანის მდგომარეობა, რა ნაწილები გაყიდვაშია...' },
            { key: 'location', label: 'ქალაქი', type: 'select', required: true, options: ['თბილისი', 'ბათუმი', 'ქუთაისი', 'რუსთავი', 'გორი', 'ზუგდიდი', 'ფოთი', 'ახალქალაქი', 'ოზურგეთი', 'ტყიბული', 'სხვა'] },
            { key: 'address', label: 'რუკა არჩნს', type: 'location', required: false},
            { key: 'phone', label: 'ტელეფონის ნომერი', type: 'phone', required: true, placeholder: '+995 XXX XXX XXX' },
          ]
        };
      case 'part':
        return {
          title: 'ნაწილის დამატება',
          icon: 'settings',
          fields: [
            { key: 'name', label: 'გამყიდველის სახელი', type: 'text', required: true, placeholder: 'მაგ. ნიკა მელაძე' },
            { key: 'phone', label: 'ტელეფონის ნომერი', type: 'phone', required: true, placeholder: '+995 XXX XXX XXX' },
            { key: 'brand', label: 'მანქანის ბრენდი', type: 'select', required: true, options: carBrands },
            { key: 'model', label: 'მანქანის მოდელი', type: 'select', required: true, options: carModels, disabled: !selectedBrand },
            { key: 'year', label: 'მანქანის წელი', type: 'text', required: true, placeholder: 'მაგ. 2018' },
            { key: 'title', label: 'ნაწილის დასახელება', type: 'text', required: true, placeholder: 'მაგ. წინა ფარა, ძრავა, საბურავი' },
            { key: 'category', label: 'კატეგორია', type: 'select', required: true, options: ['ძრავა', 'ტრანსმისია', 'ფარები', 'საბურავები', 'ბლოკ-ფარები', 'ინტერიერი', 'ელექტრონიკა', 'სხვა'] },
            { key: 'condition', label: 'მდგომარეობა', type: 'select', required: true, options: ['ახალი', 'ძალიან კარგი', 'კარგი', 'დამაკმაყოფილებელი'] },
            { key: 'price', label: 'ფასი (ლარი)', type: 'text', required: true, placeholder: 'მაგ. 150' },
            { key: 'images', label: 'ფოტოები', type: 'photo', required: false },
            { key: 'location', label: 'ქალაქი', type: 'select', required: true, options: ['თბილისი', 'ბათუმი', 'ქუთაისი', 'რუსთავი', 'გორი', 'ზუგდიდი', 'ფოთი', 'ახალქალაქი', 'ოზურგეთი', 'ტყიბული', 'სხვა'] },
            { key: 'address', label: 'მისამართი', type: 'location', required: true, placeholder: 'დააჭირეთ "რუკა"-ს კოორდინატების დასამატებლად' },
            { key: 'description', label: 'აღწერა', type: 'textarea', required: true, placeholder: 'ნაწილის დეტალური აღწერა, მდგომარეობა, ფასდაკლების შესაძლებლობა...' },
          ]
        };
      case 'store':
        return {
          title: 'მაღაზიის რეგისტრაცია',
          icon: 'storefront',
          fields: [
            { key: 'name', label: 'კონტაქტი (სახელი)', type: 'text', required: true, placeholder: 'მაგ. ნიკა მელაძე' },
            { key: 'phone', label: 'ტელეფონის ნომერი', type: 'phone', required: true, placeholder: '+995 XXX XXX XXX' },
            { key: 'title', label: 'მაღაზიის სახელი', type: 'text', required: true, placeholder: 'მაგ. AutoParts.ge' },
            { key: 'type', label: 'მაღაზიის ტიპი', type: 'select', required: true, options: ['დეტეილინგი', 'ავტონაწილები', 'სამრეცხაო', 'ავტოსერვისი', 'სხვა'] },
            { key: 'images', label: 'ფოტოები', type: 'photo', required: false },
            { key: 'location', label: 'ქალაქი', type: 'select', required: true, options: ['თბილისი', 'ბათუმი', 'ქუთაისი', 'რუსთავი', 'გორი', 'ზუგდიდი', 'ფოთი', 'ახალქალაქი', 'ოზურგეთი', 'ტყიბული', 'სხვა'] },
            { key: 'address', label: 'მისამართი', type: 'location', required: false, placeholder: 'დააჭირეთ "რუკა"-ს კოორდინატების დასამატებლად' },
            { key: 'description', label: 'აღწერა', type: 'textarea', required: true, placeholder: 'მაღაზიის აღწერა, მიწოდებული პროდუქტები, სერვისები...' },
            { key: 'workingHours', label: 'სამუშაო საათები', type: 'text', required: false, placeholder: 'მაგ. 09:00-19:00 (ორშ-პარ)' },
          ]
        };
      case 'carwash':
        return {
          title: 'სამრეცხაოს დამატება',
          icon: 'car',
          fields: [
            { key: 'name', label: 'სამრეცხაოს სახელი', type: 'text', required: true, placeholder: 'მაგ. "ზედა" სამრეცხაო' },
            { key: 'phone', label: 'ტელეფონის ნომერი', type: 'phone', required: true, placeholder: '+995 XXX XXX XXX' },
            { key: 'category', label: 'კატეგორია', type: 'select', required: true, options: ['Premium', 'Express', 'Luxury', 'Standard', 'Professional'] },
            { key: 'location', label: 'ქალაქი', type: 'select', required: true, options: ['თბილისი', 'ბათუმი', 'ქუთაისი', 'რუსთავი', 'გორი', 'ზუგდიდი', 'ფოთი', 'ახალქალაქი', 'ოზურგეთი', 'ტყიბული', 'სხვა'] },
            { key: 'address', label: 'რუკა არჩნს', type: 'location', required: false, placeholder: 'დააჭირეთ "რუკა"-ს კოორდინატების დასამატებლად' },
            { key: 'price', label: 'ფასი (ლარი)', type: 'text', required: true, placeholder: 'მაგ. 25' },
            { key: 'rating', label: 'რეიტინგი', type: 'select', required: true, options: ['4.5', '4.6', '4.7', '4.8', '4.9', '5.0'] },
            { key: 'reviews', label: 'რევიუების რაოდენობა', type: 'text', required: true, placeholder: 'მაგ. 150' },
            { key: 'services', label: 'სერვისები', type: 'textarea', required: true, placeholder: 'შიდა/გარე რეცხვა, ზედაპირის დაცვა, ძრავის რეცხვა...' },
            { key: 'detailedServices', label: 'დეტალური სერვისები', type: 'services-config', required: false },
            { key: 'timeSlotsConfig', label: 'დროის სლოტების კონფიგურაცია', type: 'time-slots-config', required: false },
            { key: 'realTimeStatus', label: 'რეალური დროის სტატუსი', type: 'real-time-status-config', required: false },
            { key: 'features', label: 'ფუნქციები', type: 'textarea', required: false, placeholder: 'WiFi, ყავა, ლოჯი, ბავშვთა კუთხე...' },
            { key: 'workingHours', label: 'სამუშაო საათები', type: 'text', required: true, placeholder: 'მაგ. 08:00 - 20:00' },
            { key: 'images', label: 'ფოტოები', type: 'photo', required: false },
            { key: 'description', label: 'აღწერა', type: 'textarea', required: true, placeholder: 'სამრეცხაოს დეტალური აღწერა, სპეციალიზაცია, უპირატესობები...' },
          ]
        };
      case 'mechanic':
        return {
          title: 'ხელოსნის რეგისტრაცია',
          icon: 'construct',
          fields: [
            { key: 'name', label: 'ხელოსნის სახელი', type: 'text', required: true, placeholder: 'მაგ. ნიკა მელაძე' },
            { key: 'phone', label: 'ტელეფონის ნომერი', type: 'phone', required: true, placeholder: '+995 XXX XXX XXX' },
            { key: 'specialty', label: 'სპეციალობა', type: 'select', required: true, options: ['ძრავი', 'შემუშავება', 'ელექტრო', 'გადაცემა', 'დიაგნოსტიკა', 'ზოგადი'] },
            { key: 'location', label: 'ქალაქი', type: 'select', required: true, options: ['თბილისი', 'ბათუმი', 'ქუთაისი', 'რუსთავი', 'გორი', 'ზუგდიდი', 'ფოთი', 'ახალქალაქი', 'ოზურგეთი', 'ტყიბული', 'სხვა'] },
            { key: 'address', label: 'მისამართი', type: 'location', required: false, placeholder: 'დააჭირეთ "რუკა"-ს კოორდინატების დასამატებლად' },
            { key: 'experience', label: 'გამოცდილება', type: 'text', required: true, placeholder: 'მაგ. 5 წელი' },
            { key: 'services', label: 'სერვისები', type: 'textarea', required: true, placeholder: 'ძრავის შეკეთება, დიაგნოსტიკა, ელექტრო სისტემა...' },
            { key: 'avatar', label: 'ფოტო', type: 'photo', required: false },
            { key: 'description', label: 'აღწერა', type: 'textarea', required: true, placeholder: 'ხელოსნის დეტალური აღწერა, სპეციალიზაცია, უპირატესობები...' },
          ]
        };
      case 'service':
        return {
          title: 'ავტოსერვისის დამატება',
          icon: 'build',
          fields: [
            { key: 'name', label: 'სერვისის სახელი', type: 'text', required: true, placeholder: 'მაგ. ავტოსერვისი "პრემიუმ"' },
            { key: 'category', label: 'კატეგორია', type: 'select', required: true, options: ['ევაკუატორი', 'ავტოსერვისი', 'სამრეცხაო', 'დიაგნოსტიკა', 'შეკეთება', 'სხვა'] },
            { key: 'phone', label: 'ტელეფონის ნომერი', type: 'phone', required: true, placeholder: '+995 XXX XXX XXX' },
            { key: 'location', label: 'ქალაქი', type: 'select', required: true, options: ['თბილისი', 'ბათუმი', 'ქუთაისი', 'რუსთავი', 'გორი', 'ზუგდიდი', 'ფოთი', 'ახალქალაქი', 'ოზურგეთი', 'ტყიბული', 'სხვა'] },
            { key: 'address', label: 'მისამართი', type: 'location', required: false, placeholder: 'დააჭირეთ "რუკა"-ს კოორდინატების დასამატებლად' },
            { key: 'images', label: 'სურათები', type: 'photo', required: false },
            { key: 'services', label: 'სერვისების სია', type: 'textarea', required: true, placeholder: 'ძრავის შეკეთება, დიაგნოსტიკა, ელექტრო სისტემა...' },
            { key: 'workingHours', label: 'სამუშაო საათები', type: 'text', required: false, placeholder: 'მაგ. 09:00 - 18:00' },
            { key: 'description', label: 'აღწერა', type: 'textarea', required: true, placeholder: 'სერვისის დეტალური აღწერა, სპეციალიზაცია, უპირატესობები...' },
          ]
        };
      default:
        return { title: '', icon: 'add', fields: [] };
    }
  };

  const renderForm = () => {
    const config = getFormConfig();

    return (
      <>
        <View style={styles.header}>
          <SafeAreaView edges={['top']}>
            <View style={styles.headerContent}>
              <View style={styles.headerLeft}>
                {!defaultType && (
                  <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
                    <Ionicons name="arrow-back" size={24} color="#111827" />
                  </TouchableOpacity>
                )}
                <View style={styles.iconBadge}>
                  <Ionicons name={config.icon as any} size={24} color="#111827" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.headerTitle}>{config.title}</Text>
                  <Text style={styles.headerSubtitle}>შეავსეთ ინფორმაცია</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
                <Ionicons name="close" size={24} color="#111827" />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>

        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.contentContainer}
        >
          
          <View style={styles.formContainer}>
            {/* Dismantler Tier Selection - პირველ რიგში */}
            {currentStep.selectedType === 'dismantler' && (
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>
                  განცხადების დონე
                  <Text style={styles.required}> *</Text>
                </Text>
                <View style={styles.tierContainerHorizontal}>
                  <TouchableOpacity
                    style={[
                      styles.tierOptionHorizontal,
                      dismantlerTier === 'regular' && styles.tierOptionSelectedHorizontal
                    ]}
                    onPress={() => setDismantlerTier('regular')}
                    activeOpacity={0.8}
                  >
                    {dismantlerTier === 'regular' && (
                      <View style={styles.tierCheckmark}>
                        <Ionicons name="checkmark-circle" size={20} color="#111827" />
                      </View>
                    )}
                    <View style={styles.tierContentHorizontal}>
                      <Text style={[
                        styles.tierTitleHorizontal,
                        dismantlerTier === 'regular' && styles.tierTitleSelectedHorizontal
                      ]}>
                        ჩვეულებრივი
                      </Text>
                      <View style={styles.tierPriceContainer}>
                        <Text style={[
                          styles.tierPriceHorizontal,
                          dismantlerTier === 'regular' && styles.tierPriceSelectedHorizontal
                        ]}>
                          5₾
                        </Text>
                        <Text style={[
                          styles.tierPricePeriod,
                          dismantlerTier === 'regular' && styles.tierPricePeriodSelected
                        ]}>
                          თვეში
                        </Text>
                      </View>
                      <Text style={[
                        styles.tierDescriptionHorizontal,
                        dismantlerTier === 'regular' && styles.tierDescriptionSelectedHorizontal
                      ]}>
                        სტანდარტული
                      </Text>
                    </View>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.tierOptionHorizontal,
                      styles.tierOptionVipHorizontal,
                      dismantlerTier === 'vip' && styles.tierOptionSelectedVipHorizontal
                    ]}
                    onPress={() => setDismantlerTier('vip')}
                    activeOpacity={0.8}
                  >
                    {dismantlerTier === 'vip' && (
                      <View style={styles.tierCheckmark}>
                        <Ionicons name="checkmark-circle" size={20} color="#F59E0B" />
                      </View>
                    )}
                    <View style={styles.tierContentHorizontal}>
                      <View style={styles.vipBadgeHorizontal}>
                        <Ionicons name="star" size={12} color="#FFFFFF" />
                        <Text style={styles.vipBadgeTextHorizontal}>VIP</Text>
                      </View>
                      <Text style={[
                        styles.tierTitleHorizontal,
                        dismantlerTier === 'vip' && styles.tierTitleSelectedVipHorizontal
                      ]}>
                        VIP
                      </Text>
                      <View style={styles.tierPriceContainer}>
                        <Text style={[
                          styles.tierPriceHorizontal,
                          dismantlerTier === 'vip' && styles.tierPriceSelectedVipHorizontal
                        ]}>
                          20₾
                        </Text>
                        <Text style={[
                          styles.tierPricePeriod,
                          dismantlerTier === 'vip' && styles.tierPricePeriodSelectedVip
                        ]}>
                          თვეში
                        </Text>
                      </View>
                      <Text style={[
                        styles.tierDescriptionHorizontal,
                        dismantlerTier === 'vip' && styles.tierDescriptionSelectedVipHorizontal
                      ]}>
                        პრიორიტეტული
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Store Tier Selection - პირველ რიგში */}
            {currentStep.selectedType === 'store' && (
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>
                  განცხადების დონე
                  <Text style={styles.required}> *</Text>
                </Text>
                <View style={styles.tierContainerHorizontal}>
                  <TouchableOpacity
                    style={[
                      styles.tierOptionHorizontal,
                      storeTier === 'regular' && styles.tierOptionSelectedHorizontal
                    ]}
                    onPress={() => setStoreTier('regular')}
                    activeOpacity={0.8}
                  >
                    {storeTier === 'regular' && (
                      <View style={styles.tierCheckmark}>
                        <Ionicons name="checkmark-circle" size={20} color="#111827" />
                      </View>
                    )}
                    <View style={styles.tierContentHorizontal}>
                      <Text style={[
                        styles.tierTitleHorizontal,
                        storeTier === 'regular' && styles.tierTitleSelectedHorizontal
                      ]}>
                        ჩვეულებრივი
                      </Text>
                      <View style={styles.tierPriceContainer}>
                        <Text style={[
                          styles.tierPriceHorizontal,
                          storeTier === 'regular' && styles.tierPriceSelectedHorizontal
                        ]}>
                          5₾
                        </Text>
                        <Text style={[
                          styles.tierPricePeriod,
                          storeTier === 'regular' && styles.tierPricePeriodSelected
                        ]}>
                          თვეში
                        </Text>
                      </View>
                      <Text style={[
                        styles.tierDescriptionHorizontal,
                        storeTier === 'regular' && styles.tierDescriptionSelectedHorizontal
                      ]}>
                        სტანდარტული
                      </Text>
                    </View>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.tierOptionHorizontal,
                      styles.tierOptionVipHorizontal,
                      storeTier === 'vip' && styles.tierOptionSelectedVipHorizontal
                    ]}
                    onPress={() => setStoreTier('vip')}
                    activeOpacity={0.8}
                  >
                    {storeTier === 'vip' && (
                      <View style={styles.tierCheckmark}>
                        <Ionicons name="checkmark-circle" size={20} color="#F59E0B" />
                      </View>
                    )}
                    <View style={styles.tierContentHorizontal}>
                      <View style={styles.vipBadgeHorizontal}>
                        <Ionicons name="star" size={12} color="#FFFFFF" />
                        <Text style={styles.vipBadgeTextHorizontal}>VIP</Text>
                      </View>
                      <Text style={[
                        styles.tierTitleHorizontal,
                        storeTier === 'vip' && styles.tierTitleSelectedVipHorizontal
                      ]}>
                        VIP
                      </Text>
                      <View style={styles.tierPriceContainer}>
                        <Text style={[
                          styles.tierPriceHorizontal,
                          storeTier === 'vip' && styles.tierPriceSelectedVipHorizontal
                        ]}>
                          20₾
                        </Text>
                        <Text style={[
                          styles.tierPricePeriod,
                          storeTier === 'vip' && styles.tierPricePeriodSelectedVip
                        ]}>
                          თვეში
                        </Text>
                      </View>
                      <Text style={[
                        styles.tierDescriptionHorizontal,
                        storeTier === 'vip' && styles.tierDescriptionSelectedVipHorizontal
                      ]}>
                        პრიორიტეტული
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            
            {config.fields.map((field, index) => (
              <View key={field.key} style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>
                  {field.label}
                  {field.required && <Text style={styles.required}> *</Text>}
                </Text>
                
                {field.type === 'select' ? (
                  <TouchableOpacity 
                    style={[styles.selectInput, field.disabled && styles.selectInputDisabled]}
                    onPress={() => {
                      if (!field.disabled) {
                        setShowDropdown(field.key);
                      }
                    }}
                    disabled={field.disabled}
                  >
                    <Text style={[
                      styles.selectText, 
                      !formData[field.key] && styles.placeholder,
                      field.disabled && styles.selectTextDisabled
                    ]}>
                      {field.disabled && field.key === 'model' && !formData.brand ? 
                        'ჯერ აირჩიეთ ბრენდი' :
                        formData[field.key] || field.placeholder || `აირჩიეთ ${field.label.toLowerCase()}`
                      }
                    </Text>
                    <Ionicons 
                      name="chevron-down" 
                      size={20} 
                      color={field.disabled ? "#D1D5DB" : "#9CA3AF"} 
                    />
                  </TouchableOpacity>
                ) : field.type === 'photo' ? (
                  <PhotoPicker
                    onPhotosSelected={(photos) => {
                      setFormData({ ...formData, [field.key]: photos });
                    }}
                    maxPhotos={5}
                    folder="carappx"
                    initialPhotos={formData[field.key] || []}
                  />
                ) : field.type === 'services-config' ? (
                  <ServicesConfig
                    services={formData[field.key] || []}
                    onServicesChange={(services) => {
                      setFormData({ ...formData, [field.key]: services });
                    }}
                  />
                ) : field.type === 'time-slots-config' ? (
                  <TimeSlotsConfig
                    config={formData[field.key] || {
                      workingDays: [],
                      interval: 30,
                      breakTimes: []
                    }}
                    onConfigChange={(config) => {
                      setFormData({ ...formData, [field.key]: config });
                    }}
                  />
                ) : field.type === 'real-time-status-config' ? (
                  <RealTimeStatusConfig
                    status={formData[field.key] || {
                      isOpen: true,
                      currentWaitTime: 10,
                      currentQueue: 0,
                      estimatedWaitTime: 10,
                      lastStatusUpdate: Date.now()
                    }}
                    onStatusChange={(status) => {
                      setFormData({ ...formData, [field.key]: status });
                    }}
                  />
                ) : field.type === 'location' ? (
                  <View style={styles.locationContainer}>
                    <TextInput
                      style={styles.input}
                      value={formData[field.key] || ''}
                      onChangeText={(text) => setFormData({ ...formData, [field.key]: text })}
                      placeholder={field.placeholder || `შეიყვანეთ ${field.label.toLowerCase()}`}
                    />

                    {/* Show coordinates if location is picked */}
                    {(formData.latitude && formData.longitude) && (
                      <View style={styles.coordinatesContainer}>
                        <View style={styles.coordinatesRow}>
                          <Ionicons name="map" size={16} color="#111827" />
                          <Text style={styles.coordinatesLabel}>კოორდინატები:</Text>
                        </View>
                        <Text style={styles.coordinatesText}>
                          {formData.latitude.toFixed(6)}, {formData.longitude.toFixed(6)}
                        </Text>
                        <TouchableOpacity
                          style={styles.clearLocationBtn}
                          onPress={() => {
                            setFormData({
                              ...formData,
                              [field.key]: '',
                              latitude: undefined,
                              longitude: undefined,
                              address: undefined,
                            });
                          }}
                        >
                          <Ionicons name="close-circle" size={18} color="#EF4444" />
                          <Text style={styles.clearLocationText}>წაშლა</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ) : field.type === 'textarea' ? (
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={formData[field.key] || ''}
                    onChangeText={(text) => setFormData({ ...formData, [field.key]: text })}
                    placeholder={field.placeholder || `შეიყვანეთ ${field.label.toLowerCase()}`}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                ) : (
                  <TextInput
                    style={styles.input}
                    value={formData[field.key] || ''}
                    onChangeText={(text) => setFormData({ ...formData, [field.key]: text })}
                    placeholder={field.placeholder || `შეიყვანეთ ${field.label.toLowerCase()}`}
                    keyboardType={field.type === 'phone' ? 'phone-pad' : 'default'}
                  />
                )}
              </View>
            ))}
          </View>
        </ScrollView>

        <View style={[styles.bottomActionsWrap, { bottom: keyboardHeight }]}>
          <SafeAreaView edges={['bottom']} style={styles.bottomActions}>
          {currentStep.selectedType === 'dismantler' ? (
            <TouchableOpacity 
              style={styles.paymentBtn} 
              onPress={handlePayment}
            >
              <Ionicons name="card" size={20} color="#FFFFFF" />
              <Text style={styles.paymentBtnText}>
                გადახდა ({dismantlerTier === 'vip' ? '20' : '5'}₾/თვეში)
              </Text>
            </TouchableOpacity>
          ) : currentStep.selectedType === 'service' ? (
            <TouchableOpacity 
              style={styles.paymentBtn} 
              onPress={handlePayment}
            >
              <Ionicons name="card" size={20} color="#FFFFFF" />
              <Text style={styles.paymentBtnText}>
                გადახდა (5₾)
              </Text>
            </TouchableOpacity>
          ) : currentStep.selectedType === 'mechanic' ? (
            <TouchableOpacity 
              style={styles.paymentBtn} 
              onPress={handlePayment}
            >
              <Ionicons name="card" size={20} color="#FFFFFF" />
              <Text style={styles.paymentBtnText}>
                გადახდა (5₾/თვეში)
              </Text>
            </TouchableOpacity>
          ) : currentStep.selectedType === 'store' ? (
            <TouchableOpacity 
              style={styles.paymentBtn} 
              onPress={handlePayment}
            >
              <Ionicons name="card" size={20} color="#FFFFFF" />
              <Text style={styles.paymentBtnText}>
                გადახდა ({storeTier === 'vip' ? '20' : '5'}₾/თვეში)
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]} 
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <>
                  <ActivityIndicator size={20} color="#FFFFFF" />
                  <Text style={styles.saveBtnText}>შენახვა...</Text>
                </>
              ) : (
                <>
                  <Text style={styles.saveBtnText}>შენახვა</Text>
                  <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>
          )}
          </SafeAreaView>
        </View>

        {/* Dropdown Modal */}
        {showDropdown && (() => {
          const config = getFormConfig();
          const field = config.fields.find(f => f.key === showDropdown);
          if (!field || !field.options) return null;

          return (
            <Modal visible={true} transparent animationType="fade">
              <TouchableOpacity 
                style={styles.dropdownOverlay}
                activeOpacity={1}
                onPress={() => setShowDropdown(null)}
              >
                <View style={styles.dropdownModal}>
                  <View style={styles.dropdownHeader}>
                    <Text style={styles.dropdownTitle}>აირჩიეთ {field.label}</Text>
                    <TouchableOpacity onPress={() => setShowDropdown(null)}>
                      <Ionicons name="close" size={24} color="#111827" />
                    </TouchableOpacity>
                  </View>
                  <ScrollView
                    style={styles.dropdownList}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                  >
                    {field.options.map((option: any, index: number) => (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.dropdownOption,
                          formData[field.key] === option && styles.dropdownOptionSelected
                        ]}
                        onPress={() => {
                          const newFormData = { ...formData, [field.key]: option };
                          // If brand is changed, clear the model
                          if (field.key === 'brand' && formData.model) {
                            newFormData.model = '';
                          }
                          setFormData(newFormData);
                          setShowDropdown(null);
                        }}
                      >
                        <Text style={[
                          styles.dropdownOptionText,
                          formData[field.key] === option && styles.dropdownOptionTextSelected
                        ]}>
                          {option}
                        </Text>
                        {formData[field.key] === option && (
                          <Ionicons name="checkmark" size={20} color="#111827" />
                        )}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </TouchableOpacity>
            </Modal>
          );
        })()}

        {/* Map Modal */}
        {/* Subscribe to map picker selections */}
      </>
    );
  };

  return (
    <Modal visible={visible && !hideModal} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {currentStep.step === 'type-selection' ? renderTypeSelection() : renderForm()}
        
        {/* Upload Progress Overlay */}
        {saving && (
          <View style={styles.uploadOverlay}>
            <View style={styles.uploadModal}>
              <ActivityIndicator size="large" color="#111827" />
              <Text style={styles.uploadTitle}>ინფორმაციის შენახვა</Text>
              <Text style={styles.uploadProgress}>{uploadProgress}</Text>
              <Text style={styles.uploadNote}>გთხოვთ მოითმინოთ...</Text>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: '#6B7280',
    marginTop: 2,
    fontWeight: '500',
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
  },
  contentContainer: {
    paddingBottom: 140,
  },
  
  // Type Selection
  typeGrid: {
    paddingVertical: 20,
    gap: 12,
  },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  typeIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  typeContent: {
    flex: 1,
  },
  typeTitle: {
    fontSize: 15,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  typeDescription: {
    fontSize: 13,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: '#6B7280',
    fontWeight: '500',
    lineHeight: 18,
  },

  // Form
  formContainer: {
    paddingVertical: 20,
    gap: 16,
  },
  fieldContainer: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '600',
    color: '#111827',
  },
  required: {
    color: '#EF4444',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: '#111827',
    fontWeight: '500',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  selectInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectInputDisabled: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
    opacity: 0.6,
  },
  selectText: {
    fontSize: 15,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: '#111827',
    fontWeight: '500',
    flex: 1,
  },
  selectTextDisabled: {
    color: '#9CA3AF',
  },
  placeholder: {
    color: '#9CA3AF',
  },
  photoInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  photoContent: {
    alignItems: 'center',
    gap: 8,
  },
  photoText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  photoSubtext: {
    fontSize: 12,
    color: '#6B7280',
  },
  locationContainer: {
    gap: 8,
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderWidth: 1,
    borderColor: '#3B82F6',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 6,
  },
  mapButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
  },
  coordinatesContainer: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  coordinatesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  coordinatesLabel: {
    fontSize: 13,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '600',
    color: '#111827',
  },
  coordinatesText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#111827',
    marginBottom: 8,
  },
  clearLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  clearLocationText: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '500',
    color: '#EF4444',
  },

  // Dropdown Modal
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  dropdownModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxHeight: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 15,
  },
  dropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  dropdownTitle: {
    fontSize: 18,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#111827',
  },
  dropdownList: {
    maxHeight: 300,
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  dropdownOptionSelected: {
    backgroundColor: '#F3F4F6',
  },
  dropdownOptionText: {
    fontSize: 15,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: '#111827',
    fontWeight: '500',
    flex: 1,
  },
  dropdownOptionTextSelected: {
    color: '#111827',
    fontWeight: '700',
  },

  // Map Modal
  mapModalContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  mapModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  mapModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  mapConfirmBtn: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  mapConfirmText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  mapPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 16,
  },
  mapPlaceholderTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
  },
  mapPlaceholderText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  mapButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  mapLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  mapLocationText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#3B82F6',
  },
  mapSearchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  mapSearchText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },

  // Bottom Actions
  bottomActionsWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  bottomActions: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  saveBtnDisabled: {
    opacity: 0.7,
  },
  paymentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  paymentBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  
  // Tier Selection - Horizontal Layout
  tierContainerHorizontal: {
    flexDirection: 'row',
    gap: 12,
  },
  tierOptionHorizontal: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 140,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  tierOptionVipHorizontal: {
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  tierOptionSelectedHorizontal: {
    borderColor: '#111827',
    backgroundColor: '#F3F4F6',
    borderWidth: 2,
    shadowColor: '#111827',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  tierOptionSelectedVipHorizontal: {
    borderColor: '#111827',
    backgroundColor: '#F3F4F6',
    borderWidth: 2,
    shadowColor: '#111827',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  tierCheckmark: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  tierContentHorizontal: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  vipBadgeHorizontal: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
    marginBottom: 8,
  },
  vipBadgeTextHorizontal: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tierTitleHorizontal: {
    fontSize: 15,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
    textAlign: 'center',
  },
  tierTitleSelectedHorizontal: {
    color: '#111827',
  },
  tierTitleSelectedVipHorizontal: {
    color: '#111827',
  },
  tierPriceContainer: {
    alignItems: 'center',
    marginBottom: 4,
  },
  tierPriceHorizontal: {
    fontSize: 24,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
  },
  tierPriceSelectedHorizontal: {
    color: '#111827',
  },
  tierPriceSelectedVipHorizontal: {
    color: '#111827',
  },
  tierPricePeriod: {
    fontSize: 11,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: '#6B7280',
    fontWeight: '500',
    marginTop: 2,
  },
  tierPricePeriodSelected: {
    color: '#6B7280',
  },
  tierPricePeriodSelectedVip: {
    color: '#6B7280',
  },
  tierDescriptionHorizontal: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: '#6B7280',
    textAlign: 'center',
    fontWeight: '500',
  },
  tierDescriptionSelectedHorizontal: {
    color: '#6B7280',
  },
  tierDescriptionSelectedVipHorizontal: {
    color: '#6B7280',
  },
  
  // Upload Progress Overlay
  uploadOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  uploadModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    minWidth: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 15,
  },
  uploadTitle: {
    fontSize: 20,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  uploadProgress: {
    fontSize: 16,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '500',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  uploadNote: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: '#6B7280',
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 4,
  },
});

export default AddModal;
