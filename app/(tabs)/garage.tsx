import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  StatusBar,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCars } from '../../contexts/CarContext';
import { useToast } from '../../contexts/ToastContext';
import { useFines } from '../../contexts/FinesContext';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

interface UICar {
  id: string;
  brand: string;
  model: string;
  year: string;
  licensePlate: string;
  image?: string;
  fuelType: string;
  color: string;
}


export default function GarageScreen() {
  const router = useRouter();
  const { cars: apiCars, selectCar: apiSelectCar, reminders, fuelEntries, serviceHistory, removeCar } = useCars();
  const { success } = useToast();
  const { isPremiumUser } = useSubscription();
  const { 
    getCarFines, 
    getTotalFinesCount, 
    getTotalUnpaidFines, 
    finesDataLoading,
    isVehicleRegistered,
    isCarMonitoringActive,
    carFinesMap,
  } = useFines();

  const [cars, setCars] = useState<UICar[]>([]);
  const [selectedCar, setSelectedCar] = useState<UICar | null>(null);
  const [currentCarIndex, setCurrentCarIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  const sortedCars = useMemo(() => {
    return [...cars].sort((a, b) => {
      const finesA = getCarFines(a.id)?.penalties?.length ?? 0;
      const finesB = getCarFines(b.id)?.penalties?.length ?? 0;
      return finesB - finesA;
    });
  }, [cars, carFinesMap, getCarFines]);

  const selectedCarIndexInSorted = selectedCar
    ? sortedCars.findIndex((c) => c.id === selectedCar.id)
    : 0;
  const effectiveCarIndex = selectedCarIndexInSorted >= 0 ? selectedCarIndexInSorted : 0;

  // API -> UI mapping
  useEffect(() => {
    const mappedCars: UICar[] = (apiCars || []).map((c) => ({
      id: c.id,
      brand: c.make,
      model: c.model,
      year: String(c.year ?? ''),
      licensePlate: c.plateNumber,
      image: c.imageUri || undefined,
      fuelType: 'ბენზინი',
      color: '#3B82F6',
    }));
    setCars(mappedCars);

    if (mappedCars.length > 0 && !selectedCar) {
      setSelectedCar(mappedCars[0]);
      apiSelectCar({
        id: mappedCars[0].id,
        make: mappedCars[0].brand,
        model: mappedCars[0].model,
        year: parseInt(mappedCars[0].year || '0'),
        plateNumber: mappedCars[0].licensePlate,
        imageUri: mappedCars[0].image || '',
      } as any);
    }
  }, [apiCars]);

  const handleCarSelect = (car: UICar, index: number) => {
    setSelectedCar(car);
    setCurrentCarIndex(index);
    apiSelectCar({
      id: car.id,
      make: car.brand,
      model: car.model,
      year: parseInt(car.year || '0'),
      plateNumber: car.licensePlate,
      imageUri: car.image || '',
    } as any);
    
    // Scroll to selected car
    const cardWidth = width * 0.85 + 16;
    scrollViewRef.current?.scrollTo({
      x: index * cardWidth,
      animated: true,
    });
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const cardWidth = width * 0.85 + 16;
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / cardWidth);
    if (index >= 0 && index < sortedCars.length) {
      setCurrentCarIndex(index);
      const car = sortedCars[index];
      if (car) {
        setSelectedCar(car);
        apiSelectCar({
          id: car.id,
          make: car.brand,
          model: car.model,
          year: parseInt(car.year || '0'),
          plateNumber: car.licensePlate,
          imageUri: car.image || '',
        } as any);
      }
    }
  };

  const getFallbackCarImage = (make?: string) => {
    const carImages: { [key: string]: string } = {
      'BMW': 'https://images.unsplash.com/photo-1555215695-3004980ad54e?q=80&w=1600&auto=format&fit=crop',
      'Mercedes-Benz': 'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?q=80&w=1600&auto=format&fit=crop',
      'Audi': 'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?q=80&w=1600&auto=format&fit=crop',
      'Toyota': 'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?q=80&w=1600&auto=format&fit=crop',
      'Honda': 'https://images.unsplash.com/photo-1525609004556-c46c7d6cf023?q=80&w=1600&auto=format&fit=crop',
      'Land Rover': 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=1600&auto=format&fit=crop',
      'Lexus': 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=1600&auto=format&fit=crop',
      'Nissan': 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=1600&auto=format&fit=crop',
      'Ford': 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=1600&auto=format&fit=crop',
      'Volkswagen': 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=1600&auto=format&fit=crop',
      'Hyundai': 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=1600&auto=format&fit=crop',
      'Kia': 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=1600&auto=format&fit=crop',
      'Mazda': 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=1600&auto=format&fit=crop',
      'Subaru': 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=1600&auto=format&fit=crop',
      
    };
    if (make && carImages[make]) return carImages[make];
    return 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=1600&auto=format&fit=crop';
  };

  const carReminders = selectedCar 
    ? reminders.filter(r => r.carId === selectedCar.id)
    : [];

  const carFuelEntries = selectedCar
    ? fuelEntries.filter(f => f.carId === selectedCar.id)
    : [];

  const renderCategoryContent = () => {
    if (!selectedCar) return null;

    return (
      <View style={styles.categoryContent}>
            {/* Fines Banner */}
            {(() => {
              const currentCarFines = selectedCar ? getCarFines(selectedCar.id) : null;
              const currentFinesCount = currentCarFines?.penalties?.length || 0;
              const currentFinesAmount = currentCarFines?.penalties?.reduce((sum, p) => sum + (p.finalAmount || 0), 0) || 0;
              const totalFinesCount = getTotalFinesCount();
              const totalFinesAmount = getTotalUnpaidFines();
              const hasFines = totalFinesCount > 0;
              const isMonitoring = selectedCar && isPremiumUser && isCarMonitoringActive(selectedCar.id, selectedCar.licensePlate || '');

              if (hasFines) {
                return (
                  <TouchableOpacity
                    style={styles.finesBannerAlert}
                    onPress={() => router.push('/garage/fines')}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={['#DC2626', '#991B1B']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.finesBannerGradient}
                    >
                      <View style={styles.finesBannerContent}>
                        <View style={styles.finesBannerLeft}>
                          <View style={styles.finesBannerAlertIconContainer}>
                            <Ionicons name="alert-circle" size={28} color="#FFFFFF" />
                          </View>
                          <View style={styles.finesBannerTextContainer}>
                            <Text style={styles.finesBannerTitle}>
                              {currentFinesCount > 0 
                                ? `${currentFinesCount} ჯარიმა` 
                                : `${totalFinesCount} ჯარიმა სულ`}
                            </Text>
                            <Text style={styles.finesBannerAmountText}>
                              {currentFinesCount > 0
                                ? `${(currentFinesAmount / 100).toFixed(2)} ₾`
                                : `${(totalFinesAmount / 100).toFixed(2)} ₾`}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.finesBannerBadge}>
                          <Text style={styles.finesBannerBadgeText}>ნახვა</Text>
                          <Ionicons name="chevron-forward" size={14} color="#DC2626" />
                        </View>
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                );
              }

              return (
                <TouchableOpacity
                  style={styles.finesBanner}
                  onPress={() => router.push('/garage/fines')}
                  activeOpacity={0.8}
                >
                  <View style={styles.finesBannerContent}>
                    <View style={styles.finesBannerLeft}>
                      <View style={styles.finesBannerIconContainer}>
                        {isMonitoring ? (
                          <Ionicons name="shield-checkmark" size={24} color="#FFFFFF" />
                        ) : (
                          <Ionicons name="warning" size={24} color="#FFFFFF" />
                        )}
                      </View>
                      <View style={styles.finesBannerTextContainer}>
                        <Text style={styles.finesBannerTitle}>
                          {isMonitoring ? 'ჯარიმები არ მოიძებნა' : 'ჯარიმების შემოწმება'}
                        </Text>
                        <Text style={styles.finesBannerSubtitle}>
                          {isMonitoring ? 'მონიტორინგი აქტიურია ✓' : 'შეამოწმე შსს და მერიის ჯარიმები'}
                        </Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
                  </View>
                </TouchableOpacity>
              );
            })()}

            {/* Quick Stats - Clickable */}
            <View style={styles.statsGrid}>
              <TouchableOpacity 
                style={styles.statCard}
                onPress={() => router.push('/garage/reminders')}
                activeOpacity={0.7}
              >
                <Ionicons name="calendar-outline" size={24} color="#3B82F6" />
                <Text style={styles.statValue}>{carReminders.length}</Text>
                <Text style={styles.statLabel}>შეხსენება</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.statCard}
                onPress={() => router.push('/garage/service')}
                activeOpacity={0.7}
              >
                <Ionicons name="build-outline" size={24} color="#10B981" />
                <Text style={styles.statValue}>
                  {selectedCar ? serviceHistory.filter(s => s.carId === selectedCar.id).length : 0}
                </Text>
                <Text style={styles.statLabel}>სერვისი</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.statCard}
                onPress={() => router.push('/garage/documents')}
                activeOpacity={0.7}
              >
                <Ionicons name="document-outline" size={24} color="#F59E0B" />
                <Text style={styles.statValue}>0</Text>
                <Text style={styles.statLabel}>დოკუმენტი</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.statCard}
                onPress={() => router.push('/garage/fuel')}
                activeOpacity={0.7}
              >
                <Ionicons name="water-outline" size={24} color="#8B5CF6" />
                <Text style={styles.statValue}>{carFuelEntries.length}</Text>
                <Text style={styles.statLabel}>საწვავი</Text>
              </TouchableOpacity>
            </View>

            {/* Active Fines for this car */}
            {(() => {
              if (!selectedCar) return null;
              const carFinesData = getCarFines(selectedCar.id);
              const penalties = carFinesData?.penalties || [];
              if (penalties.length === 0) return null;

              return (
                <View style={styles.upcomingSection}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>აქტიური ჯარიმები</Text>
                    {penalties.length > 3 && (
                      <TouchableOpacity
                        onPress={() => router.push('/garage/fines')}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.seeAllText}>ყველას ნახვა</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <View style={styles.remindersList}>
                    {penalties.slice(0, 3).map((penalty, index) => {
                      const penaltyDate = new Date(penalty.penaltyDate);
                      const formattedDate = penaltyDate.toLocaleDateString('ka-GE', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      });
                      const amount = (penalty.finalAmount || 0) / 100;
                      const isPayable = penalty.isPayable;

                      return (
                        <TouchableOpacity
                          key={`fine-${penalty.protocolId || index}`}
                          style={styles.fineCard}
                          onPress={() => router.push('/garage/fines')}
                          activeOpacity={0.7}
                        >
                          <View style={styles.fineIconContainer}>
                            <Ionicons name="document-text" size={22} color="#DC2626" />
                          </View>
                          <View style={styles.reminderContent}>
                            <View style={styles.reminderHeaderRow}>
                              <Text style={styles.fineTitle} numberOfLines={1}>
                                {penalty.penaltyTypeName || 'ჯარიმა'}
                              </Text>
                              <View style={[
                                styles.reminderStatusBadge, 
                                { backgroundColor: isPayable ? '#FEE2E2' : '#FEF3C7' }
                              ]}>
                                <Ionicons 
                                  name={isPayable ? 'alert-circle' : 'time'} 
                                  size={12} 
                                  color={isPayable ? '#DC2626' : '#F59E0B'} 
                                />
                                <Text style={[
                                  styles.reminderStatusText, 
                                  { color: isPayable ? '#DC2626' : '#F59E0B' }
                                ]}>
                                  {isPayable ? 'გადასახდელი' : 'მოლოდინში'}
                                </Text>
                              </View>
                            </View>
                            <View style={styles.fineMetaRow}>
                              <View style={styles.reminderDateContainer}>
                                <Ionicons name="calendar-outline" size={12} color="#6B7280" />
                                <Text style={styles.reminderDate}>{formattedDate}</Text>
                              </View>
                              <Text style={styles.fineAmount}>{amount.toFixed(2)} ₾</Text>
                            </View>
                          </View>
                          <View style={styles.reminderRight}>
                            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              );
            })()}

            {/* Upcoming Reminders */}
            {carReminders.length > 0 && (
              <View style={styles.upcomingSection}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>მომავალი შეხსენებები</Text>
                  {carReminders.length > 3 && (
                    <TouchableOpacity
                      onPress={() => router.push('/garage/reminders')}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.seeAllText}>ყველას ნახვა</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <View style={styles.remindersList}>
                  {carReminders.slice(0, 3).map((reminder) => {
                    const now = new Date();
                    let reminderDate = new Date(reminder.reminderDate);
                    let isPast = false;
                    let daysUntil = 0;
                    
                    // Recurring reminder-ებისთვის შევამოწმოთ endDate
                    if (reminder.recurringInterval && reminder.recurringInterval !== 'none') {
                      if (reminder.endDate) {
                        const endDate = new Date(reminder.endDate);
                        isPast = endDate < now;
                        daysUntil = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                      } else if (reminder.startDate) {
                        const startDate = new Date(reminder.startDate);
                        isPast = false;
                        daysUntil = Math.ceil((startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        } else {
                        isPast = reminderDate < now;
                        daysUntil = Math.ceil((reminderDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                      }
        } else {
                      isPast = reminderDate < now;
                      daysUntil = Math.ceil((reminderDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    }
                    
                    const getTypeIcon = (type: string) => {
                      switch (type) {
                        case 'service': return 'build';
                        case 'oil': return 'water';
                        case 'tires': return 'disc';
                        case 'battery': return 'battery-half';
                        case 'inspection': return 'search';
                        case 'carwash': return 'water';
                        case 'insurance': return 'shield';
                        case 'fuel': return 'car';
                        case 'parts': return 'construct';
                        default: return 'alarm';
                      }
                    };

                    const getPriorityColor = (priority: string) => {
                      switch (priority) {
                        case 'high': return '#EF4444';
                        case 'medium': return '#F59E0B';
                        default: return '#3B82F6';
                      }
                    };

                    const getStatusInfo = () => {
                      if (reminder.isCompleted) {
                        return {
                          text: 'შესრულებულია',
                          color: '#22C55E',
                          bgColor: '#D1FAE5',
                          icon: 'checkmark-circle',
                        };
                      }
                      if (isPast) {
                        return {
                          text: 'გავიდა',
                          color: '#EF4444',
                          bgColor: '#FEE2E2',
                          icon: 'close-circle',
                        };
                      }
                      if (daysUntil === 0) {
                        return {
                          text: 'დღეს',
                          color: '#F59E0B',
                          bgColor: '#FEF3C7',
                          icon: 'time',
                        };
                      }
                      if (daysUntil === 1) {
                        return {
                          text: 'ხვალ',
                          color: '#F59E0B',
                          bgColor: '#FEF3C7',
                          icon: 'calendar',
                        };
                      }
                      if (daysUntil <= 7) {
                        return {
                          text: `${daysUntil} დღე`,
                          color: '#3B82F6',
                          bgColor: '#DBEAFE',
                          icon: 'calendar',
                        };
                      }
                      return {
                        text: `${daysUntil} დღე`,
                        color: '#6B7280',
                        bgColor: '#F3F4F6',
                        icon: 'calendar-outline',
                      };
                    };

                    const statusInfo = getStatusInfo();
                    const priorityColor = getPriorityColor(reminder.priority);

                    return (
                      <TouchableOpacity
                        key={reminder.id}
                        style={styles.reminderCard}
                        onPress={() => router.push(`/garage/reminders/${reminder.id}`)}
                        activeOpacity={0.7}
                      >
                        <View style={[
                          styles.reminderIconContainer,
                          { backgroundColor: `${priorityColor}15` }
                        ]}>
                          <Ionicons
                            name={getTypeIcon(reminder.type) as any}
                            size={24}
                            color={priorityColor}
                          />
                        </View>
                        <View style={styles.reminderContent}>
                          <View style={styles.reminderHeaderRow}>
                            <Text style={styles.reminderTitle} numberOfLines={1}>
                              {reminder.title}
                            </Text>
                            <View style={[styles.reminderStatusBadge, { backgroundColor: statusInfo.bgColor }]}>
                              <Ionicons name={statusInfo.icon as any} size={12} color={statusInfo.color} />
                              <Text style={[styles.reminderStatusText, { color: statusInfo.color }]}>
                                {statusInfo.text}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.reminderMeta}>
                            <View style={styles.reminderDateContainer}>
                              <Ionicons name="calendar-outline" size={12} color="#6B7280" />
                              <Text style={styles.reminderDate}>
                                {reminderDate.toLocaleDateString('ka-GE', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric'
                                })}
                              </Text>
                            </View>
                            {reminder.reminderTime && (
                              <View style={styles.reminderTimeContainer}>
                                <Ionicons name="time-outline" size={12} color="#6B7280" />
                                <Text style={styles.reminderTime}>{reminder.reminderTime}</Text>
                                {reminder.reminderTime2 && (
                                  <Text style={styles.reminderTime}> და {reminder.reminderTime2}</Text>
                                )}
                              </View>
                            )}
                          </View>
                          {reminder.recurringInterval && reminder.recurringInterval !== 'none' && (
                            <View style={styles.reminderRecurringInfo}>
                              <Ionicons name="repeat" size={12} color="#6B7280" />
                              <Text style={styles.reminderRecurringText}>
                                {reminder.recurringInterval === 'daily' ? 'ყოველდღე' :
                                 reminder.recurringInterval === 'weekly' ? 'ყოველ კვირაში' :
                                 reminder.recurringInterval === 'monthly' ? 'ყოველ თვეში' :
                                 reminder.recurringInterval === 'yearly' ? 'ყოველ წელს' :
                                 reminder.recurringInterval}
                              </Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.reminderRight}>
                          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          </View>
    );
  };


  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header */}
      <View style={styles.topBar}>
        <View style={styles.topBarContent}>
          <View style={styles.topBarSpacer} />
          <Text style={styles.topBarTitle}>ჩემი ფარეხი</Text>
          <TouchableOpacity
            style={styles.topBarButton}
            onPress={() => router.push('/add-car')}
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
        {/* Empty State */}
        {cars.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="car-outline" size={64} color="#9CA3AF" />
            </View>
            <Text style={styles.emptyTitle}>ჯერ მანქანა არ გაქვს დამატებული</Text>
            <Text style={styles.emptySubtitle}>
              დაამატე პირველი მანქანა და მართე ყველაფერი ერთი ეკრანიდან
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => router.push('/add-car')}
            >
              <Ionicons name="add" size={20} color="#FFFFFF" />
              <Text style={styles.emptyButtonText}>მანქანის დამატება</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Car Cards */}
            <ScrollView 
              ref={scrollViewRef}
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carsHorizontalScroll}
              style={styles.carsScrollView}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              pagingEnabled={false}
              snapToInterval={width * 0.85 + 16}
              decelerationRate="fast"
            >
              {sortedCars.map((car, index) => {
                const finesCount = getCarFines(car.id)?.penalties?.length ?? 0;
                const showFinesBadge = finesCount > 0;
                return (
                <TouchableOpacity
                  key={car.id}
                  style={[
                    styles.carCard,
                    selectedCar?.id === car.id && styles.carCardSelected,
                  ]}
                  onPress={() => handleCarSelect(car, index)}
                  activeOpacity={0.8}
                >
                  {car.image ? (
                    <Image
                      source={{ uri: car.image }}
                      style={styles.carImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <Image
                      source={{ uri: getFallbackCarImage(car.brand) }}
                      style={styles.carImage}
                      resizeMode="cover"
                    />
                  )}
                  
                  <View style={styles.carOverlay}>
                    <View style={styles.carTopRow}>
                      <View style={styles.carInfo}>
                        <View style={styles.carInfoTitleRow}>
                          <Text style={styles.carBrand}>{car.brand}</Text>
                          {showFinesBadge && (
                            <View style={styles.finesBadge}>
                              <Text style={styles.finesBadgeText}>
                                {finesCount > 99 ? '99+' : finesCount} ჯარიმა
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.carModel}>{car.model}</Text>
                        <Text style={styles.carYear}>{car.year}</Text>
                      </View>
                      <View style={styles.carActions}>
                        <TouchableOpacity
                          style={styles.carActionButton}
                          onPress={(e) => {
                            e.stopPropagation();
                            router.push(`/edit-car?id=${car.id}` as any);
                          }}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="create-outline" size={18} color="#FFFFFF" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.carActionButton, styles.carDeleteButton]}
                          onPress={(e) => {
                            e.stopPropagation();
                            Alert.alert(
                              'მანქანის წაშლა',
                              `ნამდვილად გსურთ ${car.brand} ${car.model}-ის წაშლა?`,
                              [
                                { text: 'გაუქმება', style: 'cancel' },
                                {
                                  text: 'წაშლა',
                                  style: 'destructive',
                                  onPress: async () => {
                                    try {
                                      await removeCar(car.id);
                                      success('მანქანა წარმატებით წაიშალა');
                                    } catch (err) {
                                      Alert.alert('შეცდომა', 'მანქანის წაშლა ვერ მოხერხდა');
                                    }
                                  },
                                },
                              ]
                            );
                          }}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                    </View>
                    
                    <View style={styles.carDetails}>
                      <View style={styles.carDetailItem}>
                        <Ionicons name="pricetag-outline" size={14} color="#FFFFFF" />
                        <Text style={styles.carDetailText}>{car.licensePlate}</Text>
                      </View>
                      <View style={styles.carDetailItem}>
                        <Ionicons name="water-outline" size={14} color="#FFFFFF" />
                        <Text style={styles.carDetailText}>{car.fuelType}</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
                );
              })}

              {/* Add Car Card - Inside ScrollView */}
              <TouchableOpacity
                style={styles.addCarCardHorizontal}
                onPress={() => router.push('/add-car')}
                activeOpacity={0.8}
              >
                <Ionicons name="add-circle-outline" size={48} color="#9CA3AF" />
                <Text style={styles.addCarText}>მანქანის დამატება</Text>
              </TouchableOpacity>
            </ScrollView>

            {/* Car Indicators */}
            {sortedCars.length > 0 && (
              <View style={styles.indicatorsContainer}>
                {sortedCars.map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.indicator,
                      effectiveCarIndex === index && styles.indicatorActive,
                    ]}
                  />
                ))}
                {/* Add Car Indicator */}
                <View style={[styles.indicator, styles.indicatorAdd]} />
              </View>
            )}

            {/* Dashboard - Categories */}
            {selectedCar && renderCategoryContent()}
          </>
        )}
      </ScrollView>

      {/* Floating Action Button */}
      {cars.length > 0 && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/add-car')}
          activeOpacity={0.9}
        >
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      )}
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
  topBarSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  emptyState: {
    flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F9FAFB',
      alignItems: 'center',
      justifyContent: 'center',
    marginBottom: 24,
    },
    emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
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
    emptyButton: {
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
    emptyButtonText: {
    fontSize: 16,
      fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
  },
  carsScrollView: {
    marginBottom: 16,
  },
  carsHorizontalScroll: {
    paddingRight: 16,
    gap: 16,
  },
  carsContainer: {
    gap: 16,
    marginBottom: 16,
    },
    carCard: {
    width: width * 0.85,
      height: 200,
    borderRadius: 12,
      overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  carCardSelected: {
    borderColor: '#6366F1',
      borderWidth: 2,
    shadowColor: '#6366F1',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
  carImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  carOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    padding: 16,
      justifyContent: 'space-between',
  },
  carTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  carInfo: {
    flex: 1,
  },
  carInfoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  finesBadge: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  finesBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  carActions: {
    flexDirection: 'row',
    gap: 8,
  },
  carActionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  carDeleteButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.6)',
  },
    carBrand: {
      fontSize: 24,
    fontWeight: '700',
      color: '#FFFFFF',
    marginBottom: 4,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    },
    carModel: {
    fontSize: 18,
    fontWeight: '600',
      color: '#FFFFFF',
    marginBottom: 4,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
  },
  carYear: {
    fontSize: 14,
    color: '#E5E7EB',
    fontWeight: '500',
    fontFamily: 'HelveticaMedium',
  },
  carDetails: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  carDetailItem: {
    flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
  },
  carDetailText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#FFFFFF',
      fontFamily: 'HelveticaMedium',
      textTransform: 'uppercase',
  },
  addCarCard: {
    width: '100%',
    height: 120,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#E5E7EB',
      alignItems: 'center',
      justifyContent: 'center',
    gap: 12,
    marginTop: 8,
    marginBottom: 24,
  },
  addCarCardHorizontal: {
    width: width * 0.85,
    height: 200,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#E5E7EB',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
  },
  addCarText: {
      fontSize: 16,
      fontWeight: '600',
    color: '#6B7280',
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
  },
  // Indicators
  indicatorsContainer: {
      flexDirection: 'row',
    justifyContent: 'center',
      alignItems: 'center',
    gap: 8,
    marginTop: 12,
    marginBottom: 8,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D1D5DB',
  },
  indicatorActive: {
    width: 24,
    backgroundColor: '#111827',
  },
  indicatorAdd: {
    backgroundColor: '#9CA3AF',
  },
  // Category Tabs
  categoryTabs: {
    marginTop: 8,
    marginBottom: 16,
  },
  categoryTabsContent: {
    paddingHorizontal: 4,
      gap: 8,
    },
  categoryTab: {
    flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
      borderRadius: 12,
    backgroundColor: '#F9FAFB',
      borderWidth: 1,
    borderColor: '#E5E7EB',
    marginRight: 8,
  },
  categoryTabActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#3B82F6',
  },
  categoryTabText: {
    fontSize: 14,
      fontWeight: '600',
    color: '#6B7280',
  },
  categoryTabTextActive: {
    color: '#3B82F6',
  },
  // Category Content
  categoryContent: {
    marginTop: 8,
  },
  categoryTitle: {
    fontSize: 20,
      fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
    },
  sectionTitle: {
    fontFamily: 'HelveticaMedium',
      fontSize: 16,
      fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
    marginTop: 8,
    textTransform: 'uppercase',
    
  },
  // Stats Grid
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
    statCard: {
    width: (width - 48) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
      borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    },
    statValue: {
      fontSize: 24,
      fontWeight: '700',
    color: '#111827',
    marginTop: 8,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
  },
    statLabel: {
      fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    fontWeight: '500',
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    },
    // Fines Banner
    finesBanner: {
      marginBottom: 24,
      backgroundColor: '#111827',
      borderRadius: 12,
      padding: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    },
    finesBannerAlert: {
      marginBottom: 24,
      borderRadius: 12,
      overflow: 'hidden',
      shadowColor: '#DC2626',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 6,
    },
    finesBannerGradient: {
      padding: 20,
      borderRadius: 12,
    },
    finesBannerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    finesBannerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    finesBannerIconContainer: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 16,
    },
    finesBannerAlertIconContainer: {
      width: 52,
      height: 52,
      borderRadius: 14,
      backgroundColor: 'rgba(255, 255, 255, 0.25)',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 16,
    },
    finesBannerTextContainer: {
      flex: 1,
    },
    finesBannerTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: '#FFFFFF',
      marginBottom: 4,
      fontFamily: 'HelveticaMedium',
      textTransform: 'uppercase',
    },
    finesBannerSubtitle: {
      fontSize: 13,
      color: 'rgba(255, 255, 255, 0.9)',
      fontWeight: '500',
      fontFamily: 'HelveticaMedium',
    },
    finesBannerAmountText: {
      fontSize: 22,
      fontWeight: '800',
      color: '#FFFFFF',
      fontFamily: 'HelveticaMedium',
    },
    finesBannerBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#FFFFFF',
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      gap: 4,
    },
    finesBannerBadgeText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#DC2626',
      fontFamily: 'HelveticaMedium',
      textTransform: 'uppercase',
    },
    // Fine Card (in reminders list)
    fineCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#FFF5F5',
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: '#FECACA',
      shadowColor: '#DC2626',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
      elevation: 1,
    },
    fineIconContainer: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: '#FEE2E2',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 14,
    },
    fineTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: '#111827',
      flex: 1,
      fontFamily: 'HelveticaMedium',
    },
    fineMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    fineAmount: {
      fontSize: 15,
      fontWeight: '800',
      color: '#DC2626',
      fontFamily: 'HelveticaMedium',
    },
    // Quick Actions
    quickActions: {
      marginBottom: 24,
    },
    actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
      gap: 12,
    },
  actionCard: {
    width: (width - 48) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    actionText: {
      fontSize: 14,
      fontWeight: '600',
    color: '#111827',
    },
    // Reminders
  upcomingSection: {
    marginTop: 24,
  },
  sectionHeader: {
      flexDirection: 'row',
    justifyContent: 'space-between',
      alignItems: 'center',
    marginBottom: 16,
    },
  seeAllText: {
      fontSize: 14,
      fontWeight: '600',
    color: '#111827',
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
  },
    remindersList: {
      gap: 12,
    },
    reminderCard: {
      flexDirection: 'row',
      alignItems: 'center',
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
  reminderIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
    reminderContent: {
      flex: 1,
  },
  reminderHeaderRow: {
      flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
      marginBottom: 8,
    gap: 8,
  },
  reminderTitle: {
      fontSize: 16,
      fontWeight: '700',
    color: '#111827',
    flex: 1,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
  },
  reminderStatusBadge: {
    flexDirection: 'row',
      alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
      borderRadius: 12,
    },
  reminderStatusText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
  },
  reminderMeta: {
    flexDirection: 'row',
      alignItems: 'center',
    gap: 16,
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  reminderRecurringInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
      marginTop: 4,
    },
  reminderRecurringText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    fontFamily: 'HelveticaMedium',
    },
  reminderDateContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    gap: 4,
    },
  reminderDate: {
      fontSize: 13,
      fontWeight: '500',
    color: '#6B7280',
    fontFamily: 'HelveticaMedium',
  },
  reminderTimeContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    gap: 4,
  },
  reminderTime: {
    fontSize: 13,
      fontWeight: '500',
    color: '#6B7280',
    fontFamily: 'HelveticaMedium',
  },
  reminderRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
  },
  reminderUrgentBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 6,
      borderRadius: 12,
    },
  reminderUrgentBadgeHigh: {
    backgroundColor: '#FEE2E2',
  },
  reminderUrgentText: {
    fontSize: 12,
      fontWeight: '700',
    color: '#D97706',
  },
  reminderUrgentTextHigh: {
    color: '#DC2626',
  },
  reminderBadge: {
    backgroundColor: '#EEF2FF',
      paddingHorizontal: 12,
    paddingVertical: 6,
      borderRadius: 12,
    },
  reminderBadgeText: {
      fontSize: 12,
      fontWeight: '600',
    color: '#3B82F6',
  },
  // Fuel
  fuelList: {
      gap: 12,
    },
  fuelCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
      padding: 16,
      borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  fuelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
      alignItems: 'center',
    marginBottom: 8,
    },
  fuelDate: {
      fontSize: 14,
      fontWeight: '600',
    color: '#111827',
  },
  fuelAmount: {
      fontSize: 16,
    fontWeight: '700',
    color: '#3B82F6',
  },
  fuelDetails: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
  fuelPrice: {
      fontSize: 18,
      fontWeight: '700',
      color: '#111827',
  },
  fuelType: {
      fontSize: 14,
      color: '#6B7280',
  },
  // Empty Category State
  emptyCategoryState: {
      alignItems: 'center',
      justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
    },
  emptyCategoryText: {
      fontSize: 16,
    color: '#6B7280',
    marginTop: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#3B82F6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 28,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
});
