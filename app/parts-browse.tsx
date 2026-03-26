import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  StatusBar,
  FlatList,
  Dimensions,
  ActivityIndicator,
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
import FilterModal, { DismantlerFilters, PartsFilters } from '../components/ui/FilterModal';
import { specialOffersApi } from '../services/specialOffersApi';
import SpecialOfferModal, { SpecialOfferModalData } from '../components/ui/SpecialOfferModal';
import SpecialOfferCard from '../components/ui/SpecialOfferCard';
import { analyticsService } from '../services/analytics';

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

const isAndroid = Platform.OS === 'android';
const headerIconSize = isAndroid ? 20 : 24;

const EMPTY_DISMANTLER_FILTERS: DismantlerFilters = {
  brand: '',
  model: '',
  yearFrom: '',
  yearTo: '',
  location: '',
};

const PARTS_PAGE_SIZE = 20;

function formatPartPrice(part: any): string {
  const p = part?.price;
  if (p == null || p === '') return '';
  if (typeof p === 'string' && p.includes('₾')) return p;
  return `${p}₾`;
}

export default function PartsBrowseScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useUser();
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const [partsFilters, setPartsFilters] = useState<PartsFilters>({
    brand: '',
    model: '',
    category: '',
    priceMin: '',
    priceMax: '',
    location: '',
  });

  const [vipParts, setVipParts] = useState<any[]>([]);
  const [displayedParts, setDisplayedParts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [partsPage, setPartsPage] = useState(1);
  const [partsHasMore, setPartsHasMore] = useState(true);

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
        const itemName = String(it?.title || it?.name || '');
        analyticsService.logSalesItemImpression(
          key,
          itemName,
          'part',
          'ნაწილები',
          user?.id,
          { placement: 'vip' }
        );
      });
    }
  ).current;

  useFocusEffect(
    useCallback(() => {
      analyticsService.logScreenViewWithBackend('ნაწილები', 'PartsBrowseScreen', user?.id);
      analyticsService.logSalesPageView('ნაწილები', user?.id);
    }, [user?.id])
  );

  const loadParts = async (
    page: number = 1,
    append: boolean = false,
    filterOverride?: PartsFilters
  ) => {
    const f = filterOverride ?? partsFilters;
    try {
      if (append) {
        setIsLoadingMore(true);
      } else {
        setLoading(true);
      }

      const apiFilters: Record<string, string | number> = {
        page,
        limit: PARTS_PAGE_SIZE,
      };
      if (f.brand) apiFilters.brand = f.brand;
      if (f.model) apiFilters.model = f.model;
      if (f.category) apiFilters.category = f.category;
      if (f.priceMin) apiFilters.minPrice = Number(f.priceMin);
      if (f.priceMax) apiFilters.maxPrice = Number(f.priceMax);
      if (f.location) apiFilters.location = f.location;

      const response = await addItemApi.getParts(apiFilters as any);
      if (response.success && response.data) {
        const pageParts = response.data;
        const vip =
          page === 1 ? pageParts.filter((p: any) => p.isVip === true) : vipParts;
        const regular = pageParts.filter((p: any) => p.isVip !== true);

        if (append) {
          setVipParts(vip);
          setDisplayedParts((prev) => [...prev, ...regular]);
        } else {
          setVipParts(vip);
          setDisplayedParts(regular);
        }

        setPartsHasMore(pageParts.length === PARTS_PAGE_SIZE);
        setPartsPage(page);
      }
    } catch (e) {
      console.error('Error loading parts:', e);
    } finally {
      if (append) {
        setIsLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    setPartsPage(1);
    setPartsHasMore(true);
    loadParts(1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    specialOffersApi.getSpecialOffers(true).then((data) => {
      if (!cancelled) setSpecialOffers(Array.isArray(data) ? data : []);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleApplyFilters = (_d: DismantlerFilters, newPartsFilters: PartsFilters) => {
    analyticsService.logButtonClick(
      'ფილტრის გამოყენება',
      'ნაწილები',
      { parts_filters: newPartsFilters },
      user?.id
    );
    setPartsFilters(newPartsFilters);
    setPartsPage(1);
    setPartsHasMore(true);
    loadParts(1, false, newPartsFilters);
  };

  const handleResetFilters = () => {
    analyticsService.logButtonClick('ფილტრის გასუფთავება', 'ნაწილები', {}, user?.id);
    setPartsFilters({
      brand: '',
      model: '',
      category: '',
      priceMin: '',
      priceMax: '',
      location: '',
    });
  };

  const convertPartToDetailItem = (part: any): DetailItem => {
    const mainImage =
      part.photos?.[0] ||
      part.images?.[0] ||
      part.image ||
      'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?q=80&w=800&auto=format&fit=crop';
    return {
      id: part.id || part._id,
      title: part.title || part.name,
      description: part.description,
      price: part.price,
      image: mainImage,
      type: 'part',
      location: part.location,
      phone: part.phone,
      gallery: part.photos || part.images || [mainImage],
      specifications: {
        ბრენდი: part.brand || '',
        კატეგორია: part.category || '',
        მდგომარეობა: part.condition || '',
        მდებარეობა: part.location || '',
        ტელეფონი: part.phone || '',
      },
    };
  };

  const partDisplayTitle = (item: any) => String(item.title || item.name || 'ნაწილი');

  const renderVIPCard = useCallback(
    ({ item }: { item: any }) => {
      const image =
        item.photos?.[0] ||
        item.images?.[0] ||
        item.image ||
        'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?q=80&w=800&auto=format&fit=crop';
      const priceStr = formatPartPrice(item);

      return (
        <TouchableOpacity
          style={styles.vipCard}
          onPress={() => {
            const itemId = item.id || item._id;
            if (itemId) {
              analyticsService.logSalesItemClick(
                String(itemId),
                partDisplayTitle(item),
                'part',
                'ნაწილები',
                user?.id
              );
            }
            const detailItem = convertPartToDetailItem(item);
            router.push({
              pathname: '/parts-details-new',
              params: { item: JSON.stringify(detailItem) },
            });
          }}
          activeOpacity={0.8}
        >
          <Image source={{ uri: image }} style={styles.vipCardImage} resizeMode="cover" />
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
                {partDisplayTitle(item)}
              </Text>
              {item.location ? (
                <View style={styles.vipCardMeta}>
                  <Ionicons name="location" size={14} color="#FFFFFF" />
                  <Text style={styles.vipCardLocation}>{item.location}</Text>
                </View>
              ) : null}
              {priceStr ? (
                <View style={styles.vipCardMeta}>
                  <Ionicons name="cash" size={14} color="#FFFFFF" />
                  <Text style={styles.vipCardLocation}>{priceStr}</Text>
                </View>
              ) : null}
            </View>
          </LinearGradient>
        </TouchableOpacity>
      );
    },
    [user?.id, router]
  );

  const renderListItem = useCallback(
    ({ item }: { item: any; index: number }) => {
      const itemId = item.id || item._id;
      const image =
        item.photos?.[0] ||
        item.images?.[0] ||
        item.image ||
        'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?q=80&w=600&auto=format&fit=crop';
      const priceStr = formatPartPrice(item);

      const openDetail = () => {
        if (itemId) {
          analyticsService.logSalesItemClick(
            String(itemId),
            partDisplayTitle(item),
            'part',
            'ნაწილები',
            user?.id
          );
        }
        router.push({
          pathname: '/parts-details-new',
          params: { item: JSON.stringify(convertPartToDetailItem(item)) },
        });
      };

      return (
        <TouchableOpacity style={styles.listItem} onPress={openDetail} activeOpacity={0.7}>
          <Image source={{ uri: image }} style={styles.listItemThumbnail} resizeMode="cover" />
          <View style={styles.listItemContent}>
            <Text style={styles.listItemTitle} numberOfLines={2}>
              {partDisplayTitle(item)}
            </Text>
            {item.category ? (
              <Text style={styles.listItemSubtitle} numberOfLines={1}>
                {item.category}
              </Text>
            ) : null}
            {item.brand ? (
              <Text style={styles.listItemSubtitle} numberOfLines={1}>
                {item.brand}
                {item.model ? ` ${item.model}` : ''}
              </Text>
            ) : null}
            {item.location ? (
              <View style={styles.listItemMeta}>
                <Ionicons name="location-outline" size={12} color="#6B7280" />
                <Text style={styles.listItemLocation}>{item.location}</Text>
              </View>
            ) : null}
            {priceStr ? <Text style={styles.listItemPrice}>{priceStr}</Text> : null}
          </View>
          <TouchableOpacity
            style={styles.listItemIndicator}
            onPress={(e) => {
              e.stopPropagation();
              openDetail();
            }}
          >
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </TouchableOpacity>
      );
    },
    [user?.id, router]
  );

  const handleAddItem = (type: AddModalType, _data: any) => {
    if (type === 'dismantler') {
      router.push('/parts-new' as any);
      return;
    }
    loadParts(1, false);
  };

  const renderSpecialOfferCard = ({ item: offer }: { item: any }) => {
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

  const loadMoreParts = () => {
    if (loading || isLoadingMore || !partsHasMore) return;
    loadParts(partsPage + 1, true);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent />

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
                      categoryId: params.categoryId as string,
                      name: params.categoryName as string,
                    },
                  });
                } else if (router.canGoBack()) {
                  router.back();
                } else {
                  router.push('/(tabs)/marketplace' as any);
                }
              }}
            >
              <Ionicons name="arrow-back" size={headerIconSize} color="#111827" />
            </TouchableOpacity>

            <Text style={styles.topBarTitle}>ავტონაწილები</Text>

            <View style={styles.topBarRight}>
              <TouchableOpacity
                style={styles.topBarButton}
                onPress={() => {
                  analyticsService.logButtonClick('ფილტრი', 'ნაწილები', {}, user?.id);
                  setShowFilterModal(true);
                }}
              >
                <Ionicons name="options" size={headerIconSize} color="#111827" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.topBarButton}
                onPress={() => {
                  analyticsService.logButtonClick('დამატება', 'ნაწილები', {}, user?.id);
                  setShowAddModal(true);
                }}
              >
                <Ionicons name="add" size={headerIconSize} color="#111827" />
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </View>

      <FlatList
        style={styles.content}
        data={displayedParts}
        keyExtractor={(item: any, index: number) => {
          const id = item.id || item._id;
          return id ? `part-${id}` : `part-${index}`;
        }}
        renderItem={({ item, index }) => renderListItem({ item, index })}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.verticalList}
        ListHeaderComponent={
          <>
            {loading && displayedParts.length === 0 ? (
              <View style={styles.sectionTitleSkeleton} />
            ) : (
              <View style={styles.sectionTitleContainer}>
                <Text style={styles.sectionTitle}>VIP ნაწილები</Text>
              </View>
            )}

            {loading && vipParts.length === 0 ? (
              <View style={styles.horizontalScroll}>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </View>
            ) : vipParts.length > 0 ? (
              <FlatList
                horizontal
                data={vipParts}
                renderItem={renderVIPCard}
                keyExtractor={(item, index) => item.id || item._id || `vip-p-${index}`}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalScroll}
                removeClippedSubviews={Platform.OS === 'ios'}
                initialNumToRender={2}
                maxToRenderPerBatch={2}
                windowSize={2}
                onViewableItemsChanged={onViewableVipItemsChanged}
                viewabilityConfig={vipViewabilityConfigRef.current}
                getItemLayout={(_, index) => ({
                  length: width * 0.65 + 16,
                  offset: (width * 0.65 + 16) * index,
                  index,
                })}
              />
            ) : null}


            {loading && displayedParts.length === 0 ? (
              <View style={styles.sectionTitleSkeleton} />
            ) : (
              <View style={styles.sectionTitleContainer}>
                <Text style={styles.sectionTitle}>პოპულარული ნაწილები</Text>
              </View>
            )}

            {loading && displayedParts.length === 0 ? (
              <View style={styles.verticalList}>
                <SkeletonListItem />
                <SkeletonListItem />
                <SkeletonListItem />
                <SkeletonListItem />
              </View>
            ) : null}
          </>
        }
        ListEmptyComponent={
          !loading && displayedParts.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>ნაწილები არ მოიძებნა</Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          <>
            {isLoadingMore ? (
              <View style={styles.loadingMoreContainer}>
                <ActivityIndicator size="small" color="#111827" />
                <Text style={styles.loadingMoreText}>იტვირთება...</Text>
              </View>
            ) : null}
            <View style={{ height: 100 }} />
          </>
        }
        onEndReached={loadMoreParts}
        onEndReachedThreshold={0.5}
        removeClippedSubviews
        initialNumToRender={5}
        maxToRenderPerBatch={3}
        windowSize={5}
        updateCellsBatchingPeriod={100}
        getItemLayout={(_, index) => ({
          length: 120,
          offset: 120 * index,
          index,
        })}
      />

      <FilterModal
        visible={showFilterModal}
        activeTab="ნაწილები"
        dismantlerFilters={EMPTY_DISMANTLER_FILTERS}
        partsFilters={partsFilters}
        onClose={() => setShowFilterModal(false)}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
      />

      <AddModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleAddItem}
        defaultType="part"
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

/** იგივე სტილები რაც app/parts-new.tsx */
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
    paddingHorizontal: Platform.select({ android: 16, default: 20 }),
    paddingTop: 8,
  },
  topBarTitle: {
    fontSize: Platform.select({ android: 15, default: 18 }),
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    textAlign: 'center',
  },
  topBarButton: {
    width: Platform.select({ android: 36, default: 40 }),
    height: Platform.select({ android: 36, default: 40 }),
    borderRadius: Platform.select({ android: 18, default: 20 }),
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarRight: {
    flexDirection: 'row',
    gap: Platform.select({ android: 8, default: 12 }),
  },
  content: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  sectionTitleContainer: {
    paddingTop: Platform.select({ android: 18, default: 24 }),
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: Platform.select({ android: 15, default: 18 }),
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#111827',
  },
  sectionTitleSkeleton: {
    height: Platform.select({ android: 15, default: 18 }),
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
    fontSize: Platform.select({ android: 15, default: 18 }),
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
    fontSize: Platform.select({ android: 12, default: 13 }),
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: '#FFFFFF',
    fontWeight: '500',
  },
  verticalList: {
    paddingHorizontal: Platform.select({ android: 16, default: 20 }),
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
    fontSize: Platform.select({ android: 13, default: 15 }),
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  listItemSubtitle: {
    fontSize: Platform.select({ android: 12, default: 13 }),
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
    fontSize: Platform.select({ android: 11, default: 12 }),
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: '#6B7280',
    fontWeight: '500',
  },
  listItemPrice: {
    fontSize: Platform.select({ android: 14, default: 16 }),
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#111827',
    marginTop: 4,
  },
  listItemIndicator: {
    width: Platform.select({ android: 28, default: 32 }),
    height: Platform.select({ android: 28, default: 32 }),
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
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
