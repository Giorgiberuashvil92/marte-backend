import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  StatusBar,
  FlatList,
  Dimensions,
  Linking,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { DetailItem } from '../components/ui/DetailModal';
import { useUser } from '../contexts/UserContext';
import { engagementApi } from '../services/engagementApi';
import { analyticsService } from '../services/analytics';

const { width, height } = Dimensions.get('window');

export default function PartsDetailsNewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useUser();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Mock data - in real app, this would come from params or API
  const item: DetailItem | null = params.item ? JSON.parse(params.item as string) : null;
  const itemId = item?.id ? String(item.id) : '';
  const itemTitle = String(item?.name || item?.title || 'დეტალები');
  const itemType = String(item?.type || 'unknown');

  useFocusEffect(
    React.useCallback(() => {
      analyticsService.logScreenViewWithBackend('დეტალები', 'PartsDetailsNewScreen', user?.id);
      if (itemId) {
        analyticsService.logSalesItemView(itemId, itemTitle, itemType, 'დეტალები', user?.id);
      }
      if (itemType === 'dismantler' && user?.id && itemId) {
        engagementApi.trackDismantlerView(itemId, user.id).catch(() => {});
      }
    }, [itemId, itemTitle, itemType, user?.id])
  );

  if (!item) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.topBar}>
          <SafeAreaView edges={['top']}>
            <View style={styles.topBarContent}>
              <TouchableOpacity
                style={styles.topBarButton}
                onPress={() => router.back()}
              >
                <Ionicons name="arrow-back" size={24} color="#111827" />
              </TouchableOpacity>
              <Text style={styles.topBarTitle}>დეტალები</Text>
              <View style={styles.topBarRight}>
                <TouchableOpacity style={styles.topBarButton}>
                  <Ionicons name="share-outline" size={24} color="#111827" />
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>ინფორმაცია არ მოიძებნა</Text>
        </View>
      </View>
    );
  }

  const images = item.gallery && item.gallery.length > 0 ? item.gallery : [item.image];

  const formatPhoneForDisplay = (phone: string): string => {
    if (!phone) return '';
    let cleaned = phone.replace(/[^\d+]/g, '');
    if (cleaned.startsWith('+995')) {
      const number = cleaned.substring(4);
      if (number.length === 9) {
        return `+995 ${number.substring(0, 3)} ${number.substring(3, 6)} ${number.substring(6)}`;
      }
      return cleaned;
    }
    if (cleaned.length === 9 && /^5\d{8}$/.test(cleaned)) {
      return `${cleaned.substring(0, 3)} ${cleaned.substring(3, 6)} ${cleaned.substring(6)}`;
    }
    if (cleaned.length === 12 && cleaned.startsWith('995')) {
      const number = cleaned.substring(3);
      return `+995 ${number.substring(0, 3)} ${number.substring(3, 6)} ${number.substring(6)}`;
    }
    return phone;
  };

  const handleCall = async (phoneNumber?: string) => {
    const phoneToUse = phoneNumber || item.phone;
    if (!phoneToUse) {
      Alert.alert('შეცდომა', 'ტელეფონის ნომერი არ არის მითითებული');
      return;
    }
    let cleanPhone = phoneToUse.replace(/[\s\-\(\)]/g, '');
    if (!cleanPhone.startsWith('+')) {
      if (cleanPhone.length === 9 && /^5\d{8}$/.test(cleanPhone)) {
        cleanPhone = `+995${cleanPhone}`;
      } else if (cleanPhone.length === 12 && cleanPhone.startsWith('995')) {
        cleanPhone = `+${cleanPhone}`;
      }
    }
    const phoneUrl = `tel:${cleanPhone}`;
    try {
      const canOpen = await Linking.canOpenURL(phoneUrl);
      if (canOpen) {
        analyticsService.logButtonClick('დარეკვა', 'დეტალები', { item_id: itemId, item_type: itemType }, user?.id);
        analyticsService.logCallInitiated(cleanPhone, itemType);
        if (itemType === 'dismantler' && user?.id && itemId) {
          engagementApi.trackDismantlerCall(itemId, user.id).catch(() => {});
        }
        await Linking.openURL(phoneUrl);
      } else {
        Alert.alert('შეცდომა', 'ტელეფონის დარეკვა ვერ მოხერხდა');
      }
    } catch (error) {
      console.error('Error opening phone call:', error);
      Alert.alert('შეცდომა', 'ტელეფონის დარეკვა ვერ მოხერხდა');
    }
  };

  const defaultDescription = item.type === 'store' 
    ? `${item.name || 'ჩვენი მაღაზია'} არის საქართველოში წამყვანი ავტონაწილების მაღაზია. ჩვენ ვთავაზობთ ხარისხიან პროდუქტებს და პროფესიონალურ მომსახურებას, რომელიც დააკმაყოფილებს თქვენს ყველა საჭიროებას.`
    : `ხარისხიანი პროდუქტი და სერვისი თქვენი ავტომობილისთვის. ჩვენ ვზრუნავთ თქვენს უსაფრთხოებასა და კომფორტზე.`;
  
  const description = item.description || defaultDescription;
  const truncatedDescription = description.length > 150 && !showFullDescription
    ? description.substring(0, 150) + '...'
    : description;

  const handleScroll = (event: any) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    const index = event.nativeEvent.contentOffset.x / slideSize;
    const roundIndex = Math.round(index);
    setCurrentImageIndex(roundIndex);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Top White Header */}
      <View style={styles.topBar}>
        <SafeAreaView edges={['top']}>
          <View style={styles.topBarContent}>
            <TouchableOpacity
              style={styles.topBarButton}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={24} color="#111827" />
            </TouchableOpacity>
            
            <Text style={styles.topBarTitle} numberOfLines={1}>
              {item.name || item.title}
            </Text>
            
            <View style={styles.topBarRight}>
              <TouchableOpacity style={styles.topBarButton}>
                <Ionicons name="share-outline" size={24} color="#111827" />
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </View>

      <ScrollView 
        style={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
      >
        {/* Image Carousel */}
        <View style={styles.imageContainer}>
          <FlatList
            ref={flatListRef}
            data={images}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            keyExtractor={(_, index) => index.toString()}
            renderItem={({ item: imageUri }) => (
              <View style={styles.imageWrapper}>
                <Image source={{ uri: imageUri }} style={styles.image} />
              </View>
            )}
          />
          
          {/* Pagination Counter */}
          {images.length > 1 && (
            <View style={styles.paginationCounter}>
              <Text style={styles.paginationText}>
                {currentImageIndex + 1}/{images.length}
              </Text>
            </View>
          )}
        </View>

        {/* Content Card */}
        <View style={styles.contentCard}>
          {/* Title and Type */}
          <View style={styles.titleSection}>
            <Text style={styles.mainTitle}>{item.name || item.title}</Text>
            {item.type && (
              <View style={styles.typeBadge}>
                <Text style={styles.typeText}>
                  {item.type === 'part' ? 'ნაწილი' : 
                   item.type === 'dismantler' ? 'დამშლელი' : 
                   item.type === 'store' ? 'მაღაზია' : 'ხელოსანი'}
                </Text>
              </View>
            )}
            {item.price && (
              <Text style={styles.priceText}>{item.price}</Text>
            )}
          </View>

          {/* Specifications */}
          {item.specifications && Object.keys(item.specifications).length > 0 && (
            <View style={styles.specsSection}>
              <Text style={styles.sectionTitle}>ტექნიკური მახასიათებლები</Text>
              <View style={styles.specsGrid}>
                {Object.entries(item.specifications).map(([key, value]) => (
                  value ? (
                    <View key={key} style={styles.specCard}>
                      <Text style={styles.specLabel}>{key}</Text>
                      <Text style={styles.specValue}>{value}</Text>
                    </View>
                  ) : null
                ))}
              </View>
            </View>
          )}

          {/* Description */}
          <View style={styles.descriptionSection}>
            <Text style={styles.sectionTitle}>აღწერა</Text>
            <Text style={styles.descriptionText}>
              {truncatedDescription}
              {description.length > 150 && (
                <Text 
                  style={styles.readMoreText}
                  onPress={() => setShowFullDescription(!showFullDescription)}
                >
                  {showFullDescription ? ' ნაკლები' : ' მეტის ნახვა...'}
                </Text>
              )}
            </Text>
          </View>

          {/* Location */}
          {(item.location || item.address) && (
            <View style={styles.locationSection}>
              <View style={styles.locationHeader}>
                <Ionicons name="location" size={20} color="#111827" />
                <View style={styles.locationTextContainer}>
                  <Text style={styles.locationCity}>{item.location}</Text>
                  {item.address && item.address !== item.location && (
                    <Text style={styles.locationAddress}>{item.address}</Text>
                  )}
                </View>
              </View>
              
              <TouchableOpacity 
                style={styles.mapButton}
                onPress={() => {
                  if (item.latitude && item.longitude) {
                    const url = Platform.OS === 'ios' 
                      ? `maps://?ll=${item.latitude},${item.longitude}&q=${encodeURIComponent(item.name || '')}`
                      : `geo:${item.latitude},${item.longitude}?q=${item.latitude},${item.longitude}(${encodeURIComponent(item.name || '')})`;
                    Linking.openURL(url).catch(() => {
                      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${item.latitude},${item.longitude}`);
                    });
                  } else {
                    const fullAddress = item.address 
                      ? `${item.address}, ${item.location || ''}` 
                      : (item.location || '');
                    const query = encodeURIComponent(fullAddress);
                    const url = Platform.OS === 'ios' 
                      ? `maps://app?q=${query}`
                      : `geo:0,0?q=${query}`;
                    Linking.openURL(url).catch(() => {
                      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
                    });
                  }
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="navigate" size={18} color="#3B82F6" />
                <Text style={styles.mapButtonText}>Google Maps-ზე ნახვა</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Contact Info */}
          {(item.phone || item.alternativePhone) && (
            <View style={styles.contactSection}>
              <Text style={styles.sectionTitle}>კონტაქტი</Text>
              {item.phone && (
                <TouchableOpacity
                  style={styles.contactItem}
                  onPress={() => handleCall(item.phone)}
                  activeOpacity={0.7}
                >
                  <View style={styles.contactIcon}>
                    <Ionicons name="call" size={20} color="#111827" />
                  </View>
                  <View style={styles.contactTextContainer}>
                    <Text style={styles.contactLabel}>ტელეფონი</Text>
                    <Text style={styles.contactValue}>{formatPhoneForDisplay(item.phone)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                </TouchableOpacity>
              )}
              {item.alternativePhone && (
                <TouchableOpacity
                  style={styles.contactItem}
                  onPress={() => handleCall(item.alternativePhone)}
                  activeOpacity={0.7}
                >
                  <View style={styles.contactIcon}>
                    <Ionicons name="call-outline" size={20} color="#6B7280" />
                  </View>
                  <View style={styles.contactTextContainer}>
                    <Text style={styles.contactLabel}>ალტერნატიული ტელეფონი</Text>
                    <Text style={styles.contactValue}>{formatPhoneForDisplay(item.alternativePhone)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Services */}
          {item.services && item.services.length > 0 && (
            <View style={styles.servicesSection}>
              <Text style={styles.sectionTitle}>მომსახურებები</Text>
              <View style={styles.servicesList}>
                {item.services.map((service, index) => (
                  <View key={index} style={styles.serviceItem}>
                    <View style={styles.serviceCheckmark}>
                      <Ionicons name="checkmark" size={14} color="#10B981" />
                    </View>
                    <Text style={styles.serviceText}>{service}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Social Media */}
          {(item.facebook || item.instagram || item.youtube) && (
            <View style={styles.socialSection}>
              <Text style={styles.sectionTitle}>სოციალური მედია</Text>
              <View style={styles.socialLinks}>
                {item.facebook && (
                  <TouchableOpacity 
                    style={[styles.socialButton, { backgroundColor: '#1877F2' }]}
                    onPress={() => {
                      if (item.facebook) {
                        Linking.openURL(item.facebook).catch(() => {});
                      }
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="logo-facebook" size={20} color="#FFFFFF" />
                  </TouchableOpacity>
                )}
                {item.instagram && (
                  <TouchableOpacity 
                    style={[styles.socialButton, { backgroundColor: '#E4405F' }]}
                    onPress={() => {
                      if (item.instagram) {
                        Linking.openURL(item.instagram).catch(() => {});
                      }
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="logo-instagram" size={20} color="#FFFFFF" />
                  </TouchableOpacity>
                )}
                {item.youtube && (
                  <TouchableOpacity 
                    style={[styles.socialButton, { backgroundColor: '#FF0000' }]}
                    onPress={() => {
                      if (item.youtube) {
                        Linking.openURL(item.youtube).catch(() => {});
                      }
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="logo-youtube" size={20} color="#FFFFFF" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Bottom Buttons */}
      <SafeAreaView edges={['bottom']} style={styles.bottomButtonWrapper}>
        <View style={styles.bottomButtonContainer}>
          <TouchableOpacity
            style={styles.callButton}
            onPress={() => handleCall(item.phone || item.alternativePhone)}
            activeOpacity={0.7}
          >
            <Ionicons name="call" size={20} color="#FFFFFF" />
            <Text style={styles.callButtonText}>დარეკვა</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.installmentButton}
            onPress={() => {
              router.back();
              setTimeout(() => {
                router.push('/financing-info' as any);
              }, 300);
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="card-outline" size={20} color="#111827" />
            <Text style={styles.installmentButtonText}>განვადება</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  // Top White Header
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
    marginHorizontal: 12,
  },
  topBarButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarRight: {
    flexDirection: 'row',
    gap: 12,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: '#9CA3AF',
    fontWeight: '500',
  },
  // Scroll Content
  scrollContent: {
    flex: 1,
  },
  // Image Carousel
  imageContainer: {
    height: height * 0.4,
    backgroundColor: '#000000',
    position: 'relative',
  },
  imageWrapper: {
    width: width,
    height: height * 0.4,
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  paginationCounter: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  paginationText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  // Content Card
  contentCard: {
    backgroundColor: '#FFFFFF',
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  titleSection: {
    marginBottom: 24,
  },
  mainTitle: {
    fontSize: 22,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  typeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  typeText: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '600',
    color: '#6B7280',
  },
  priceText: {
    fontSize: 22,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#111827',
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  specsSection: {
    marginBottom: 24,
  },
  specsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  specCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minWidth: width * 0.4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  specLabel: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 6,
  },
  specValue: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#111827',
  },
  descriptionSection: {
    marginBottom: 24,
  },
  descriptionText: {
    fontSize: 15,
    color: '#111827',
    lineHeight: 24,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '400',
  },
  readMoreText: {
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: '#111827',
    fontWeight: '600',
  },
  locationSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  locationTextContainer: {
    flex: 1,
  },
  locationCity: {
    fontSize: 16,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  locationAddress: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '400',
    color: '#6B7280',
    lineHeight: 20,
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  mapButtonText: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '600',
    color: '#111827',
  },
  contactSection: {
    marginBottom: 24,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  contactIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  contactTextContainer: {
    flex: 1,
  },
  contactLabel: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 4,
  },
  contactValue: {
    fontSize: 15,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '600',
    color: '#111827',
  },
  // Services
  servicesSection: {
    marginBottom: 24,
  },
  servicesList: {
    gap: 12,
  },
  serviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  serviceCheckmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceText: {
    fontSize: 15,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '500',
    color: '#111827',
    flex: 1,
  },
  // Social
  socialSection: {
    marginBottom: 24,
  },
  socialLinks: {
    flexDirection: 'row',
    gap: 12,
  },
  socialButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomButtonWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  bottomButtonContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    flexDirection: 'row',
    gap: 12,
  },
  callButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  callButtonText: {
    fontSize: 16,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#FFFFFF',
  },
  installmentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  installmentButtonText: {
    fontSize: 16,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#111827',
  },
});
