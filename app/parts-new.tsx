import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ImageBackground,
  StatusBar,
  FlatList,
  Dimensions,
  ActivityIndicator,
  Modal,
  TextInput,
  Platform,
  ViewToken,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { addItemApi } from '../services/addItemApi';
import { useUser } from '../contexts/UserContext';
import { DetailItem } from '../components/ui/DetailModal';
import AddModal, { AddModalType } from '../components/ui/AddModal';
import { engagementApi } from '../services/engagementApi';
import FilterModal, { DismantlerFilters, PartsFilters } from '../components/ui/FilterModal';
import { specialOffersApi } from '../services/specialOffersApi';
import SpecialOfferModal, { SpecialOfferModalData } from '../components/ui/SpecialOfferModal';
import SpecialOfferCard from '../components/ui/SpecialOfferCard';
import { analyticsService } from '../services/analytics';

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

export default function PartsNewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState<'დაშლილები' | 'ნაწილები'>('დაშლილები');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Filter states
  const [dismantlerFilters, setDismantlerFilters] = useState<DismantlerFilters>({
    brand: '',
    model: '',
    yearFrom: '',
    yearTo: '',
    location: '',
  });

  const [partsFilters, setPartsFilters] = useState<PartsFilters>({
    brand: '',
    category: '',
    priceMin: '',
    priceMax: '',
    location: '',
  });
  
  // Data states
  const [parts, setParts] = useState<any[]>([]);
  const [vipDismantlers, setVipDismantlers] = useState<any[]>([]);
  const [vipParts, setVipParts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false); // საწყისი ჩატვირთვა / ტაბის ან ფილტრების შეცვლა
  const [isLoadingMore, setIsLoadingMore] = useState(false); // "load more" pagination
  const [dismantlersLikes, setDismantlersLikes] = useState<Record<string, { likesCount: number; isLiked: boolean }>>({});
  const [partsLikes, setPartsLikes] = useState<Record<string, { likesCount: number; isLiked: boolean }>>({});

  const ITEMS_PER_PAGE = 3;
  const [displayedDismantlers, setDisplayedDismantlers] = useState<any[]>([]);
  const [dismantlersPage, setDismantlersPage] = useState(1);
  const [dismantlersHasMore, setDismantlersHasMore] = useState(true);
  const DISMANTLERS_PAGE_SIZE = 20;
  const [specialOffers, setSpecialOffers] = useState<any[]>([]);
  const [showSpecialOfferModal, setShowSpecialOfferModal] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<SpecialOfferModalData | null>(null);

  const vipImpressionsRef = useRef<Set<string>>(new Set());
  const vipViewabilityConfigRef = useRef({ itemVisiblePercentThreshold: 60, minimumViewTime: 600 });
  const onViewableVipItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<ViewToken> }) => {
      if (!viewableItems || viewableItems.length === 0) return;
      viewableItems.forEach((v) => {
        const it: any = v.item;
        const itemId = it?.id || it?._id;
        if (!itemId) return;
        const key = String(itemId);
        if (vipImpressionsRef.current.has(key)) return;
        vipImpressionsRef.current.add(key);

        const itemName = String(activeTab === 'დაშლილები' ? (it?.name || '') : (it?.title || it?.name || ''));
        analyticsService.logSalesItemImpression(
          key,
          itemName,
          activeTab === 'დაშლილები' ? 'dismantler' : 'part',
          'ავტონაწილები',
          user?.id,
          { placement: 'vip', active_tab: activeTab }
        );
      });
    }
  ).current;

  useFocusEffect(
    React.useCallback(() => {
      analyticsService.logScreenViewWithBackend('ავტონაწილები', 'PartsNewScreen', user?.id);
    }, [user?.id])
  );

  // Debug: current device screen size (Android/iOS)
  useEffect(() => {
    const { width: deviceWidth, height: deviceHeight } = Dimensions.get('window');
    console.log('📱 Device size -> width:', deviceWidth, 'height:', deviceHeight);
  }, []);

  // Load data
  const loadDismantlers = async (page: number = 1, append: boolean = false) => {
    try {
      if (append) {
        setIsLoadingMore(true);
      } else {
        setLoading(true);
      }
      const filters: any = {
        limit: DISMANTLERS_PAGE_SIZE,
        page,
      };
      if (dismantlerFilters.brand) filters.brand = dismantlerFilters.brand;
      if (dismantlerFilters.model) filters.model = dismantlerFilters.model;
      if (dismantlerFilters.yearFrom) filters.yearFrom = dismantlerFilters.yearFrom;
      if (dismantlerFilters.yearTo) filters.yearTo = dismantlerFilters.yearTo;
      if (dismantlerFilters.location) filters.location = dismantlerFilters.location;
      
      console.log('🔍 Request filters:', filters);
      const response = await addItemApi.getDismantlers(filters);
      console.log('📡 API Response:', response);
      if (response.success && response.data) {
        const pageDismantlers = response.data;
        console.log('📊 Dismantlers page received:', pageDismantlers.length);
        
        const vip = page === 1
          ? pageDismantlers.filter((d: any) => d.isVip === true)
          : vipDismantlers;
        const regular = pageDismantlers.filter((d: any) => d.isVip !== true);
        
        console.log('⭐ VIP dismantlers:', vip.length);
        console.log('📋 Regular dismantlers:', regular.length);
        
        if (append) {
          setVipDismantlers(vip);
          setDisplayedDismantlers((prev) => [...prev, ...regular]);
        } else {
          setVipDismantlers(vip);
          setDisplayedDismantlers(regular);
        }

        // თუ საერთოდ გვერდზე რამე მაინც მოვიდა, კიდევ ვცდილობთ შემდეგ გვერდს
        // (hasMore გახდება false მხოლოდ მაშინ, როცა გვერდი ცარიელია)
        setDismantlersHasMore(pageDismantlers.length === DISMANTLERS_PAGE_SIZE);
        setDismantlersPage(page);
      }
    } catch (error) {
      console.error('Error loading dismantlers:', error);
    } finally {
      if (append) {
        setIsLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  };

  const loadParts = async () => {
    try {
      setLoading(true);
      const filters: any = { page: 1, limit: ITEMS_PER_PAGE };
      if (partsFilters.brand) filters.brand = partsFilters.brand;
      if (partsFilters.category) filters.category = partsFilters.category;
      if (partsFilters.priceMin) filters.minPrice = partsFilters.priceMin;
      if (partsFilters.priceMax) filters.maxPrice = partsFilters.priceMax;
      if (partsFilters.location) filters.location = partsFilters.location;
      
      const response = await addItemApi.getParts(filters);
      if (response.success && response.data) {
        const allParts = response.data;
        const vip = allParts.filter((p: any) => p.isVip === true);
        const regular = allParts.filter((p: any) => p.isVip !== true);
        setParts(regular);
        setVipParts(vip);
      }
    } catch (error) {
      console.error('Error loading parts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'დაშლილები') {
      // reset pagination when switching back to dismantlers
      setDismantlersPage(1);
      setDismantlersHasMore(true);
      loadDismantlers(1, false);
    } else {
      loadParts();
    }
  }, [activeTab]);

  useEffect(() => {
    let cancelled = false;
    specialOffersApi.getSpecialOffers(true).then((data) => {
      if (!cancelled) setSpecialOffers(Array.isArray(data) ? data : []);
    });
    return () => { cancelled = true; };
  }, []);

  const handleApplyFilters = (newDismantlerFilters: DismantlerFilters, newPartsFilters: PartsFilters) => {
    analyticsService.logButtonClick(
      'ფილტრის გამოყენება',
      'ავტონაწილები',
      { active_tab: activeTab, dismantler_filters: newDismantlerFilters, parts_filters: newPartsFilters },
      user?.id
    );
    setDismantlerFilters(newDismantlerFilters);
    setPartsFilters(newPartsFilters);
    // Reload data with filters
    if (activeTab === 'დაშლილები') {
      setDismantlersPage(1);
      setDismantlersHasMore(true);
      loadDismantlers(1, false);
    } else {
      loadParts();
    }
  };

  const handleResetFilters = () => {
    analyticsService.logButtonClick('ფილტრის გასუფთავება', 'ავტონაწილები', { active_tab: activeTab }, user?.id);
    setDismantlerFilters({
      brand: '',
      model: '',
      yearFrom: '',
      yearTo: '',
      location: '',
    });
    setPartsFilters({
      brand: '',
      category: '',
      priceMin: '',
      priceMax: '',
      location: '',
    });
  };

  // Convert functions
  const convertDismantlerToDetailItem = (dismantler: any): DetailItem => {
    const mainImage = dismantler.photos?.[0] || dismantler.images?.[0] || dismantler.image || 'https://images.unsplash.com/photo-1563298723-dcfebaa392e3?q=80&w=800&auto=format&fit=crop';
    return {
      id: dismantler.id || dismantler._id,
      title: dismantler.name,
      description: dismantler.description,
      image: mainImage,
      type: 'dismantler',
      location: dismantler.location,
      phone: dismantler.phone,
      gallery: dismantler.photos || [mainImage],
      specifications: {
        'ბრენდი': dismantler.brand || '',
        'მოდელი': dismantler.model || '',
        'წლები': (dismantler.yearFrom && dismantler.yearTo) ? `${dismantler.yearFrom} - ${dismantler.yearTo}` : '',
        'მდებარეობა': dismantler.location || '',
        'ტელეფონი': dismantler.phone || '',
      }
    };
  };

  const convertPartToDetailItem = (part: any): DetailItem => {
    const mainImage = part.photos?.[0] || part.images?.[0] || part.image || 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?q=80&w=800&auto=format&fit=crop';
    return {
      id: part.id || part._id,
      title: part.title || part.name,
      description: part.description,
      price: part.price,
      image: mainImage,
      type: 'part',
      location: part.location,
      phone: part.phone,
      gallery: part.photos || [mainImage],
      specifications: {
        'ბრენდი': part.brand || '',
        'კატეგორია': part.category || '',
        'მდგომარეობა': part.condition || '',
        'მდებარეობა': part.location || '',
        'ტელეფონი': part.phone || '',
      }
    };
  };

  // Render VIP Card (Horizontal) - Memoized for performance
  const renderVIPCard = React.useCallback(({ item }: { item: any }) => {
    const isDismantler = activeTab === 'დაშლილები';
    const image = item.photos?.[0] || item.images?.[0] || item.image || 'https://images.unsplash.com/photo-1563298723-dcfebaa392e3?q=80&w=800&auto=format&fit=crop';
    
    return (
      <TouchableOpacity
        style={styles.vipCard}
        onPress={() => {
          const itemId = item.id || item._id;
          if (itemId) {
            analyticsService.logSalesItemClick(
              String(itemId),
              String(isDismantler ? item.name : (item.title || item.name || '')),
              isDismantler ? 'dismantler' : 'part',
              'ავტონაწილები',
              user?.id
            );
          }
          const detailItem = isDismantler ? convertDismantlerToDetailItem(item) : convertPartToDetailItem(item);
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
              {isDismantler ? item.name : (item.title || item.name)}
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
  }, [activeTab]);

  // Render List Item (Vertical) - Memoized for performance
  const renderListItem = React.useCallback(({ item, index }: { item: any; index: number }) => {
    const isDismantler = activeTab === 'დაშლილები';
    const itemId = item.id || item._id;
    const image = item.photos?.[0] || item.images?.[0] || item.image || 'https://images.unsplash.com/photo-1563298723-dcfebaa392e3?q=80&w=800&auto=format&fit=crop';
    const likes = isDismantler ? dismantlersLikes[itemId] : partsLikes[itemId];
    
    return (
      <TouchableOpacity
        style={styles.listItem}
        onPress={() => {
          if (itemId) {
            analyticsService.logSalesItemClick(
              String(itemId),
              String(isDismantler ? item.name : (item.title || item.name || '')),
              isDismantler ? 'dismantler' : 'part',
              'ავტონაწილები',
              user?.id
            );
          }
          const detailItem = isDismantler ? convertDismantlerToDetailItem(item) : convertPartToDetailItem(item);
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
            {isDismantler ? item.name : (item.title || item.name)}
          </Text>
          {isDismantler && item.brand && item.model && (
            <Text style={styles.listItemSubtitle} numberOfLines={1}>
              {item.brand} {item.model}
            </Text>
          )}
          {!isDismantler && item.category && (
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
          {!isDismantler && item.price && (
            <Text style={styles.listItemPrice}>{item.price}₾</Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.listItemIndicator}
          onPress={(e) => {
            e.stopPropagation();
            if (itemId) {
              analyticsService.logSalesItemClick(
                String(itemId),
                String(isDismantler ? item.name : (item.title || item.name || '')),
                isDismantler ? 'dismantler' : 'part',
                'ავტონაწილები',
                user?.id
              );
            }
            const detailItem = isDismantler ? convertDismantlerToDetailItem(item) : convertPartToDetailItem(item);
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
  }, [activeTab, dismantlersLikes, partsLikes]);

  const handleAddItem = (type: AddModalType, data: any) => {
    if (activeTab === 'დაშლილები') {
      loadDismantlers();
    } else {
      loadParts();
    }
  };

  const currentData = activeTab === 'დაშლილები' ? displayedDismantlers : parts;
  const currentVipData = activeTab === 'დაშლილები' ? vipDismantlers : vipParts;

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
  
  // Load more dismantlers when scrolling
  const loadMoreDismantlers = () => {
    if (loading || isLoadingMore || !dismantlersHasMore) return;
    const nextPage = dismantlersPage + 1;
    console.log('📜 Loading more dismantlers. Next page:', nextPage);
    loadDismantlers(nextPage, true);
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
                if (params.fromCategory || params.categoryId) {
                  router.push({
                    pathname: '/category',
                    params: {
                      type: params.categoryType || 'part',
                      categoryId: params.categoryId,
                      name: params.categoryName,
                    }
                  });
                } else if (router.canGoBack()) {
                  router.back();
                } else {
                  router.push('/(tabs)' as any);
                }
              }}
            >
              <Ionicons name="arrow-back" size={24} color="#111827" />
            </TouchableOpacity>
            
            <Text style={styles.topBarTitle}>ავტონაწილები</Text>
            
            <View style={styles.topBarRight}>
              <TouchableOpacity
                style={styles.topBarButton}
                onPress={() => {
                  analyticsService.logButtonClick('ფილტრი', 'ავტონაწილები', { active_tab: activeTab }, user?.id);
                  setShowFilterModal(true);
                }}
              >
                <Ionicons name="options" size={24} color="#111827" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.topBarButton}
                onPress={() => {
                  analyticsService.logButtonClick('დამატება', 'ავტონაწილები', { active_tab: activeTab }, user?.id);
                  setShowAddModal(true);
                }}
              >
                <Ionicons name="add" size={24} color="#111827" />
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </View>

      {/* Navigation/Filter Section */}
      <View style={styles.navSection}>
        <View style={styles.segmentControl}>
          <TouchableOpacity
            style={[styles.segmentItem, activeTab === 'დაშლილები' && styles.segmentItemActive]}
            onPress={() => {
              analyticsService.logButtonClick('ტაბი: დაშლილები', 'ავტონაწილები', undefined, user?.id);
              setActiveTab('დაშლილები');
            }}
          >
            <Text style={[styles.segmentText, activeTab === 'დაშლილები' && styles.segmentTextActive]}>
              დაშლილები
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentItem, activeTab === 'ნაწილები' && styles.segmentItemActive]}
            onPress={() => {
              analyticsService.logButtonClick('ტაბი: ნაწილები', 'ავტონაწილები', undefined, user?.id);
              setActiveTab('ნაწილები');
            }}
          >
            <Text style={[styles.segmentText, activeTab === 'ნაწილები' && styles.segmentTextActive]}>
              ნაწილები
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        style={styles.content}
        data={currentData}
        keyExtractor={(item: any, index: number) => {
          const id = item.id || item._id;
          const prefix = activeTab === 'დაშლილები' ? 'dismantler' : 'part';
          return id ? `${prefix}-${id}` : `${prefix}-${index}`;
        }}
        renderItem={({ item, index }: { item: any; index: number }) =>
          renderListItem({ item, index })
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.verticalList}
        ListHeaderComponent={
          <>
            {/* Section Title - Skeleton */}
            {loading && currentData.length === 0 ? (
              <View style={styles.sectionTitleSkeleton} />
            ) : (
              <View style={styles.sectionTitleContainer}>
                <Text style={styles.sectionTitle}>
                  {activeTab === 'დაშლილები' ? 'VIP დაშლილები' : 'VIP ნაწილები'}
                </Text>
              </View>
            )}

            {/* Horizontal Scroll - VIP Cards */}
            {loading && currentVipData.length === 0 ? (
              <View style={styles.horizontalScroll}>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </View>
            ) : currentVipData.length > 0 ? (
              <FlatList
                horizontal
                data={currentVipData}
                renderItem={renderVIPCard}
                keyExtractor={(item, index) => item.id || item._id || `vip-${index}`}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalScroll}
                removeClippedSubviews={Platform.OS === 'ios'}
                initialNumToRender={2}
                maxToRenderPerBatch={2}
                windowSize={2}
                onViewableItemsChanged={onViewableVipItemsChanged}
                viewabilityConfig={vipViewabilityConfigRef.current}
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
            {loading && currentData.length === 0 ? (
              <View style={styles.sectionTitleSkeleton} />
            ) : (
              <View style={styles.sectionTitleContainer}>
                <Text style={styles.sectionTitle}>
                  {activeTab === 'დაშლილები' ? 'დაშლილების მაღაზიები' : 'პოპულარული ნაწილები'}
                </Text>
              </View>
            )}

            {/* Vertical skeleton while loading */}
            {loading && currentData.length === 0 && (
              <View style={styles.verticalList}>
                <SkeletonListItem />
                <SkeletonListItem />
                <SkeletonListItem />
                <SkeletonListItem />
              </View>
            )}
          </>
        }
        ListEmptyComponent={
          !loading && currentData.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                {activeTab === 'დაშლილები' ? 'დაშლილები არ მოიძებნა' : 'ნაწილები არ მოიძებნა'}
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          <>
            {activeTab === 'დაშლილები' && isLoadingMore && (
              <View style={styles.loadingMoreContainer}>
                <ActivityIndicator size="small" color="#111827" />
                <Text style={styles.loadingMoreText}>იტვირთება...</Text>
              </View>
            )}
            <View style={{ height: 100 }} />
          </>
        }
        onEndReached={
          activeTab === 'დაშლილები' ? loadMoreDismantlers : undefined
        }
        onEndReachedThreshold={0.5}
        removeClippedSubviews
        initialNumToRender={activeTab === 'დაშლილები' ? 5 : 8}
        maxToRenderPerBatch={activeTab === 'დაშლილები' ? 3 : 6}
        windowSize={5}
        updateCellsBatchingPeriod={100}
        getItemLayout={
          activeTab === 'დაშლილები'
            ? (data, index) => ({
                length: 120,
                offset: 120 * index,
                index,
              })
            : undefined
        }
      />

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          analyticsService.logButtonClick('დამატება (FAB)', 'ავტონაწილები', { active_tab: activeTab }, user?.id);
          setShowAddModal(true);
        }}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>


      {/* Filter Modal */}
      <FilterModal
        visible={showFilterModal}
        activeTab={activeTab}
        dismantlerFilters={dismantlerFilters}
        partsFilters={partsFilters}
        onClose={() => setShowFilterModal(false)}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
      />

      {/* Add Modal */}
      <AddModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleAddItem}
        defaultType={activeTab === 'დაშლილები' ? 'dismantler' : 'part'}
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
  // Navigation Section
  navSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  segmentControl: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentItemActive: {
    backgroundColor: '#111827',
  },
  segmentText: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: '#6B7280',
    fontWeight: '600',
  },
  segmentTextActive: {
    color: '#FFFFFF',
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
  // Offer Card (სპეციალური შეთავაზებები)
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
  offerCardImageStyle: {
    resizeMode: 'cover',
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
  offerCardContent: {
    gap: 8,
  },
  offerCardTitle: {
    fontSize: 16,
    fontFamily: 'HelveticaMedium',
    fontWeight: '700',
    color: '#FFFFFF',
  },
  offerPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
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
  listItemPrice: {
    fontSize: 16,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#111827',
    marginTop: 4,
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
