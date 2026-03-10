import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ImageBackground,
  Animated,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useUser } from '../contexts/UserContext';
import { useToast } from '../contexts/ToastContext';
import AddModal, { AddModalType } from '../components/ui/AddModal';
import { DetailItem } from '../components/ui/DetailModal';
import SpecialOfferModal, { SpecialOfferModalData } from '../components/ui/SpecialOfferModal';
import SpecialOfferCard from '../components/ui/SpecialOfferCard';
import CategoryListScreen from '../components/ui/CategoryListScreen';
import { addItemApi } from '../services/addItemApi';
import { engagementApi } from '../services/engagementApi';
import { specialOffersApi, SpecialOffer } from '../services/specialOffersApi';
import { Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

export default function StoresNewScreen() {
  const router = useRouter();
  const { user } = useUser();
  const { success, error } = useToast();
  const [loading, setLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [stores, setStores] = useState<any[]>([]);
  const [vipStores, setVipStores] = useState<any[]>([]);
  const [specialOffers, setSpecialOffers] = useState<any[]>([]);
  const [userStores, setUserStores] = useState<any[]>([]);
  const [hasUserStores, setHasUserStores] = useState(false);
  const STORES_PAGE_SIZE = 20;
  const [storesPage, setStoresPage] = useState(1);
  const [storesHasMore, setStoresHasMore] = useState(true);
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSpecialOfferModal, setShowSpecialOfferModal] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<SpecialOfferModalData | null>(null);

  // Map Banner pulse animation
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.3,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  const loadStores = useCallback(async (page: number = 1, append: boolean = false) => {
    try {
      if (append) {
        setIsLoadingMore(true);
      } else {
        setLoading(true);
      }

      const filters: Record<string, string | number> = {
        page,
        limit: STORES_PAGE_SIZE,
      };
      const [storesResponse, offersResponse] = await Promise.all([
        addItemApi.getStores(filters),
        append ? Promise.resolve(null) : specialOffersApi.getSpecialOffers(true),
      ]);

      if (storesResponse?.success && storesResponse.data) {
        const pageStores = storesResponse.data;
        const vip = page === 1
          ? pageStores.filter((s: any) => s.isVip === true)
          : vipStores;
        const regular = pageStores.filter((s: any) => s.isVip !== true);

        if (append) {
          setStores((prev) => [...prev, ...regular]);
        } else {
          setVipStores(vip);
          setStores(regular);
          if (offersResponse && Array.isArray(offersResponse) && offersResponse.length > 0) {
            const allStores = pageStores;
            const offersWithStores = offersResponse.map((offer: SpecialOffer) => {
              const store = allStores.find(
                (s: any) => (s.id || s._id) === offer.storeId,
              );
              if (store) {
                return {
                  ...store,
                  ...offer,
                  image: offer.image || store.photos?.[0] || store.images?.[0],
                };
              }
              return null;
            }).filter(Boolean);
            setSpecialOffers(offersWithStores);
          } else {
            setSpecialOffers([]);
          }
        }
        setStoresHasMore(pageStores.length === STORES_PAGE_SIZE);
        setStoresPage(page);
      }
    } catch (err) {
      console.error('Error loading stores:', err);
      if (!append) setSpecialOffers([]);
    } finally {
      if (append) {
        setIsLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  const loadUserStores = useCallback(async () => {
    if (!user?.id) {
      setHasUserStores(false);
      return;
    }
    
    try {
      const response = await addItemApi.getStores({ ownerId: user.id });
      if (response.success && response.data) {
        const userStoresList = response.data || [];
        setUserStores(userStoresList);
        setHasUserStores(userStoresList.length > 0);
      } else {
        setHasUserStores(false);
      }
    } catch (error) {
      console.error('Error loading user stores:', error);
      setHasUserStores(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadStores();
    loadUserStores();
  }, [loadStores, loadUserStores]);

  const convertStoreToDetailItem = (store: any): DetailItem => {
    const mainImage = store.photos && store.photos.length > 0 
      ? store.photos[0] 
      : store.images && store.images.length > 0 
        ? store.images[0]
        : store.image || 'https://images.unsplash.com/photo-1517672651691-24622a91b550?q=80&w=800&auto=format&fit=crop';
    
    const gallery = store.photos && store.photos.length > 0 
      ? store.photos 
      : store.images && store.images.length > 0 
        ? store.images
        : [mainImage];
    
    return {
      id: store.id || store._id,
      title: store.title || store.name,
      name: store.name,
      description: store.description || `${store.name} არის საქართველოში წამყვანი ავტონაწილების მაღაზია.`,
      image: mainImage,
      type: 'store',
      location: store.location,
      phone: store.phone,
      alternativePhone: store.alternativePhone,
      email: store.email,
      website: store.website,
      workingHours: store.workingHours || '09:00 - 18:00',
      address: store.address || store.location,
      services: store.services || ['ნაწილების მიყიდვა', 'კონსულტაცია', 'მონტაჟი'],
      features: store.features || ['გამოცდილი პერსონალი', 'ხარისხიანი სერვისი'],
      specializations: store.specializations,
      gallery: gallery,
      ownerName: store.ownerName,
      managerName: store.managerName,
      facebook: store.facebook,
      instagram: store.instagram,
      youtube: store.youtube,
      yearEstablished: store.yearEstablished,
      employeeCount: store.employeeCount,
      license: store.license,
      latitude: store.latitude,
      longitude: store.longitude,
      specifications: {
        'ტიპი': store.type || 'ავტომაღაზია',
        'მდებარეობა': store.location || 'თბილისი',
        'ტელეფონი': store.phone || 'მიუთითებელი არ არის',
      }
    };
  };

  const handleStorePress = async (store: any) => {
    const storeId = store.id || store._id;
    
    if (store.discount || store.storeId) {
      setSelectedOffer(store);
      setShowSpecialOfferModal(true);
      return;
    }
    
    if (user?.id && storeId) {
      engagementApi.trackStoreView(storeId, user.id).catch((err) => {
        console.error('Error tracking store view:', err);
      });
    }
    
    const detailItem = convertStoreToDetailItem(store);
    router.push({
      pathname: '/parts-details-new',
      params: { item: JSON.stringify(detailItem) }
    });
  };

  // Render VIP Store Card
  const renderVIPStore = (item: any) => (
    <TouchableOpacity
      style={styles.vipCard}
      onPress={() => handleStorePress(item)}
      activeOpacity={0.7}
    >
      <ImageBackground
        source={{ 
          uri: item.photos?.[0] || item.images?.[0] || item.image || 'https://images.unsplash.com/photo-1517672651691-24622a91b550?q=80&w=800&auto=format&fit=crop' 
        }}
        style={styles.vipCardImage}
        imageStyle={styles.vipCardImageStyle}
      >
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.8)']}
          style={styles.vipCardGradient}
        >
          <View style={styles.vipBadge}>
            <Ionicons name="star" size={12} color="#F59E0B" />
            <Text style={styles.vipBadgeText}>VIP</Text>
          </View>
          <View style={styles.vipCardContent}>
            <Text style={styles.vipCardTitle} numberOfLines={2}>{item.name}</Text>
            <View style={styles.vipCardMeta}>
              <Ionicons name="location" size={14} color="#FFFFFF" />
              <Text style={styles.vipCardLocation}>{item.location}</Text>
            </View>
          </View>
        </LinearGradient>
      </ImageBackground>
    </TouchableOpacity>
  );

  const renderSpecialOfferCard = (offer: any, index: number) => {
    const storeId = offer.storeId || offer.id || offer._id;
    const offersCount = specialOffers.filter(
      (o: any) => (o.storeId || o.id || o._id) === storeId
    ).length;
    return (
      <SpecialOfferCard
        offer={offer}
        offersCount={offersCount}
        onPress={() => handleStorePress(offer)}
      />
    );
  };

  // Render Store List Item (Grid)
  const renderStoreItem = (store: any, index: number) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => handleStorePress(store)}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <ImageBackground
          source={{ 
            uri: store.photos?.[0] || store.images?.[0] || store.image || 'https://images.unsplash.com/photo-1517672651691-24622a91b550?q=80&w=800&auto=format&fit=crop' 
          }}
          style={styles.cardImage}
          imageStyle={styles.cardImageStyle}
        >
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.7)']}
            style={styles.cardGradient}
          >
            <View style={styles.cardBadges}>
              {store.isVip && (
                <View style={styles.vipBadgeSmall}>
                  <Ionicons name="star" size={10} color="#F59E0B" />
                  <Text style={styles.vipBadgeSmallText}>VIP</Text>
                </View>
              )}
            </View>
          </LinearGradient>
        </ImageBackground>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>{store.name}</Text>
        <View style={styles.cardMeta}>
          <Ionicons name="location-outline" size={12} color="#6B7280" />
          <Text style={styles.cardLocation} numberOfLines={1}>{store.location}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  // Map Banner Component


  // Management Button Component
  const ManagementButton = () => {
    if (!hasUserStores) return null;
    
    return (
      <View style={styles.manageSection}>
        <TouchableOpacity 
          style={styles.manageButton}
          onPress={() => router.push('/business-panel' as any)}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={['#3B82F6', '#2563EB']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.manageButtonGradient}
          >
            <View style={styles.manageButtonContent}>
              <View style={styles.manageButtonLeft}>
                <View style={styles.manageButtonIconContainer}>
                  <Ionicons name="settings" size={20} color="#FFFFFF" />
                </View>
                <View style={styles.manageButtonTextContainer}>
                  <Text style={styles.manageButtonText}>
                    განცხადებების მართვა
                  </Text>
                  <Text style={styles.manageButtonSubtext}>
                    {userStores.length} განცხადება
                  </Text>
                </View>
              </View>
              <View style={styles.manageButtonRight}>
                <View style={styles.manageButtonBadge}>
                  <Text style={styles.manageButtonBadgeText}>
                    {userStores.length}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  };

  const loadMoreStores = useCallback(() => {
    if (loading || isLoadingMore || !storesHasMore) return;
    loadStores(storesPage + 1, true);
  }, [loading, isLoadingMore, storesHasMore, storesPage, loadStores]);

  const handleAddItem = (type: AddModalType, data: any) => {
    console.log('Store successfully added:', { type, data });
    loadStores(1, false);
    loadUserStores();
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <CategoryListScreen
        title="ავტომაღაზიები"
        vipData={vipStores}
        regularData={stores}
        loading={loading}
        isLoadingMore={isLoadingMore}
        hasMore={storesHasMore}
        onLoadMore={loadMoreStores}
        renderVIPCard={renderVIPStore}
        renderListItem={renderStoreItem}
        onAddPress={() => setShowAddModal(true)}
        showFilterButton={false}
        vipSectionTitle="VIP მაღაზიები"
        regularSectionTitle="ყველა მაღაზია"
        emptyText="მაღაზიები არ მოიძებნა"
        listLayout="grid"
        numColumns={2}
        specialOffersData={specialOffers}
        renderSpecialOfferCard={renderSpecialOfferCard}
        specialOffersTitle="სპეციალური შეთავაზებები"
        customSections={[
          <ManagementButton key="management" />,
        ]}
      />


      {/* Special Offer Modal */}
      <SpecialOfferModal
        visible={showSpecialOfferModal}
        offer={selectedOffer}
        onClose={() => setShowSpecialOfferModal(false)}
      />

      {/* Add Modal */}
      <AddModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleAddItem}
        defaultType="store"
      />
    </>
  );
}

const styles = StyleSheet.create({
  // VIP Card
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
  vipCardImageStyle: {
    resizeMode: 'cover',
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
  // Offer Card
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
  offerLabelBadge: {
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
  offerLabelBadgeText: {
    fontSize: 11,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#FFFFFF',
  },
  offerCountBadge: {
    position: 'absolute',
    top: 50,
    right: 12,
    backgroundColor: '#3B82F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  offerCountBadgeText: {
    fontSize: 10,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#FFFFFF',
  },
  offerCardContent: {
    gap: 8,
  },
  offerCardTitle: {
    fontSize: 18,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#FFFFFF',
  },
  offerCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  offerCardLocation: {
    fontSize: 13,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: '#FFFFFF',
    fontWeight: '500',
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
    textTransform: 'uppercase',
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
    fontWeight: '500',
  },
  offerNewPrice: {
    fontSize: 16,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: '#10B981',
    fontWeight: '700',
  },
  // Store Card (Grid)
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    width: '100%',
    height: 120,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardImageStyle: {
    resizeMode: 'cover',
  },
  cardGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '40%',
  },
  cardBadges: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  vipBadgeSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  vipBadgeSmallText: {
    fontSize: 10,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#F59E0B',
  },
  cardBody: {
    padding: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardLocation: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: '#6B7280',
    fontWeight: '500',
    flex: 1,
  },
  // Management Button
  manageSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  manageButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  manageButtonGradient: {
    padding: 16,
  },
  manageButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  manageButtonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  manageButtonIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  manageButtonTextContainer: {
    flex: 1,
  },
  manageButtonText: {
    fontSize: 16,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  manageButtonSubtext: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  manageButtonRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  manageButtonBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  manageButtonBadgeText: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // Map Banner
  mapBannerSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  mapBannerContainer: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  mapBanner: {
    padding: 20,
    borderRadius: 16,
    position: 'relative',
  },
  mapBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  mapBannerIconWrapper: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  mapBannerIconInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  mapBannerPulse: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
  },
  mapBannerTextContainer: {
    flex: 1,
  },
  mapBannerTitle: {
    fontSize: 18,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  mapBannerSubtitle: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  mapBannerArrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
