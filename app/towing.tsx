import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Dimensions,
  RefreshControl,
  StatusBar,
  FlatList,
  ActivityIndicator,
  Image,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import API_BASE_URL from '../config/api';
import AddModal, { AddModalType } from '../components/ui/AddModal';

const { width } = Dimensions.get('window');

export default function TowingScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [allServices, setAllServices] = useState<any[]>([]);
  const [activeChip, setActiveChip] = useState<'top' | 'near' | 'cheap'>('top');
  const [openOnly, setOpenOnly] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const loadTowingServices = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/services`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      const servicesArray = Array.isArray(data) ? data : (data.data || []);
      
      // Filter only towing/evakuator services
      const towingServices = servicesArray.filter((service: any) => {
        const category = (service.category || '').toLowerCase();
        const name = (service.name || '').toLowerCase();
        const description = (service.description || '').toLowerCase();
        
        return category.includes('ევაკუატორ') || 
               category.includes('towing') ||
               name.includes('ევაკუატორ') ||
               name.includes('towing') ||
               description.includes('ევაკუატორ') ||
               description.includes('towing');
      });
      
      const services = towingServices.map((service: any) => ({
        id: service.id || service._id,
        name: service.name,
        description: service.description,
        category: service.category || 'ევაკუატორი',
        location: service.location,
        address: service.address,
        phone: service.phone,
        price: service.price,
        rating: service.rating || 0,
        reviews: service.reviews || 0,
        images: service.images || [],
        avatar: service.avatar,
        isOpen: service.isOpen !== undefined ? service.isOpen : true,
        waitTime: service.waitTime,
        workingHours: service.workingHours,
        latitude: service.latitude,
        longitude: service.longitude,
        distance: service.distance,
      }));
      
      setAllServices(services);
    } catch (error) {
      console.error('❌ [TOWING] Error loading services:', error);
      setAllServices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTowingServices();
  }, [loadTowingServices]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadTowingServices();
    setRefreshing(false);
  }, [loadTowingServices]);

  const handleChipPress = (chipId: 'top' | 'near' | 'cheap' | 'open') => {
    if (chipId === 'open') {
      setOpenOnly((prev) => !prev);
      return;
    }
    setActiveChip(chipId);
  };

  const filteredServices = useMemo(() => {
    let list = [...allServices];
    
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(l => 
        (l.name || '').toLowerCase().includes(q) || 
        (l.address || '').toLowerCase().includes(q) ||
        (l.description || '').toLowerCase().includes(q)
      );
    }
    
    if (openOnly) {
      list = list.filter((l) => l.isOpen);
    }
    
    return list;
  }, [allServices, searchQuery, openOnly]);

  const sortedServices = useMemo(() => {
    return [...filteredServices].sort((a, b) => {
      switch (activeChip) {
        case 'top':
          return b.rating - a.rating;
        case 'near':
          const distanceA = parseFloat(String(a.distance || '0').replace(/[^\d.]/g, ''));
          const distanceB = parseFloat(String(b.distance || '0').replace(/[^\d.]/g, ''));
          return distanceA - distanceB;
        case 'cheap':
          const priceA = parseInt(String(a.price || '0').replace(/[^\d]/g, ''));
          const priceB = parseInt(String(b.price || '0').replace(/[^\d]/g, ''));
          return priceA - priceB;
        default:
          return 0;
      }
    });
  }, [filteredServices, activeChip]);

  const handleLocationPress = (location: any) => {
    router.push({
      pathname: '/details',
      params: {
        id: location.id,
        type: 'towing',
        title: location.name,
        lat: location.latitude || 41.7151,
        lng: location.longitude || 44.8271,
        rating: location.rating,
        distance: location.distance,
        price: location.price,
        address: location.address,
        description: location.description,
        category: location.category || 'ევაკუატორი',
        isOpen: location.isOpen,
        phone: location.phone,
        workingHours: location.workingHours,
        image: location.images?.[0] || location.avatar,
      }
    });
  };

  const handleCall = (phone: string) => {
    if (phone) {
      Linking.openURL(`tel:${phone}`);
    }
  };

  const renderServiceCard = ({ item: location }: { item: any }) => (
    <TouchableOpacity
      style={styles.listItem}
      onPress={() => handleLocationPress(location)}
      activeOpacity={0.7}
    >
      <Image
        source={{
          uri:
            location.images?.[0] ||
            'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800',
        }}
        style={styles.listItemThumbnail}
        resizeMode="cover"
      />

      <View style={styles.listItemContent}>
        <View style={styles.listTitleRow}>
          <Text style={styles.listItemTitle} numberOfLines={1}>
            {location.name || 'ევაკუატორი'}
          </Text>
          {location.isOpen ? (
            <View style={styles.openBadge}>
              <Text style={styles.openBadgeText}>ღიაა</Text>
            </View>
          ) : null}
        </View>

        {location.description ? (
          <Text style={styles.listItemSubtitle} numberOfLines={2}>
            {location.description}
          </Text>
        ) : null}

        <View style={styles.listMetaRow}>
          {(location.address || location.location) ? (
            <View style={styles.metaItem}>
              <Ionicons name="location-outline" size={12} color="#6B7280" />
              <Text style={styles.metaText} numberOfLines={1}>
                {location.address || location.location}
              </Text>
            </View>
          ) : null}

          {location.distance ? (
            <View style={styles.metaItem}>
              <Ionicons name="navigate-outline" size={12} color="#6B7280" />
              <Text style={styles.metaText}>{location.distance}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.listBottomRow}>
          <View style={styles.ratingContainer}>
            <Ionicons name="star" size={14} color="#F59E0B" />
            <Text style={styles.ratingText}>
              {Number(location.rating || 0).toFixed(1)}
            </Text>
            {location.reviews ? (
              <Text style={styles.reviewsText}>({location.reviews})</Text>
            ) : null}
          </View>
          {location.price ? (
            <Text style={styles.priceText} numberOfLines={1}>
              {location.price}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.listActions}>
        {location.phone ? (
          <TouchableOpacity
            style={styles.callIconBtn}
            onPress={(e) => {
              e.stopPropagation();
              handleCall(location.phone);
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="call-outline" size={18} color="#111827" />
          </TouchableOpacity>
        ) : null}
        <View style={styles.chevronWrap}>
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent />

      <View style={styles.topBar}>
        <SafeAreaView edges={['top']}>
          <View style={styles.topBarContent}>
            <TouchableOpacity style={styles.topBarButton} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.topBarTitle}>ევაკუატორი</Text>
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
            placeholder="ძიება სახელით ან მისამართით"
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

        <FlatList
          horizontal
          data={[
            { id: 'top', label: 'ტოპ რეიტინგი', icon: 'star-outline' },
            { id: 'near', label: 'ახლოს', icon: 'navigate-outline' },
            { id: 'cheap', label: 'ყველაზე იაფი', icon: 'cash-outline' },
            { id: 'open', label: 'მხოლოდ ღია', icon: 'time-outline' },
          ]}
          keyExtractor={(x) => x.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
          renderItem={({ item }) => {
            const isActive = item.id === 'open' ? openOnly : activeChip === item.id;
            return (
              <TouchableOpacity
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => handleChipPress(item.id as any)}
              >
                <Ionicons
                  name={item.icon as any}
                  size={16}
                  color={isActive ? '#FFFFFF' : '#6B7280'}
                />
                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Services List */}
      {loading && allServices.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#111827" />
          <Text style={styles.loadingText}>იტვირთება...</Text>
        </View>
      ) : sortedServices.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="car-outline" size={64} color="#9CA3AF" />
          <Text style={styles.emptyText}>ევაკუატორის სერვისები ვერ მოიძებნა</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={sortedServices}
          renderItem={renderServiceCard}
          keyExtractor={(item, index) => item.id || `${index}`}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#111827" />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      <AddModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={(_type: AddModalType) => {
          setShowAddModal(false);
          loadTowingServices();
        }}
        defaultType="service"
        defaultFormData={{ category: 'ევაკუატორი' }}
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
    paddingRight: 20,
    gap: 12,
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
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 100,
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
    marginBottom: 12,
  },
  listItemThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    marginRight: 12,
  },
  listItemContent: { flex: 1, gap: 4 },
  listTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  listItemTitle: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '600',
    color: '#111827',
  },
  openBadge: {
    backgroundColor: '#111827',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  openBadgeText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  listItemSubtitle: {
    fontSize: 13,
    fontFamily: 'HelveticaMedium',
    color: '#6B7280',
    fontWeight: '500',
    lineHeight: 18,
  },
  listMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '500',
    maxWidth: 160,
  },
  listBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 13,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#111827',
  },
  reviewsText: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '500',
  },
  priceText: {
    fontSize: 13,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#111827',
  },
  listActions: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginLeft: 8,
  },
  callIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevronWrap: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#9CA3AF',
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '500',
    marginTop: 16,
  },
});

