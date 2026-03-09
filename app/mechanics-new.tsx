import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ImageBackground,
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
import { mechanicsApi, MechanicDTO } from '@/services/mechanicsApi';
import { useUser } from '../contexts/UserContext';
import { DetailItem } from '../components/ui/DetailModal';
import AddModal, { AddModalType } from '../components/ui/AddModal';
import { specialOffersApi } from '../services/specialOffersApi';
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

export default function MechanicsNewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useUser();
  const [showAddModal, setShowAddModal] = useState(false);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [specialty, setSpecialty] = useState<string>('');
  
  // Data states
  const [mechanics, setMechanics] = useState<MechanicDTO[]>([]);
  const [vipMechanics, setVipMechanics] = useState<MechanicDTO[]>([]);
  const [regularMechanics, setRegularMechanics] = useState<MechanicDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [allMechanicsData, setAllMechanicsData] = useState<MechanicDTO[]>([]);
  const [displayedMechanics, setDisplayedMechanics] = useState<MechanicDTO[]>([]);
  const [displayedMechanicsCount, setDisplayedMechanicsCount] = useState(10);
  const [specialOffers, setSpecialOffers] = useState<any[]>([]);
  const [showSpecialOfferModal, setShowSpecialOfferModal] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<SpecialOfferModalData | null>(null);

  const SPECIALTIES: string[] = [
    'ზოგადი სერვისი',
    'კომპიუტერული დიაგნოსტიკა',
    'ძრავი (ტაიმინგი/ზეთის სისტემა)',
    'გადაცემათა კოლოფი (ავტომატი)',
    'გადაცემათა კოლოფი (მექანიკა)',
    'სავალი ნაწილი / ამორტიზატორი',
    'მუხრუჭები',
    'გაგრილების სისტემა (რადიატორი/ტუმბო)',
    'საწვავის სისტემა (ინჟექტორი/ტუმბო)',
    'ავტოელექტრიკა / ელექტრონიკა',
    'სტარტერი / გენერატორი',
    'კონდიციონერი / კლიმატი',
    'გამონაბოლქვი / გამომშვები სისტემა',
    'საბურავები / დაბალანსება / ვულკანიზაცია',
    'კუზავი / ფერწერა / შედუღება',
    'დეტეილინგი / ანტიკოროზია',
  ];

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  // Load mechanics
  const loadMechanics = useCallback(async () => {
    try {
      setLoading(true);
      const params: { q?: string; specialty?: string } = {};
      if (debounced.trim()) params.q = debounced.trim();
      if (specialty) params.specialty = specialty;
      
      const data = await mechanicsApi.getMechanics(params);
      
      // Separate VIP and regular mechanics
      const vip = data.filter((m: MechanicDTO) => m.isFeatured);
      const regular = data.filter((m: MechanicDTO) => !m.isFeatured);
      
      setVipMechanics(vip);
      setRegularMechanics(regular);
      setMechanics(data);
      setAllMechanicsData(regular);
      // Start with first 10 items
      setDisplayedMechanics(regular.slice(0, 10));
      setDisplayedMechanicsCount(10);
    } catch (error) {
      console.error('Error loading mechanics:', error);
    } finally {
      setLoading(false);
    }
  }, [debounced, specialty]);

  useEffect(() => {
    loadMechanics();
  }, [loadMechanics]);

  useEffect(() => {
    let cancelled = false;
    specialOffersApi.getSpecialOffers(true).then((data) => {
      if (!cancelled) setSpecialOffers(Array.isArray(data) ? data : []);
    });
    return () => { cancelled = true; };
  }, []);

  const renderSpecialOfferCard = ({ item: offer }: { item: any; index: number }) => {
    const offerData: SpecialOfferModalData = {
      id: offer.id,
      storeId: offer.storeId,
      discount: offer.discount,
      oldPrice: offer.oldPrice,
      newPrice: offer.newPrice,
      title: offer.title,
      description: offer.description,
      image: offer.image,
      name: offer.name,
    };
    return (
      <SpecialOfferCard
        offer={offer}
        onPress={() => {
          setSelectedOffer(offerData);
          setShowSpecialOfferModal(true);
        }}
      />
    );
  };

  // Load more mechanics when scrolling
  const loadMoreMechanics = () => {
    if (displayedMechanicsCount < allMechanicsData.length) {
      const nextCount = Math.min(displayedMechanicsCount + 10, allMechanicsData.length);
      setDisplayedMechanics(allMechanicsData.slice(0, nextCount));
      setDisplayedMechanicsCount(nextCount);
    }
  };

  // Convert mechanic to DetailItem
  const convertMechanicToDetailItem = (mechanic: MechanicDTO): DetailItem => {
    const mainImage = mechanic.avatar || 'https://images.unsplash.com/photo-1581094271901-8022df4466b9?q=80&w=600&auto=format&fit=crop';
    return {
      id: mechanic.id,
      title: mechanic.name,
      name: mechanic.name,
      description: mechanic.description || `${mechanic.name} - პროფესიონალი ${mechanic.specialty}`,
      image: mainImage,
      type: 'mechanic',
      location: mechanic.location,
      phone: mechanic.phone,
      address: mechanic.address,
      gallery: mechanic.avatar ? [mechanic.avatar] : [mainImage],
      services: mechanic.services,
      specifications: {
        'სპეციალობა': mechanic.specialty || '',
        'გამოცდილება': mechanic.experience || '',
        'მდებარეობა': mechanic.location || '',
        'ტელეფონი': mechanic.phone || '',
        'რეიტინგი': mechanic.rating ? `${mechanic.rating.toFixed(1)} ⭐` : '',
        'რევიუები': mechanic.reviews ? `${mechanic.reviews} რევიუ` : '',
      }
    };
  };

  // Render VIP Card (Horizontal) - Memoized for performance
  const renderVIPCard = React.useCallback(({ item }: { item: MechanicDTO }) => {
    const image = item.avatar || 'https://images.unsplash.com/photo-1581094271901-8022df4466b9?q=80&w=600&auto=format&fit=crop';
    
    return (
      <TouchableOpacity
        style={styles.vipCard}
        onPress={() => {
          const detailItem = convertMechanicToDetailItem(item);
          router.push({
            pathname: '/parts-details-new',
            params: { item: JSON.stringify(detailItem) }
          });
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
            {item.specialty && (
              <View style={styles.vipCardMeta}>
                <Ionicons name="construct" size={14} color="#FFFFFF" />
                <Text style={styles.vipCardLocation}>{item.specialty}</Text>
              </View>
            )}
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  }, []);

  // Render List Item (Vertical) - Memoized for performance
  const renderListItem = React.useCallback(({ item, index }: { item: MechanicDTO; index: number }) => {
    const image = item.avatar || 'https://images.unsplash.com/photo-1581094271901-8022df4466b9?q=80&w=600&auto=format&fit=crop';
    
    return (
      <TouchableOpacity
        style={styles.listItem}
        onPress={() => {
          const detailItem = convertMechanicToDetailItem(item);
          router.push({
            pathname: '/parts-details-new',
            params: { item: JSON.stringify(detailItem) }
          });
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
          {item.specialty && (
            <Text style={styles.listItemSubtitle} numberOfLines={1}>
              {item.specialty}
            </Text>
          )}
          {item.location && (
            <View style={styles.listItemMeta}>
              <Ionicons name="location-outline" size={12} color="#6B7280" />
              <Text style={styles.listItemLocation}>{item.location}</Text>
            </View>
          )}
          {item.rating && (
            <View style={styles.listItemMeta}>
              <Ionicons name="star" size={12} color="#F59E0B" />
              <Text style={styles.listItemLocation}>{item.rating.toFixed(1)} ⭐</Text>
              {item.reviews && (
                <Text style={styles.listItemLocation}> • {item.reviews} რევიუ</Text>
              )}
            </View>
          )}
        </View>
        <TouchableOpacity
          style={styles.listItemIndicator}
          onPress={(e) => {
            e.stopPropagation();
            const detailItem = convertMechanicToDetailItem(item);
            router.push({
              pathname: '/parts-details-new',
              params: { item: JSON.stringify(detailItem) }
            });
          }}
        >
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }, []);

  const handleAddItem = (type: AddModalType, data: any) => {
    loadMechanics();
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
            
            <Text style={styles.topBarTitle}>ხელოსნები</Text>
            
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
            placeholder="ძიება სახელით ან სპეციალობით"
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
        
        {/* Specialty Pills */}
        <View style={styles.pillsContainer}>
          <FlatList
            data={["ყველა", ...SPECIALTIES]}
            keyExtractor={(i) => i}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillsList}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.pill,
                  (item === 'ყველა' ? !specialty : specialty === item) && styles.pillActive,
                ]}
                onPress={() => setSpecialty(item === 'ყველა' ? '' : item)}
              >
                <Text style={[
                  styles.pillText, 
                  (item === 'ყველა' ? !specialty : specialty === item) && styles.pillTextActive
                ]}>
                  {item}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Section Title - VIP */}
        {loading ? (
          <View style={styles.sectionTitleSkeleton} />
        ) : (
          <View style={styles.sectionTitleContainer}>
            <Text style={styles.sectionTitle}>VIP ხელოსნები</Text>
          </View>
        )}

        {/* Horizontal Scroll - VIP Cards */}
        {loading ? (
          <View style={styles.horizontalScroll}>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </View>
        ) : vipMechanics.length > 0 ? (
          <FlatList
            horizontal
            data={vipMechanics}
            renderItem={renderVIPCard}
            keyExtractor={(item, index) => item.id || `vip-${index}`}
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
              renderItem={renderSpecialOfferCard}
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
            <Text style={styles.sectionTitle}>ყველა ხელოსანი</Text>
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
        ) : displayedMechanics.length > 0 ? (
          <FlatList
            data={displayedMechanics}
            renderItem={renderListItem}
            keyExtractor={(item, index) => {
              const id = item.id;
              return id ? `mechanic-${id}` : `mechanic-${index}`;
            }}
            scrollEnabled={false}
            nestedScrollEnabled={true}
            contentContainerStyle={styles.verticalList}
            onEndReached={loadMoreMechanics}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              displayedMechanicsCount < allMechanicsData.length ? (
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
            <Text style={styles.emptyText}>ხელოსნები ვერ მოიძებნა</Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowAddModal(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Add Modal */}
      <AddModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleAddItem}
        defaultType="mechanic"
      />

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
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    color: '#111827',
    fontSize: 14,
    fontWeight: '500',
  },
  pillsContainer: {
    marginTop: 8,
  },
  pillsList: {
    gap: 8,
    paddingRight: 4,
  },
  pill: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F9FAFB',
  },
  pillActive: {
    borderColor: '#C7D2FE',
    backgroundColor: '#EEF2FF',
  },
  pillText: {
    color: '#6B7280',
    fontWeight: '600',
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
  },
  pillTextActive: {
    color: '#111827',
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
  offerCardImage: { width: '100%', height: '100%' },
  offerCardImageStyle: { resizeMode: 'cover' as const },
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
