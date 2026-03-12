import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  StatusBar,
  FlatList,
  Dimensions,
  ActivityIndicator,
  Platform,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { addItemApi } from '../services/addItemApi';
import { useUser } from '../contexts/UserContext';
import { DetailItem } from '../components/ui/DetailModal';
import AddModal, { AddModalType } from '../components/ui/AddModal';
import { specialOffersApi, SpecialOffer } from '../services/specialOffersApi';
import SpecialOfferModal, { SpecialOfferModalData } from '../components/ui/SpecialOfferModal';
import SpecialOfferCard from '../components/ui/SpecialOfferCard';

const { width } = Dimensions.get('window');

// Skeleton Component
const SkeletonCard = () => (
  <View style={styles.skeletonCard}>
    <View style={styles.skeletonImage} />
    <View style={styles.skeletonContent}>
      <View style={styles.skeletonLine} />
      <View style={[styles.skeletonLine, { width: '60%' }]} />
    </View>
  </View>
);

const SkeletonListItem = () => (
  <View style={styles.skeletonListItem}>
    <View style={styles.skeletonThumbnail} />
    <View style={styles.skeletonTextContainer}>
      <View style={styles.skeletonTextLine} />
      <View style={[styles.skeletonTextLine, { width: '80%' }]} />
      <View style={[styles.skeletonTextLine, { width: '70%' }]} />
      <View style={[styles.skeletonTextLine, { width: '50%' }]} />
    </View>
    <View style={styles.skeletonIndicator} />
  </View>
);

export default function ServicesNewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useUser();
  const [showAddModal, setShowAddModal] = useState(false);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  
  // Data states
  const [services, setServices] = useState<any[]>([]);
  const [vipServices, setVipServices] = useState<any[]>([]);
  const [regularServices, setRegularServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [allServicesData, setAllServicesData] = useState<any[]>([]);
  const [displayedServices, setDisplayedServices] = useState<any[]>([]);
  const [displayedServicesCount, setDisplayedServicesCount] = useState(10);
  const [specialOffers, setSpecialOffers] = useState<any[]>([]);
  const [showSpecialOfferModal, setShowSpecialOfferModal] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<SpecialOfferModalData | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  // Load services
  const loadServices = useCallback(async () => {
    try {
      setLoading(true);
      
      const [servicesResponse, offersResponse] = await Promise.all([
        addItemApi.getServices({}),
        specialOffersApi.getSpecialOffers(true),
      ]);
      
      if (servicesResponse.success && servicesResponse.data) {
        // Filter only auto services
        const allServices = servicesResponse.data.filter((service: any) => {
          const category = service.category || service.type || '';
          return category.includes('ავტოსერვის') || category.toLowerCase().includes('service');
        });
        
        // Filter by search
        const filteredServices = debounced.trim()
          ? allServices.filter((s: any) => 
              (s.name || '').toLowerCase().includes(debounced.toLowerCase()) ||
              (s.description || '').toLowerCase().includes(debounced.toLowerCase())
            )
          : allServices;
        
        // Separate VIP and regular services
        const vip = filteredServices.filter((s: any) => s.isVip === true || s.isFeatured === true);
        const regular = filteredServices.filter((s: any) => (s.isVip !== true && s.isFeatured !== true));
        
        setVipServices(vip);
        setRegularServices(regular);
        setServices(filteredServices);
        setAllServicesData(regular);
        // Start with first 10 items
        setDisplayedServices(regular.slice(0, 10));
        setDisplayedServicesCount(10);
        
        // Handle special offers
        if (offersResponse && offersResponse.length > 0) {
          const offersWithServices = offersResponse.map((offer: SpecialOffer) => {
            const service = allServices.find(
              (s: any) => (s.id || s._id) === offer.storeId,
            );
            if (service) {
              return {
                ...service,
                ...offer,
                image: offer.image || service.photos?.[0] || service.images?.[0],
              };
            }
            return null;
          }).filter(Boolean);
          
          setSpecialOffers(offersWithServices);
        } else {
          setSpecialOffers([]);
        }
      }
    } catch (error) {
      console.error('Error loading services:', error);
    } finally {
      setLoading(false);
    }
  }, [debounced]);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  // Load more services when scrolling
  const loadMoreServices = () => {
    if (displayedServicesCount < allServicesData.length) {
      const nextCount = Math.min(displayedServicesCount + 10, allServicesData.length);
      setDisplayedServices(allServicesData.slice(0, nextCount));
      setDisplayedServicesCount(nextCount);
    }
  };

  // Convert service to DetailItem
  const convertServiceToDetailItem = (service: any): DetailItem => {
    const mainImage = service.images?.[0] || service.image || 'https://images.unsplash.com/photo-1581094271901-8022df4466b9?q=80&w=600&auto=format&fit=crop';
    const gallery = service.images || [mainImage];
    
    return {
      id: service.id || service._id,
      title: service.name,
      name: service.name,
      description: service.description || `${service.name} - ხარისხიანი ავტოსერვისი`,
      image: mainImage,
      type: 'store',
      location: service.location,
      phone: service.phone,
      address: service.address || service.location,
      workingHours: service.workingHours,
      services: service.services || [],
      gallery: gallery,
      latitude: service.latitude,
      longitude: service.longitude,
      specifications: {
        'კატეგორია': service.category || service.type || '',
        'მდებარეობა': service.location || '',
        'ტელეფონი': service.phone || '',
      }
    };
  };

  // Render VIP Card (Horizontal) - Memoized for performance
  const renderVIPCard = React.useCallback(({ item }: { item: any }) => {
    const image = item.images?.[0] || item.image || 'https://images.unsplash.com/photo-1581094271901-8022df4466b9?q=80&w=600&auto=format&fit=crop';
    
    return (
      <TouchableOpacity
        style={styles.vipCard}
        onPress={() => {
          if (item.discount || item.storeId) {
            const offerData: SpecialOfferModalData = {
              id: item.id || item._id,
              name: item.name,
              title: item.title || item.name,
              description: item.description,
              location: item.location || item.address,
              phone: item.phone,
              discount: item.discount,
              oldPrice: item.oldPrice,
              newPrice: item.newPrice,
              image: item.image || item.images?.[0] || item.photos?.[0],
              address: item.address || item.location,
            };
            setSelectedOffer(offerData);
            setShowSpecialOfferModal(true);
          } else {
            const detailItem = convertServiceToDetailItem(item);
            router.push({
              pathname: '/parts-details-new',
              params: { item: JSON.stringify(detailItem) }
            });
          }
        }}
        activeOpacity={0.8}
      >
        <Image 
          source={{ uri: image }} 
          style={styles.vipCardImage}
          resizeMode="cover"
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.8)']}
          style={styles.vipCardGradient}
        >
          <View style={styles.vipBadge}>
            <Ionicons name="star" size={12} color="#F59E0B" />
            <Text style={styles.vipBadgeText}>VIP</Text>
          </View>
          <View style={styles.vipCardContent}>
            <Text style={styles.vipCardTitle} numberOfLines={2}>
              {item.name}
            </Text>
            {item.location && (
              <View style={styles.vipCardMeta}>
                <Ionicons name="location" size={14} color="#FFFFFF" />
                <Text style={styles.vipCardLocation}>{item.location}</Text>
              </View>
            )}
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  }, []);

  // Render List Item (Vertical) - Memoized for performance
  const renderListItem = React.useCallback(({ item, index }: { item: any; index: number }) => {
    const image = item.images?.[0] || item.image || 'https://images.unsplash.com/photo-1581094271901-8022df4466b9?q=80&w=600&auto=format&fit=crop';
    
    return (
      <TouchableOpacity
        style={styles.listItem}
        onPress={() => {
          if (item.discount || item.storeId) {
            const offerData: SpecialOfferModalData = {
              id: item.id || item._id,
              name: item.name,
              title: item.title || item.name,
              description: item.description,
              location: item.location || item.address,
              phone: item.phone,
              discount: item.discount,
              oldPrice: item.oldPrice,
              newPrice: item.newPrice,
              image: item.image || item.images?.[0] || item.photos?.[0],
              address: item.address || item.location,
            };
            setSelectedOffer(offerData);
            setShowSpecialOfferModal(true);
          } else {
            const detailItem = convertServiceToDetailItem(item);
            router.push({
              pathname: '/parts-details-new',
              params: { item: JSON.stringify(detailItem) }
            });
          }
        }}
        activeOpacity={0.7}
      >
        <Image 
          source={{ uri: image }} 
          style={styles.listItemThumbnail}
          resizeMode="cover"
        />
        <View style={styles.listItemContent}>
          <Text style={styles.listItemTitle} numberOfLines={2}>
            {item.name}
          </Text>
          {item.category && (
            <Text style={styles.listItemSubtitle} numberOfLines={1}>
              {item.category}
            </Text>
          )}
          {item.location && (
            <View style={styles.listItemMeta}>
              <Ionicons name="location-outline" size={12} color="#6B7280" />
              <Text style={styles.listItemLocation}>{item.location}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={styles.listItemIndicator}
          onPress={(e) => {
            e.stopPropagation();
            if (item.discount || item.storeId) {
              const offerData: SpecialOfferModalData = {
                id: item.id || item._id,
                name: item.name,
                title: item.title || item.name,
                description: item.description,
                location: item.location || item.address,
                phone: item.phone,
                discount: item.discount,
                oldPrice: item.oldPrice,
                newPrice: item.newPrice,
                image: item.image || item.images?.[0] || item.photos?.[0],
                address: item.address || item.location,
              };
              setSelectedOffer(offerData);
              setShowSpecialOfferModal(true);
            } else {
              const detailItem = convertServiceToDetailItem(item);
              router.push({
                pathname: '/parts-details-new',
                params: { item: JSON.stringify(detailItem) }
              });
            }
          }}
        >
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }, []);

  const handleAddItem = (type: AddModalType, data: any) => {
    loadServices();
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent />
      
      {/* Top White Header */}
      <View style={styles.topBar}>
        <SafeAreaView edges={['top']}>
          <View style={styles.topBarContent}>
            <TouchableOpacity
              style={styles.topBarButton}
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.push('/(tabs)' as any);
                }
              }}
            >
              <Ionicons name="arrow-back" size={24} color="#111827" />
            </TouchableOpacity>
            
            <Text style={styles.topBarTitle}>ავტოსერვისები</Text>
            
            <View style={styles.topBarRight}>
              <TouchableOpacity
                style={styles.topBarButton}
                onPress={() => setShowAddModal(true)}
              >
                <Ionicons name="add" size={24} color="#111827" />
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </View>

      {/* Search Section */}
      <View style={styles.searchSection}>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="ძიება სახელით ან აღწერით"
            placeholderTextColor="#6B7280"
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Section Title - VIP */}
        {loading ? (
          <View style={styles.sectionTitleSkeleton} />
        ) : (
          <View style={styles.sectionTitleContainer}>
            <Text style={styles.sectionTitle}>VIP ავტოსერვისები</Text>
          </View>
        )}

        {/* Horizontal Scroll - VIP Cards */}
        {loading ? (
          <View style={styles.horizontalScroll}>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </View>
        ) : vipServices.length > 0 ? (
          <FlatList
            horizontal
            data={vipServices}
            renderItem={renderVIPCard}
            keyExtractor={(item, index) => item.id || item._id || `vip-${index}`}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalScroll}
            removeClippedSubviews={Platform.OS === 'ios'}
            initialNumToRender={2}
            maxToRenderPerBatch={2}
            windowSize={2}
            getItemLayout={(data, index) => ({
              length: width * 0.65 + 16,
              offset: (width * 0.65 + 16) * index,
              index,
            })}
          />
        ) : null}

        {/* სპეციალური შეთავაზებები */}
        {specialOffers.length > 0 && (
          <>
            <View style={styles.sectionTitleContainer}>
              <Text style={styles.sectionTitle}>სპეციალური შეთავაზებები</Text>
            </View>
            <FlatList
              horizontal
              data={specialOffers}
              renderItem={({ item }) => {
                const offerData: SpecialOfferModalData = {
                  id: item.id || item._id,
                  name: item.name,
                  title: item.title || item.name,
                  description: item.description,
                  location: item.location || item.address,
                  phone: item.phone,
                  discount: item.discount,
                  oldPrice: item.oldPrice,
                  newPrice: item.newPrice,
                  image: item.image || item.images?.[0] || item.photos?.[0],
                  address: item.address || item.location,
                };
                return (
                  <SpecialOfferCard
                    offer={item}
                    onPress={() => {
                      setSelectedOffer(offerData);
                      setShowSpecialOfferModal(true);
                    }}
                  />
                );
              }}
              keyExtractor={(item, index) => item.id || item._id || `offer-${index}`}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalScroll}
              removeClippedSubviews={Platform.OS === 'ios'}
              initialNumToRender={2}
              maxToRenderPerBatch={2}
              windowSize={2}
            />
          </>
        )}

        {/* Section Title - List */}
        {loading ? (
          <View style={styles.sectionTitleSkeleton} />
        ) : (
          <View style={styles.sectionTitleContainer}>
            <Text style={styles.sectionTitle}>ყველა ავტოსერვისი</Text>
          </View>
        )}

        {/* Vertical List */}
        {loading ? (
          <View style={styles.verticalList}>
            <SkeletonListItem />
            <SkeletonListItem />
            <SkeletonListItem />
            <SkeletonListItem />
          </View>
        ) : displayedServices.length > 0 ? (
          <FlatList
            data={displayedServices}
            renderItem={renderListItem}
            keyExtractor={(item, index) => {
              const id = item.id || item._id;
              return id ? `service-${id}` : `service-${index}`;
            }}
            scrollEnabled={false}
            nestedScrollEnabled={true}
            contentContainerStyle={styles.verticalList}
            onEndReached={loadMoreServices}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              displayedServicesCount < allServicesData.length ? (
                <View style={styles.loadingMoreContainer}>
                  <ActivityIndicator size="small" color="#111827" />
                  <Text style={styles.loadingMoreText}>იტვირთება...</Text>
                </View>
              ) : null
            }
            removeClippedSubviews={Platform.OS === 'ios'}
            initialNumToRender={5}
            maxToRenderPerBatch={3}
            windowSize={3}
            updateCellsBatchingPeriod={100}
            getItemLayout={(data, index) => ({
              length: 120,
              offset: 120 * index,
              index,
            })}
          />
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>ავტოსერვისები ვერ მოიძებნა</Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>



      {/* Add Modal */}
      <AddModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleAddItem}
        defaultType="service"
      />

      {/* Special Offer Modal */}
      <SpecialOfferModal
        visible={showSpecialOfferModal}
        offer={selectedOffer}
        onClose={() => {
          setShowSpecialOfferModal(false);
          setSelectedOffer(null);
        }}
      />
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
  // Search Section
  searchSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchInput: {
    flex: 1,
    color: '#111827',
    fontSize: 14,
    fontWeight: '500',
  },
  // Content
  content: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  // Section Title
  sectionTitleContainer: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#111827',
  },
  sectionTitleSkeleton: {
    height: 18,
    width: 200,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    marginHorizontal: 20,
    marginTop: 24,
    marginBottom: 12,
  },
  // Horizontal Scroll - VIP Cards
  horizontalScroll: {
    paddingLeft: 20,
    paddingRight: 4,
    gap: 12,
  },
  vipCard: {
    width: width * 0.65,
    height: 160,
    borderRadius: 16,
    overflow: 'hidden',
    marginRight: 12,
    backgroundColor: '#111827',
  },
  vipCardImage: {
    width: '100%',
    height: '100%',
  },
  vipCardGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
    justifyContent: 'flex-end',
    padding: 16,
  },
  vipBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  vipBadgeText: {
    fontSize: 11,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#F59E0B',
  },
  vipCardContent: {
    gap: 8,
  },
  vipCardTitle: {
    fontSize: 18,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#FFFFFF',
  },
  vipCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  vipCardLocation: {
    fontSize: 13,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: '#FFFFFF',
    fontWeight: '500',
  },
  offerCard: {
    width: width * 0.65,
    height: 160,
    borderRadius: 16,
    overflow: 'hidden',
    marginRight: 12,
    backgroundColor: '#111827',
  },
  offerCardImage: {
    width: '100%',
    height: '100%',
  },
  offerCardGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
    justifyContent: 'flex-end',
    padding: 16,
  },
  offerDiscountBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: '#EF4444',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  offerDiscountBadgeText: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#FFFFFF',
  },
  offerCardContent: { gap: 8 },
  offerCardTitle: {
    fontSize: 16,
    fontFamily: 'HelveticaMedium',
    fontWeight: '700',
    color: '#FFFFFF',
  },
  offerPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  offerOldPrice: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
    fontWeight: '500',
  },
  offerNewPrice: {
    fontSize: 16,
    fontFamily: 'HelveticaMedium',
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // Vertical List
  verticalList: {
    paddingHorizontal: 20,
    gap: 12,
    paddingBottom: 20,
  },
  listItem: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  listItemThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    marginRight: 12,
  },
  listItemContent: {
    flex: 1,
    gap: 4,
  },
  listItemTitle: {
    fontSize: 15,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  listItemSubtitle: {
    fontSize: 13,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: '#6B7280',
    fontWeight: '500',
    marginBottom: 4,
  },
  listItemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  listItemLocation: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: '#6B7280',
    fontWeight: '500',
  },
  listItemIndicator: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  // Floating Action Button
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  // Empty State
  emptyState: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: '#9CA3AF',
    fontWeight: '500',
  },
  // Skeletons
  skeletonCard: {
    width: width * 0.65,
    height: 160,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
    marginRight: 12,
    overflow: 'hidden',
  },
  skeletonImage: {
    width: '100%',
    height: '70%',
    backgroundColor: '#D1D5DB',
  },
  skeletonContent: {
    padding: 12,
    gap: 8,
  },
  skeletonLine: {
    height: 12,
    backgroundColor: '#D1D5DB',
    borderRadius: 6,
    width: '100%',
  },
  skeletonListItem: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  skeletonThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
    marginRight: 12,
  },
  skeletonTextContainer: {
    flex: 1,
    gap: 6,
  },
  skeletonTextLine: {
    height: 10,
    backgroundColor: '#E5E7EB',
    borderRadius: 5,
    width: '100%',
  },
  skeletonIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
    marginLeft: 8,
  },
  // Loading More
  loadingMoreContainer: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingMoreText: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: '#6B7280',
    fontWeight: '500',
  },
});
