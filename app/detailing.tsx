import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  StatusBar,
  Dimensions,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  FlatList,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useUser } from '../contexts/UserContext';
import { addItemApi } from '../services/addItemApi';
import { specialOffersApi, SpecialOffer } from '../services/specialOffersApi';
import SpecialOfferModal, { SpecialOfferModalData } from '../components/ui/SpecialOfferModal';
import DetailModal, { DetailItem } from '../components/ui/DetailModal';
import SpecialOfferCard from '../components/ui/SpecialOfferCard';
import AddModal, { AddModalType } from '../components/ui/AddModal';

const { width } = Dimensions.get('window');

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

interface DetailingService {
  id: string;
  name: string;
  description: string;
  category: string;
  location: string;
  address: string;
  phone: string;
  price?: string | number;
  rating: number;
  reviews: number;
  images: string[];
  avatar?: string;
  isOpen: boolean;
  verified?: boolean;
  services?: string[];
  features?: string;
  workingHours?: string;
  waitTime?: string;
}

export default function DetailingScreen() {
  const router = useRouter();
  const { user } = useUser();
  const [services, setServices] = useState<DetailingService[]>([]);
  const [vipStores, setVipStores] = useState<any[]>([]);
  const [specialOffers, setSpecialOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'open' | 'verified'>('all');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedDetailItem, setSelectedDetailItem] = useState<DetailItem | null>(null);
  const [showSpecialOfferModal, setShowSpecialOfferModal] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<SpecialOfferModalData | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 350);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    try {
      setLoading(true);
      
      // Load stores and special offers in parallel
      const [storesResponse, offersResponse] = await Promise.all([
        addItemApi.getDetailingStores({ includeAll: true }),
        specialOffersApi.getSpecialOffers(true),
      ]);
      
      const allServices: DetailingService[] = [];
      
      if (storesResponse.success && storesResponse.data) {
        // All stores from detailing endpoint are already filtered
        const detailingStores = storesResponse.data;
        
        // Separate VIP stores - მხოლოდ isVip === true
        const vip = detailingStores.filter((s: any) => s.isVip === true);
        // Regular stores - მხოლოდ არა-VIP (isVip !== true ან undefined/false)
        const regular = detailingStores.filter((s: any) => s.isVip !== true);
        
        setVipStores(vip);
        
        const stores = detailingStores.map((store: any) => ({
          id: store.id || store._id,
          name: store.name || store.title,
          description: store.description || '',
          category: store.type || 'დითეილინგი',
          location: store.location || '',
          address: store.address || store.location || '',
          phone: store.phone || '',
          price: undefined,
          rating: 4.5,
          reviews: 0,
          images: store.images || store.photos || [],
          avatar: store.avatar,
          isOpen: true,
          verified: false,
          services: store.services || [],
          features: store.features,
          workingHours: store.workingHours,
          waitTime: undefined,
        }));
        allServices.push(...stores);
        setServices(regular.length > 0 ? regular.map((s: any) => ({
          id: s.id || s._id,
          name: s.name || s.title,
          description: s.description || '',
          category: s.type || 'დითეილინგი',
          location: s.location || '',
          address: s.address || s.location || '',
          phone: s.phone || '',
          price: undefined,
          rating: 4.5,
          reviews: 0,
          images: s.images || s.photos || [],
          avatar: s.avatar,
          isOpen: true,
          verified: false,
          services: s.services || [],
          features: s.features,
          workingHours: s.workingHours,
          waitTime: undefined,
        })) : allServices);
        
        // Load special offers and merge with store data (only for detailing stores)
        if (offersResponse && offersResponse.length > 0) {
          const offersWithStores = offersResponse
            .map((offer: SpecialOffer) => {
              const store = detailingStores.find(
                (s: any) => (s.id || s._id) === offer.storeId,
              );
              if (store) {
                return {
                  ...store,
                  ...offer,
                  // Use offer image if available, otherwise use store image
                  image: offer.image || store.photos?.[0] || store.images?.[0],
                };
      }
              return null;
            })
            .filter(Boolean);
          
          setSpecialOffers(offersWithStores);
        } else {
          // Fallback: no special offers
          setSpecialOffers([]);
        }
      }
    } catch (error) {
      console.error('Error loading detailing services:', error);
      setSpecialOffers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadServices();
  };

  const toggleFavorite = (id: string) => {
    setFavorites(prev => 
      prev.includes(id) 
        ? prev.filter(f => f !== id)
        : [...prev, id]
    );
  };

  const isFavorite = (id: string) => favorites.includes(id);

  const filteredServices = useMemo(() => {
    let filtered = services;

    if (debouncedSearch.trim()) {
      filtered = filtered.filter(s =>
        s.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        s.description?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        s.address?.toLowerCase().includes(debouncedSearch.toLowerCase())
      );
    }

    if (activeFilter === 'open') {
      filtered = filtered.filter(s => s.isOpen);
    } else if (activeFilter === 'verified') {
      filtered = filtered.filter(s => s.verified);
    }

    return filtered;
  }, [services, debouncedSearch, activeFilter]);

  const convertStoreToDetailItem = (store: any): DetailItem => {
    const mainImage = store.images?.[0] || store.image || 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?q=80&w=800&auto=format&fit=crop';
    const gallery = store.images || [mainImage];
    
    return {
      id: store.id || store._id,
      title: store.name,
      name: store.name,
      description: store.description || `${store.name} - ხარისხიანი დითეილინგ სერვისები`,
      image: mainImage,
      gallery: gallery,
      type: 'store' as const,
      phone: store.phone,
      address: store.address || store.location,
      location: store.location,
      workingHours: store.workingHours,
      services: store.services || [],
      latitude: store.latitude,
      longitude: store.longitude,
    };
  };

  const handleStorePress = (store: any) => {
    // თუ ეს შეთავაზებაა (აქვს discount ან storeId), გავხსნათ SpecialOfferModal
    if (store.discount || store.storeId) {
      const offerData: SpecialOfferModalData = {
        id: store.id || store._id,
        name: store.name,
        title: store.title || store.name,
        description: store.description,
        location: store.location || store.address,
        phone: store.phone,
        discount: store.discount,
        oldPrice: store.oldPrice,
        newPrice: store.newPrice,
        image: store.image || store.images?.[0] || store.photos?.[0],
        address: store.address || store.location,
      };
      setSelectedOffer(offerData);
      setShowSpecialOfferModal(true);
    } else {
      // ჩვეულებრივი მაღაზია - DetailModal
      const detailItem = convertStoreToDetailItem(store);
      setSelectedDetailItem(detailItem);
      setShowDetailModal(true);
    }
  };

  const handleServicePress = (service: DetailingService) => {
    const detailItem = convertStoreToDetailItem(service);
    setSelectedDetailItem(detailItem);
    setShowDetailModal(true);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent />
      
      <View style={styles.topBar}>
        <SafeAreaView edges={['top']}>
          <View style={styles.topBarContent}>
            <TouchableOpacity style={styles.topBarButton} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.topBarTitle}>დითეილინგი</Text>
            <View style={styles.topBarRight}>
              <TouchableOpacity style={styles.topBarButton} onPress={() => setShowAddModal(true)}>
                <Ionicons name="add" size={24} color="#111827" />
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </View>

      <View style={styles.searchSection}>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="ძიება სახელით, აღწერით ან მისამართით"
            placeholderTextColor="#6B7280"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          ) : null}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {[
            { id: 'all', label: 'ყველა', icon: 'grid-outline' },
            { id: 'open', label: 'ღიაა', icon: 'time-outline' },
            { id: 'verified', label: 'ვერიფიცირებული', icon: 'checkmark-circle-outline' },
          ].map((filter) => (
            <TouchableOpacity
              key={filter.id}
              style={[styles.filterChip, activeFilter === filter.id && styles.filterChipActive]}
              onPress={() => setActiveFilter(filter.id as 'all' | 'open' | 'verified')}
            >
              <Ionicons name={filter.icon as any} size={16} color={activeFilter === filter.id ? '#FFFFFF' : '#6B7280'} />
              <Text style={[styles.filterChipText, activeFilter === filter.id && styles.filterChipTextActive]}>
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#111827" />}
      >
        {loading && services.length === 0 && vipStores.length === 0 && specialOffers.length === 0 ? (
          <>
            <View style={styles.sectionTitleSkeleton} />
            <View style={styles.horizontalScroll}>
              <SkeletonCard /><SkeletonCard /><SkeletonCard />
            </View>
            <View style={styles.sectionTitleSkeleton} />
            <View style={styles.verticalList}>
              <SkeletonListItem /><SkeletonListItem /><SkeletonListItem /><SkeletonListItem />
            </View>
          </>
        ) : (
          <>
            <View style={styles.sectionTitleContainer}>
              <Text style={styles.sectionTitle}>VIP მაღაზიები</Text>
            </View>
            {vipStores.length > 0 ? (
              <FlatList
                horizontal
                data={vipStores}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.vipCard} onPress={() => handleStorePress(item)} activeOpacity={0.8}>
                    <Image
                      source={{ uri: item.images?.[0] || item.image || 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?q=80&w=800&auto=format&fit=crop' }}
                      style={styles.vipCardImage}
                      resizeMode="cover"
                    />
                    <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.vipCardGradient}>
                      <View style={styles.vipBadge}>
                        <Ionicons name="star" size={12} color="#F59E0B" />
                        <Text style={styles.vipBadgeText}>VIP</Text>
                      </View>
                      <View style={styles.vipCardContent}>
                        <Text style={styles.vipCardTitle} numberOfLines={2}>{item.name}</Text>
                        {(item.location || item.address) && (
                          <View style={styles.vipCardMeta}>
                            <Ionicons name="location" size={14} color="#FFFFFF" />
                            <Text style={styles.vipCardLocation}>{item.location || item.address}</Text>
                          </View>
                        )}
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
                keyExtractor={(item, index) => item.id || item._id || `vip-${index}`}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalScroll}
                removeClippedSubviews={Platform.OS === 'ios'}
              />
            ) : null}

            {specialOffers.length > 0 && (
              <>
                <View style={styles.sectionTitleContainer}>
                  <Text style={styles.sectionTitle}>სპეციალური შეთავაზებები</Text>
                </View>
                <FlatList
                  horizontal
                  data={specialOffers}
                  renderItem={({ item }) => {
                    const storeId = item.storeId || item.id || item._id;
                    const offersCount = specialOffers.filter((o: any) => (o.storeId || o.id || o._id) === storeId).length;
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
                        onPress={() => { setSelectedOffer(offerData); setShowSpecialOfferModal(true); }}
                        offersCount={offersCount > 1 ? offersCount : undefined}
                      />
                    );
                  }}
                  keyExtractor={(item, index) => item.id || item._id || `offer-${index}`}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalScroll}
                  removeClippedSubviews={Platform.OS === 'ios'}
                />
              </>
            )}

            <View style={styles.sectionTitleContainer}>
              <Text style={styles.sectionTitle}>დითეილინგ სერვისები</Text>
            </View>
            {filteredServices.length > 0 ? (
              <View style={styles.verticalList}>
                {filteredServices.map((service, index) => {
                  const image = service.images?.[0] || service.avatar || 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?q=80&w=800&auto=format&fit=crop';
                  return (
                    <TouchableOpacity
                      key={service.id || index}
                      style={styles.listItem}
                      onPress={() => handleServicePress(service)}
                      activeOpacity={0.7}
                    >
                      <Image source={{ uri: image }} style={styles.listItemThumbnail} resizeMode="cover" />
                      <View style={styles.listItemContent}>
                        <Text style={styles.listItemTitle} numberOfLines={2}>{service.name}</Text>
                        {service.category ? <Text style={styles.listItemSubtitle} numberOfLines={1}>{service.category}</Text> : null}
                        {(service.location || service.address) && (
                          <View style={styles.listItemMeta}>
                            <Ionicons name="location-outline" size={12} color="#6B7280" />
                            <Text style={styles.listItemLocation} numberOfLines={1}>{service.location || service.address}</Text>
                          </View>
                        )}
                      </View>
                      <TouchableOpacity
                        style={styles.listItemIndicator}
                        onPress={(e) => { e.stopPropagation(); handleServicePress(service); }}
                      >
                        <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>დითეილინგ სერვისები ვერ მოიძებნა</Text>
              </View>
            )}
            <View style={{ height: 100 }} />
          </>
        )}
      </ScrollView>

      {/* Detail Modal */}
      <DetailModal
        visible={showDetailModal}
        item={selectedDetailItem}
        onClose={() => setShowDetailModal(false)}
        onContact={() => {}}
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

      <AddModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={(_type: AddModalType) => {
          setShowAddModal(false);
          loadServices();
        }}
        defaultType="store"
        defaultFormData={{ type: 'დეტეილინგი' }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
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
  topBarRight: { width: 40 },
  searchSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 12,
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
  filterScroll: {
    flexDirection: 'row',
    gap: 12,
    paddingRight: 20,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterChipActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  filterChipText: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  filterChipTextActive: { color: '#FFFFFF' },
  content: { flex: 1, backgroundColor: '#FFFFFF' },
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
  vipCardImage: { width: '100%', height: '100%' },
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
  vipCardContent: { gap: 8 },
  vipCardTitle: {
    fontSize: 18,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#FFFFFF',
  },
  vipCardMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  vipCardLocation: {
    fontSize: 13,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: '#FFFFFF',
    fontWeight: '500',
  },
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
  listItemContent: { flex: 1, gap: 4 },
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
  listItemMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
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
  emptyState: { padding: 40, alignItems: 'center', justifyContent: 'center' },
  emptyText: {
    fontSize: 16,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: '#9CA3AF',
    fontWeight: '500',
  },
  skeletonCard: {
    width: width * 0.65,
    height: 160,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
    marginRight: 12,
    overflow: 'hidden',
  },
  skeletonImage: { width: '100%', height: '70%', backgroundColor: '#D1D5DB' },
  skeletonContent: { padding: 12, gap: 8 },
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
  skeletonTextContainer: { flex: 1, gap: 6 },
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
});

