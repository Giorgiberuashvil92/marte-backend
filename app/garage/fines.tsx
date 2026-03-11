import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  TextInput,
  ActivityIndicator,
  Alert,
  Linking,
  Dimensions,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCars } from '../../contexts/CarContext';
import { useUser } from '../../contexts/UserContext';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { useFines } from '../../contexts/FinesContext';
import { finesApi, Penalty } from '../../services/finesApi';
import SubscriptionModal from '../../components/ui/SubscriptionModal';

const { width } = Dimensions.get('window');

export default function FinesScreen() {
  const router = useRouter();
  const { cars, selectedCar, loading: carsLoading } = useCars();
  const { user } = useUser();
  const { isPremiumUser, subscription } = useSubscription();
  const {
    registeredVehicles,
    carFinesSubscriptions,
    carLimitInfo,
    finesDataLoading,
    effectiveRegisteredCars,
    effectiveMaxCars,
    effectiveCanRegisterMore,
    isVehicleRegistered,
    isCarMonitoringActive,
    getCarFines,
    checkFinesForCar,
    refreshFinesData,
  } = useFines();

  const [selectedCarId, setSelectedCarId] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [techPassportNumber, setTechPassportNumber] = useState('');
  const [initialCarSet, setInitialCarSet] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fines, setFines] = useState<Penalty[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);

  // პირველივე მანქანა დეფაულტად — cars მასივიდან (სადაც techPassport არის)
  useEffect(() => {
    if (initialCarSet || carsLoading) return;
    if (cars.length === 0) return;

    const freshSelectedCar = selectedCar
      ? cars.find(c => c.id === selectedCar.id)
      : null;
    const defaultCar = freshSelectedCar || cars[0];

    setSelectedCarId(defaultCar.id);
    setLicensePlate(defaultCar.plateNumber || '');
    setTechPassportNumber(defaultCar.techPassport || '');
    setInitialCarSet(true);
  }, [selectedCar, cars, initialCarSet, carsLoading]);

  // FinesContext-იდან ავტომატურად ჩატვირთული ჯარიმების სინქრონიზაცია
  useEffect(() => {
    if (!selectedCarId) return;
    const carFinesData = getCarFines(selectedCarId);
    if (carFinesData && carFinesData.lastChecked) {
      setFines(carFinesData.penalties);
      setHasSearched(true);
      setLoading(carFinesData.loading);
    }
  }, [selectedCarId, getCarFines]);

  // სხვა დივაისზე შესვლისას: როცა კონტექსტში ჯარიმების დატა ჯერ არ არის, ავტომატურად გავუშვათ შემოწმება
  const autoCheckedCarRef = useRef<string | null>(null);

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('ka-GE', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const formatCurrency = (amount: number) => {
    return `${(amount / 100).toLocaleString('ka-GE')} ₾`;
  };

  const handleRegisterVehicle = async () => {
    if (!licensePlate.trim()) {
      Alert.alert('შეცდომა', 'გთხოვთ შეიყვანოთ სახელმწიფო ნომერი');
      return;
    }

    if (!techPassportNumber.trim()) {
      Alert.alert('შეცდომა', 'გთხოვთ შეიყვანოთ ტექ. პასპორტის ნომერი');
      return;
    }

    if (!user?.id) {
      Alert.alert('შეცდომა', 'მომხმარებელი არ არის ავტორიზებული');
      return;
    }

    // შევამოწმოთ ლიმიტი frontend-ზეც
    if (!effectiveCanRegisterMore && !isVehicleRegistered(licensePlate)) {
      handleUpgradeFinesCars();
      return;
    }

    setRegistering(true);
    
    try {
      // ვიდეო ჯარიმებისთვის MediaFile = true
      const vehicleId = await finesApi.registerVehicle(
        user.id,
        licensePlate.trim().toUpperCase(),
        techPassportNumber.trim(),
        true // MediaFile - ვიდეო ჯარიმებისთვის
      );
      
      setIsRegistered(true);

      // ავტომატურად შევქმნათ მანქანის ჯარიმების გამოწერა
      try {
        await finesApi.createCarFinesSubscription(
          user.id,
          selectedCarId,
          licensePlate.trim().toUpperCase(),
          techPassportNumber.trim(),
        );
        console.log('✅ Car fines subscription created');
      } catch (subErr) {
        console.log('Could not create car fines subscription:', subErr);
      }

      // მონაცემების განახლება
      await refreshFinesData();

      Alert.alert(
        'წარმატება',
        `მანქანა წარმატებით დარეგისტრირდა (ID: ${vehicleId})`
      );
    } catch (error: any) {
      console.error('❌ Vehicle registration error:', error);
      const errorMessage = error?.message || 'მანქანის რეგისტრაცია ვერ მოხერხდა';
      
      // თუ 402 (Payment Required) - ლიმიტი ამოიწურა
      if (errorMessage.includes('ლიმიტი')) {
        Alert.alert(
          'მანქანების ლიმიტი ამოიწურა',
          errorMessage,
          [
            { text: 'გაუქმება', style: 'cancel' },
            { 
              text: 'გამოწერის განახლება', 
              onPress: () => handleUpgradeFinesCars(),
            },
          ]
        );
      } else {
        Alert.alert('შეცდომა', errorMessage);
      }
    } finally {
      setRegistering(false);
    }
  };

  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgrading, setUpgrading] = useState(false);

  const handleUpgradeFinesCars = () => {
    setShowUpgradeModal(true);
  };

  const handleRemoveVehicleFromFines = () => {
    if (!licensePlate?.trim()) return;
    if (!user?.id) return;
    Alert.alert(
      'სისტემიდან ამოღება',
      `დარწმუნებული ხართ, რომ გსურთ მანქანა ${licensePlate.trim().toUpperCase()} ჯარიმების სისტემიდან ამოღება? ჯარიმების მონიტორინგი გაუქმდება.`,
      [
        { text: 'გაუქმება', style: 'cancel' },
        {
          text: 'ამოღება',
          style: 'destructive',
          onPress: async () => {
            setRemoving(true);
            try {
              const result = await finesApi.removeVehicleFromFines(
                user.id,
                licensePlate.trim().toUpperCase(),
              );
              setIsRegistered(false);
              await refreshFinesData();
              Alert.alert('წარმატება', result.message || 'მანქანა სისტემიდან ამოღებულია');
            } catch (e: any) {
              Alert.alert('შეცდომა', e?.message || 'ამოღება ვერ მოხერხდა');
            } finally {
              setRemoving(false);
            }
          },
        },
      ]
    );
  };

  const confirmUpgrade = async () => {
    if (!user?.id || !selectedCarId || !licensePlate.trim()) {
      Alert.alert('შეცდომა', 'მანქანის მონაცემები არ არის');
      return;
    }

    setUpgrading(true);
    try {
      // ჯერ შევქმნათ CarFinesSubscription (pending სტატუსით)
      const result = await finesApi.createCarFinesSubscription(
        user.id,
        selectedCarId,
        licensePlate.trim().toUpperCase(),
        techPassportNumber.trim(),
      );

      const carFinesSubId = result.data?._id;

      // მოდალის დახურვა
      setShowUpgradeModal(false);

      // payment-card სქრინზე გადაყვანა BOG გადახდისთვის
      const orderId = `car_fines_${selectedCarId}_${user.id}_${Date.now()}`;
      
      router.push({
        pathname: '/payment-card',
        params: {
          amount: '1',
          description: `ჯარიმების მონიტორინგი - ${licensePlate.trim().toUpperCase()} (1₾/თვე)`,
          context: 'car_fines_subscription',
          orderId: orderId,
          isSubscription: 'true', // save_card-ისთვის
          planId: 'car_fines',
          planName: 'ჯარიმების მონიტორინგი',
          planPrice: '1',
          planCurrency: 'GEL',
          planDescription: `${licensePlate.trim().toUpperCase()} - ჯარიმების მონიტორინგი`,
          metadata: JSON.stringify({
            carFinesSubscriptionId: carFinesSubId,
            carId: selectedCarId,
            vehicleNumber: licensePlate.trim().toUpperCase(),
            techPassportNumber: techPassportNumber.trim(),
            userId: user.id,
          }),
        },
      });
    } catch (error: any) {
      console.error('❌ Upgrade error:', error);
      Alert.alert('შეცდომა', error?.message || 'გამოწერის შექმნა ვერ მოხერხდა');
    } finally {
      setUpgrading(false);
    }
  };

  // მანქანა დარეგისტრირებულია სისტემაში და ლიმიტში ეტევა?
  const isCurrentCarRegistered = isVehicleRegistered(licensePlate) || isRegistered;
  // მანქანის მონიტორინგი აქტიურია? (პრემიუმით დაფარულია ან ცალკე გამოწერა აქვს)
  const currentCarHasSubscription = selectedCarId
    ? isCarMonitoringActive(selectedCarId, licensePlate)
    : false;
  const canCheckFines = isPremiumUser && isCurrentCarRegistered && currentCarHasSubscription;

  // დებაგი: რა გვიბრუნდება ბაზიდან და რატომ ჩანს/არ ჩანს "დარეგისტრირებული"
  useEffect(() => {
    if (finesDataLoading || !licensePlate) return;
    const fromApi = isVehicleRegistered(licensePlate);
    console.log('🔍 [FINES DEBUG] registeredVehicles (ბაზიდან):', JSON.stringify(registeredVehicles, null, 2));
    console.log('🔍 [FINES DEBUG] მიმდინარე ნომერი:', licensePlate.trim().toUpperCase(), '| სხვა ფორმატი:', licensePlate);
    console.log('🔍 [FINES DEBUG] isVehicleRegistered(licensePlate):', fromApi, '| isRegistered (ლოკალური):', isRegistered);
    console.log('🔍 [FINES DEBUG] isCurrentCarRegistered:', isCurrentCarRegistered, '| currentCarHasSubscription:', currentCarHasSubscription, '| canCheckFines:', canCheckFines);
    console.log('🔍 [FINES DEBUG] carLimitInfo:', JSON.stringify(carLimitInfo));
    console.log('🔍 [FINES DEBUG] carFinesSubscriptions:', JSON.stringify(carFinesSubscriptions, null, 2));
  }, [finesDataLoading, registeredVehicles, licensePlate, isVehicleRegistered, isRegistered, isCurrentCarRegistered, currentCarHasSubscription, canCheckFines, carLimitInfo, carFinesSubscriptions]);

  // სხვა დივაისზე შესვლისას: როცა კონტექსტში ჯარიმების დატა ჯერ არ არის, ავტომატურად გავუშვათ შემოწმება
  useEffect(() => {
    if (finesDataLoading || !selectedCarId || !canCheckFines) return;
    if (!licensePlate?.trim() || !techPassportNumber?.trim()) return;
    const carFinesData = getCarFines(selectedCarId);
    if (carFinesData?.lastChecked != null) return;
    if (autoCheckedCarRef.current === selectedCarId) return;
    autoCheckedCarRef.current = selectedCarId;
    checkFinesForCar(selectedCarId, licensePlate.trim().toUpperCase(), techPassportNumber.trim());
  }, [finesDataLoading, selectedCarId, canCheckFines, licensePlate, techPassportNumber, getCarFines, checkFinesForCar]);

  const handleCheckFines = async () => {
    if (!isPremiumUser) {
      setShowSubscriptionModal(true);
      return;
    }

    if (!isCurrentCarRegistered) {
      Alert.alert(
        'რეგისტრაცია საჭიროა',
        'ჯარიმების შესამოწმებლად ჯერ მანქანა სისტემაში უნდა დარეგისტრირდეს.',
        [{ text: 'გასაგებია' }]
      );
      return;
    }

    // შევამოწმოთ მანქანას აქვს თუ არა აქტიური მონიტორინგი (პრემიუმით ან გამოწერით)
    if (!currentCarHasSubscription) {
      const pendingSub = carFinesSubscriptions.find(
        s => s.carId === selectedCarId && s.status === 'pending' && !s.isPaid
      );
      if (pendingSub) {
        const orderId = `car_fines_${selectedCarId}_${user?.id}_${Date.now()}`;
        router.push({
          pathname: '/payment-card',
          params: {
            amount: pendingSub.price.toString(),
            description: `ჯარიმების მონიტორინგი - ${licensePlate.trim().toUpperCase()} (${pendingSub.price}₾/თვე)`,
            context: 'car_fines_subscription',
            orderId: orderId,
            isSubscription: 'true',
            planId: 'car_fines',
            planName: 'ჯარიმების მონიტორინგი',
            planPrice: pendingSub.price.toString(),
            planCurrency: 'GEL',
            planDescription: `${licensePlate.trim().toUpperCase()} - ჯარიმების მონიტორინგი`,
            metadata: JSON.stringify({
              carFinesSubscriptionId: pendingSub._id,
              carId: selectedCarId,
              vehicleNumber: licensePlate.trim().toUpperCase(),
              techPassportNumber: techPassportNumber.trim(),
              userId: user?.id,
            }),
          },
        });
      } else {
        handleUpgradeFinesCars();
      }
      return;
    }

    if (!licensePlate.trim() || !techPassportNumber.trim()) {
      Alert.alert('შეცდომა', 'გთხოვთ შეიყვანოთ ნომერი და ტექ. პასპორტი');
      return;
    }

    setLoading(true);
    setHasSearched(true);
    
    try {
      const penalties = await checkFinesForCar(
        selectedCarId,
        licensePlate.trim().toUpperCase(),
        techPassportNumber.trim()
      );
      setFines(penalties);
    } catch (error: any) {
      console.error('❌ Fines check error:', error);
      Alert.alert('შეცდომა', error?.message || 'ჯარიმების შემოწმებისას მოხდა შეცდომა');
      setFines([]);
    } finally {
      setLoading(false);
    }
  };

  const handleViewMedia = async (penalty: Penalty) => {
    try {
      setLoading(true);
      const mediaFiles = await finesApi.getPenaltyMediaFiles(
        penalty.automobileNumber,
        penalty.techPassportNumber,
        penalty.protocolId
      );
      
      if (mediaFiles.length === 0) {
        Alert.alert('ინფორმაცია', 'ვიდეო ჯარიმები არ არის ხელმისაწვდომი');
        return;
      }

      // TODO: Implement media viewer
      Alert.alert('ვიდეო ჯარიმები', `ნაპოვნია ${mediaFiles.length} ვიდეო ფაილი`);
    } catch (error: any) {
      console.error('Media fetch error:', error);
      Alert.alert('შეცდომა', 'ვიდეო ჯარიმების ჩამოტვირთვა ვერ მოხერხდა');
    } finally {
      setLoading(false);
    }
  };

  // სანამ მანქანები და ჯარიმების მონაცემები ჩაიტვირთება — ლოადერი
  if (carsLoading || finesDataLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.topBar}>
          <View style={styles.topBarContent}>
            <TouchableOpacity
              style={styles.topBarButton}
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={24} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.topBarTitle}>ჯარიმების შემოწმება</Text>
            <View style={styles.topBarSpacer} />
          </View>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', fontFamily: 'HelveticaMedium', marginBottom: 8, textAlign: 'center' }}>
            გთხოვთ დაელოდოთ
          </Text>
          <Text style={{ fontSize: 13, color: '#6B7280', fontFamily: 'HelveticaMedium', marginBottom: 20, textAlign: 'center' }}>
            მონაცემები იტვირთება...
          </Text>
          <ActivityIndicator size="large" color="#6366F1" />
        </View>
      </SafeAreaView>
    );
  }

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
          <Text style={styles.topBarTitle}>ჯარიმების შემოწმება</Text>
          <View style={styles.topBarSpacer} />
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Premium Status Banner */}
        {isPremiumUser ? (
          <View style={styles.premiumBanner}>
            <View style={styles.premiumBannerLeft}>
              <Ionicons name="diamond" size={22} color="#F59E0B" />
              <View style={{ flex: 1 }}>
                <Text style={styles.premiumBannerTitle}>Premium აქტიურია</Text>
                <Text style={styles.premiumBannerSubtitle}>ჯარიმების შემოწმება ხელმისაწვდომია</Text>
              </View>
            </View>
            <Ionicons name="checkmark-circle" size={22} color="#22C55E" />
          </View>
        ) : (
          <TouchableOpacity
            style={styles.upgradeBanner}
            onPress={() => setShowSubscriptionModal(true)}
            activeOpacity={0.8}
          >
            <View style={styles.upgradeBannerLeft}>
              <View style={styles.upgradeBannerIcon}>
                <Ionicons name="lock-closed" size={22} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.upgradeBannerTitle}>Premium საჭიროა</Text>
                <Text style={styles.upgradeBannerSubtitle}>
                  ჯარიმების შემოწმება მხოლოდ Premium მომხმარებლებისთვისაა ხელმისაწვდომი
                </Text>
              </View>
            </View>
            <View style={styles.upgradeButton}>
              <Text style={styles.upgradeButtonText}>გააქტიურება</Text>
              <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
        )}

        {/* Car Selector */}
        {cars.length > 0 && (
          <View style={styles.carSelectorSection}>
            <Text style={styles.inputLabel}>აირჩიე მანქანა</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carSelectorScroll}
            >
              {[...cars]
                .sort((a, b) => {
                  const finesA = getCarFines(a.id)?.penalties?.length ?? 0;
                  const finesB = getCarFines(b.id)?.penalties?.length ?? 0;
                  return finesB - finesA;
                })
                .map((car) => {
                const isSelected = selectedCarId === car.id;
                const carFinesData = getCarFines(car.id);
                const finesCount = carFinesData?.penalties?.length ?? 0;
                const showFinesBadge = finesCount > 0;
                return (
                  <TouchableOpacity
                    key={car.id}
                    style={[
                      styles.carSelectorCard,
                      isSelected && styles.carSelectorCardActive,
                    ]}
                    onPress={() => {
                      autoCheckedCarRef.current = null;
                      setSelectedCarId(car.id);
                      setLicensePlate(car.plateNumber || '');
                      setTechPassportNumber(car.techPassport || '');
                      const existingFines = getCarFines(car.id);
                      if (existingFines && existingFines.lastChecked) {
                        setFines(existingFines.penalties);
                        setHasSearched(true);
                      } else {
                        setFines([]);
                        setHasSearched(false);
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.carSelectorCardIconRow}>
                      <Ionicons
                        name="car-sport"
                        size={20}
                        color={isSelected ? '#FFFFFF' : '#6B7280'}
                      />
                      {showFinesBadge && (
                        <View style={styles.carFinesBadge}>
                          <Text style={styles.carFinesBadgeText}>
                            {finesCount > 99 ? '99+' : finesCount}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text
                      style={[
                        styles.carSelectorBrand,
                        isSelected && styles.carSelectorTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {car.make} {car.model}
                    </Text>
                    <Text
                      style={[
                        styles.carSelectorPlate,
                        isSelected && styles.carSelectorPlateActive,
                      ]}
                      numberOfLines={1}
                    >
                      {car.plateNumber}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Car Limit Info - Compact */}
        {isPremiumUser && (
          <View style={styles.carLimitCard}>
            <View style={styles.carLimitRow}>
              <Ionicons name="shield-checkmark" size={16} color="#6366F1" />
              <Text style={styles.carLimitTitle}>
                მანქანა: {effectiveRegisteredCars}/{effectiveMaxCars}
              </Text>
              <View style={styles.carLimitProgressBg}>
                <View
                  style={[
                    styles.carLimitProgressFill,
                    {
                      width: `${Math.min((effectiveRegisteredCars / effectiveMaxCars) * 100, 100)}%`,
                      backgroundColor: effectiveCanRegisterMore ? '#22C55E' : '#EF4444',
                    },
                  ]}
                />
              </View>
              {!effectiveCanRegisterMore && (
                <TouchableOpacity
                  style={styles.carLimitUpgradeBtn}
                  onPress={handleUpgradeFinesCars}
                  activeOpacity={0.8}
                >
                  <Text style={styles.carLimitUpgradeBtnText}>
                    +{carLimitInfo?.additionalCarPrice || 1}₾
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Registration Status */}
        {isRegistered && (
          <View style={styles.successCard}>
            <Ionicons name="checkmark-circle" size={24} color="#22C55E" />
            <Text style={styles.successText}>
              მანქანა წარმატებით დარეგისტრირდა სისტემაში
            </Text>
          </View>
        )}

        {/* License Plate Input */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>სახელმწიფო ნომერი</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="car" size={20} color="#6B7280" />
            <TextInput
              style={styles.input}
              placeholder="მაგ: TB-123-AB"
              placeholderTextColor="#9CA3AF"
              value={licensePlate}
              onChangeText={setLicensePlate}
              autoCapitalize="characters"
              maxLength={10}
            />
          </View>

          <Text style={[styles.inputLabel, { marginTop: 16 }]}>ტექ. პასპორტის ნომერი</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="document-text" size={20} color="#6B7280" />
            <TextInput
              style={styles.input}
              placeholder="ტექ. პასპორტის ნომერი"
              placeholderTextColor="#9CA3AF"
              value={techPassportNumber}
              onChangeText={setTechPassportNumber}
              autoCapitalize="characters"
            />
          </View>

          {/* Register Vehicle Button - მხოლოდ თუ მანქანა ჯერ არ არის დარეგისტრირებული */}
          {isPremiumUser && !isVehicleRegistered(licensePlate) && !isRegistered && (
            <TouchableOpacity
              style={[
                styles.registerButton,
                (registering || loading) && styles.checkButtonDisabled,
              ]}
              onPress={handleRegisterVehicle}
              disabled={registering || loading}
              activeOpacity={0.8}
            >
              {registering ? (
                <>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.registerButtonText}>რეგისტრაცია...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="add-circle" size={20} color="#FFFFFF" />
                  <Text style={styles.registerButtonText}>
                    მანქანის რეგისტრაცია სისტემაში
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* მანქანა უკვე დარეგისტრირებულია ინდიკატორი + სისტემიდან ამოღება */}
          {isPremiumUser && (isVehicleRegistered(licensePlate) || isRegistered) && (
            <View style={styles.registeredBadgeRow}>
              <View style={styles.registeredBadge}>
                <Ionicons name="checkmark-circle" size={18} color="#22C55E" />
                <Text style={styles.registeredBadgeText}>მანქანა სისტემაში დარეგისტრირებულია</Text>
              </View>
              <TouchableOpacity
                style={styles.removeFromFinesButton}
                onPress={handleRemoveVehicleFromFines}
                disabled={removing || registering}
                activeOpacity={0.7}
              >
                {removing ? (
                  <ActivityIndicator size="small" color="#DC2626" />
                ) : (
                  <>
                    <Ionicons name="trash-outline" size={16} color="#DC2626" />
                    <Text style={styles.removeFromFinesButtonText}>ჯარიმების ფუნქციონალის წაშლა</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* მანქანის მონიტორინგის სტატუსი */}
          {isPremiumUser && isCurrentCarRegistered && selectedCarId && (
            <View style={[
              styles.registeredBadge,
              { backgroundColor: currentCarHasSubscription ? '#F0FDF4' : '#FEF2F2', marginBottom: 12 }
            ]}>
              <Ionicons
                name={currentCarHasSubscription ? 'shield-checkmark' : 'alert-circle-outline'}
                size={18}
                color={currentCarHasSubscription ? '#22C55E' : '#EF4444'}
              />
              <Text style={[
                styles.registeredBadgeText,
                { color: currentCarHasSubscription ? '#15803D' : '#DC2626' }
              ]}>
                {currentCarHasSubscription
                  ? 'მონიტორინგი აქტიურია ✓'
                  : `ლიმიტი ამოიწურა — საჭიროა 1₾/თვე გამოწერა`}
              </Text>
            </View>
          )}

          {/* Check Fines Button */}
          <TouchableOpacity
            style={[
              styles.checkButton,
              (loading || !canCheckFines) && styles.checkButtonDisabled,
            ]}
            onPress={handleCheckFines}
            disabled={loading || registering}
            activeOpacity={0.8}
          >
            {loading ? (
              <>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.checkButtonText}>შემოწმება...</Text>
              </>
            ) : (
              <>
                {!isPremiumUser && <Ionicons name="lock-closed" size={18} color="#FFFFFF" />}
                {isPremiumUser && !isCurrentCarRegistered && <Ionicons name="alert-circle" size={18} color="#FFFFFF" />}
                <Ionicons name="search" size={20} color="#FFFFFF" />
                <Text style={styles.checkButtonText}>
                  {!isPremiumUser
                    ? 'ჯარიმების შემოწმება'
                    : !isCurrentCarRegistered
                    ? 'ჯერ დაარეგისტრირე'
                    : 'ჯარიმების შემოწმება'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Results */}
        {hasSearched && !loading && (
          <View style={styles.resultsSection}>
            {fines.length === 0 ? (
              <View style={styles.emptyResults}>
                <Ionicons name="checkmark-circle" size={64} color="#22C55E" />
                <Text style={styles.emptyResultsTitle}>ჯარიმები არ მოიძებნა</Text>
                <Text style={styles.emptyResultsSubtitle}>
                  ამ საბარათე ნომერზე არ არის დარეგისტრირებული ჯარიმები
                </Text>
              </View>
            ) : (
              <View style={styles.finesList}>
                <Text style={styles.resultsTitle}>
                  ნაპოვნი ჯარიმები ({fines.length})
                </Text>
                {fines.map((penalty, index) => (
                  <View key={penalty.protocolId || index} style={styles.fineCard}>
                    <View style={styles.fineHeader}>
                      <View style={styles.fineIconContainer}>
                        <Ionicons name="warning" size={20} color="#EF4444" />
                      </View>
                      <View style={styles.fineContent}>
                        <Text style={styles.fineAmount}>
                          {formatCurrency(penalty.finalAmount)}
                        </Text>
                        <Text style={styles.fineDate}>
                          {formatDate(penalty.penaltyDate)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.fineDetails}>
                      <View style={styles.fineDetailRow}>
                        <Text style={styles.fineDetailLabel}>ჯარიმის ნომერი:</Text>
                        <Text style={styles.fineDetailValue}>{penalty.penaltyNumber}</Text>
                      </View>

                      <View style={styles.fineDetailRow}>
                        <Text style={styles.fineDetailLabel}>ტიპი:</Text>
                        <Text style={styles.fineDetailValue}>{penalty.penaltyTypeName}</Text>
                      </View>

                      <View style={styles.fineDetailRow}>
                        <Text style={styles.fineDetailLabel}>მუხლი:</Text>
                        <Text style={styles.fineDetailValue}>
                          {penalty.code} - {penalty.codeName}
                        </Text>
                      </View>

                      <View style={styles.fineDetailRow}>
                        <Text style={styles.fineDetailLabel}>ჯარიმის თანხა:</Text>
                        <Text style={styles.fineDetailValue}>
                          {formatCurrency(penalty.penaltyAmountValue)}
                        </Text>
                      </View>

                      {penalty.fineAmountValue > 0 && (
                        <View style={styles.fineDetailRow}>
                          <Text style={styles.fineDetailLabel}>საურავი:</Text>
                          <Text style={[styles.fineDetailValue, { color: '#EF4444' }]}>
                            {formatCurrency(penalty.fineAmountValue)}
                          </Text>
                        </View>
                      )}

                      <View style={styles.fineDetailRow}>
                        <Text style={styles.fineDetailLabel}>სტატუსი:</Text>
                        <View style={[
                          styles.statusBadge,
                          penalty.isPayable && styles.statusBadgePayable
                        ]}>
                          <Text style={styles.statusText}>{penalty.stateName}</Text>
                        </View>
                      </View>

                      {penalty.isDiscountable && (
                        <View style={styles.discountInfo}>
                          <Ionicons name="pricetag" size={16} color="#22C55E" />
                          <Text style={styles.discountText}>
                            ფასდაკლება ხელმისაწვდომია {penalty.finalDiscountDate && formatDate(penalty.finalDiscountDate)}-მდე
                          </Text>
                        </View>
                      )}

                      {penalty.finalPaymentDate && (
                        <View style={styles.fineDetailRow}>
                          <Text style={styles.fineDetailLabel}>გადახდის ბოლო თარიღი:</Text>
                          <Text style={[
                            styles.fineDetailValue,
                            new Date(penalty.finalPaymentDate) < new Date() && { color: '#EF4444', fontWeight: '700' }
                          ]}>
                            {formatDate(penalty.finalPaymentDate)}
                          </Text>
                        </View>
                      )}

                      <View style={styles.fineDetailRow}>
                        <Text style={styles.fineDetailLabel}>რეგიონი:</Text>
                        <Text style={styles.fineDetailValue}>
                          {penalty.regionName} - {penalty.raionName}
                        </Text>
                      </View>

                      {penalty.restriction && (
                        <View style={styles.restrictionBox}>
                          <Text style={styles.restrictionText}>{penalty.restriction}</Text>
                        </View>
                      )}

                      {penalty.isPublished && (
                        <TouchableOpacity
                          style={styles.mediaButton}
                          onPress={() => handleViewMedia(penalty)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="videocam" size={18} color="#6366F1" />
                          <Text style={styles.mediaButtonText}>ვიდეო ჯარიმების ნახვა</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

       
      </ScrollView>

      {/* Subscription Modal */}
      <SubscriptionModal
        visible={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
        onSuccess={() => setShowSubscriptionModal(false)}
      />

      {/* Upgrade Cars Modal */}
      <Modal
        visible={showUpgradeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUpgradeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Modal Header Icon */}
            <View style={styles.modalIconCircle}>
              <Ionicons name="car-sport" size={32} color="#6366F1" />
            </View>

            <Text style={styles.modalTitle}>დამატებითი მანქანა</Text>
            <Text style={styles.modalSubtitle}>
              გაზარდე ჯარიმების მონიტორინგის ლიმიტი
            </Text>

            {/* Current Status */}
            <View style={styles.modalStatusCard}>
              <View style={styles.modalStatusRow}>
                <Text style={styles.modalStatusLabel}>ამჟამინდელი ლიმიტი</Text>
                <Text style={styles.modalStatusValue}>{effectiveMaxCars} მანქანა</Text>
              </View>
              <View style={styles.modalStatusDivider} />
              <View style={styles.modalStatusRow}>
                <Text style={styles.modalStatusLabel}>დარეგისტრირებული</Text>
                <Text style={styles.modalStatusValue}>{effectiveRegisteredCars} მანქანა</Text>
              </View>
              <View style={styles.modalStatusDivider} />
              <View style={styles.modalStatusRow}>
                <Text style={styles.modalStatusLabel}>განახლების შემდეგ</Text>
                <Text style={[styles.modalStatusValue, { color: '#22C55E' }]}>
                  {effectiveMaxCars + 1} მანქანა
                </Text>
              </View>
            </View>

            {/* Price */}
            <View style={styles.modalPriceCard}>
              <Text style={styles.modalPriceLabel}>თვიური ფასი</Text>
              <View style={styles.modalPriceRow}>
                <Text style={styles.modalPriceAmount}>+{carLimitInfo?.additionalCarPrice || 1}</Text>
                <Text style={styles.modalPriceCurrency}>₾/თვე</Text>
              </View>
              <Text style={styles.modalPriceHint}>ყოველი დამატებითი მანქანისთვის</Text>
            </View>

            {/* Buttons */}
            <TouchableOpacity
              style={[styles.modalConfirmBtn, upgrading && { opacity: 0.6 }]}
              onPress={confirmUpgrade}
              disabled={upgrading}
              activeOpacity={0.8}
            >
              {upgrading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                  <Text style={styles.modalConfirmBtnText}>დადასტურება</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setShowUpgradeModal(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.modalCancelBtnText}>გაუქმება</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  topBarSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  carInfo: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
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
  carSelectorSection: {
    marginBottom: 16,
  },
  carSelectorScroll: {
    gap: 10,
    paddingVertical: 4,
  },
  carSelectorCard: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    minWidth: 120,
    gap: 4,
  },
  carSelectorCardIconRow: {
    position: 'relative',
  },
  carFinesBadge: {
    position: 'absolute',
    top: -8,
    right: -12,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  carFinesBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  carSelectorCardActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  carSelectorBrand: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
  },
  carSelectorTextActive: {
    color: '#FFFFFF',
  },
  carSelectorPlate: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
  },
  carSelectorPlateActive: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  premiumBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  premiumBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  premiumBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400E',
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
  },
  premiumBannerSubtitle: {
    fontSize: 12,
    color: '#A16207',
    fontFamily: 'HelveticaMedium',
    marginTop: 2,
  },
  upgradeBanner: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  upgradeBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  upgradeBannerIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  upgradeBannerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
  },
  upgradeBannerSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    fontFamily: 'HelveticaMedium',
    marginTop: 4,
    lineHeight: 18,
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#6366F1',
    borderRadius: 10,
    paddingVertical: 12,
  },
  upgradeButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
  },
  registeredBadgeRow: {
    marginBottom: 12,
    gap: 8,
  },
  registeredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 0,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  removeFromFinesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  removeFromFinesButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#DC2626',
  },
  registeredBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#166534',
    fontFamily: 'HelveticaMedium',
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  successCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  successText: {
    flex: 1,
    fontSize: 14,
    color: '#166534',
    fontFamily: 'HelveticaMedium',
    fontWeight: '600',
  },
  infoIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
  },
  infoText: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
    fontFamily: 'HelveticaMedium',
  },
  inputSection: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
    gap: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
  },
  registerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#6366F1',
    borderRadius: 12,
    paddingVertical: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  registerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
  },
  checkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  checkButtonDisabled: {
    opacity: 0.6,
  },
  checkButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
  },
  resultsSection: {
    marginBottom: 24,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
  },
  emptyResults: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 32,
  },
  emptyResultsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
  },
  emptyResultsSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: 'HelveticaMedium',
  },
  finesList: {
    gap: 12,
  },
  fineCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  fineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  fineIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fineContent: {
    flex: 1,
  },
  fineAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#EF4444',
    fontFamily: 'HelveticaMedium',
  },
  fineDate: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
    fontFamily: 'HelveticaMedium',
  },
  fineDescription: {
    fontSize: 14,
    color: '#111827',
    marginBottom: 8,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
  },
  fineSource: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
  },
  featuresSection: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
  },
  featuresList: {
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  featureText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
  },
  fineDetails: {
    marginTop: 12,
    gap: 8,
  },
  fineDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  fineDetailLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontFamily: 'HelveticaMedium',
    flex: 1,
  },
  fineDetailValue: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '600',
    fontFamily: 'HelveticaMedium',
    flex: 1,
    textAlign: 'right',
  },
  statusBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgePayable: {
    backgroundColor: '#FEE2E2',
  },
  statusText: {
    fontSize: 12,
    color: '#111827',
    fontWeight: '600',
    fontFamily: 'HelveticaMedium',
  },
  discountInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    padding: 10,
    borderRadius: 8,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  discountText: {
    fontSize: 12,
    color: '#166534',
    fontFamily: 'HelveticaMedium',
    flex: 1,
  },
  restrictionBox: {
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  restrictionText: {
    fontSize: 12,
    color: '#92400E',
    fontFamily: 'HelveticaMedium',
    lineHeight: 18,
  },
  mediaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EEF2FF',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  mediaButtonText: {
    fontSize: 13,
    color: '#6366F1',
    fontWeight: '600',
    fontFamily: 'HelveticaMedium',
  },
  // Car Limit Card Styles (Compact)
  carLimitCard: {
    backgroundColor: '#F5F3FF',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  carLimitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  carLimitTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    fontFamily: 'HelveticaMedium',
  },
  carLimitUpgradeBtn: {
    backgroundColor: '#6366F1',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  carLimitUpgradeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'HelveticaMedium',
  },
  carLimitProgressBg: {
    flex: 1,
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  carLimitProgressFill: {
    height: '100%',
    borderRadius: 3,
  },

  // Upgrade Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 28,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
  },
  modalIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'HelveticaMedium',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalStatusCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 16,
    width: '100%',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modalStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  modalStatusLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontFamily: 'HelveticaMedium',
  },
  modalStatusValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    fontFamily: 'HelveticaMedium',
  },
  modalStatusDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 4,
  },
  modalPriceCard: {
    backgroundColor: '#F5F3FF',
    borderRadius: 14,
    padding: 20,
    width: '100%',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  modalPriceLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  modalPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  modalPriceAmount: {
    fontSize: 36,
    fontWeight: '800',
    color: '#6366F1',
    fontFamily: 'HelveticaMedium',
  },
  modalPriceCurrency: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6366F1',
    fontFamily: 'HelveticaMedium',
  },
  modalPriceHint: {
    fontSize: 11,
    color: '#9CA3AF',
    fontFamily: 'HelveticaMedium',
    marginTop: 4,
  },
  modalConfirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#111827',
    borderRadius: 14,
    paddingVertical: 16,
    width: '100%',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  modalConfirmBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
  },
  modalCancelBtn: {
    paddingVertical: 12,
    width: '100%',
    alignItems: 'center',
  },
  modalCancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA3AF',
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
  },
});
