import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ImageBackground,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { DetailItem } from '../components/ui/DetailModal';
import SpecialOfferModal, { SpecialOfferModalData } from '../components/ui/SpecialOfferModal';
import SpecialOfferCard from '../components/ui/SpecialOfferCard';
import CategoryListScreen from '../components/ui/CategoryListScreen';
import { addItemApi } from '../services/addItemApi';
import { specialOffersApi, SpecialOffer } from '../services/specialOffersApi';
import { Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

export default function OilsNewScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [stores, setStores] = useState<any[]>([]);
  const [vipStores, setVipStores] = useState<any[]>([]);
  const [specialOffers, setSpecialOffers] = useState<any[]>([]);
  
  // Modals
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

  const loadStores = useCallback(async () => {
    try {
      setLoading(true);
      
      const [storesResponse, offersResponse] = await Promise.all([
        addItemApi.getStores({ type: 'ზეთები' }),
        specialOffersApi.getSpecialOffers(true),
      ]);
      
      if (storesResponse.success && storesResponse.data) {
        const oilStores = storesResponse.data.filter((store: any) => 
          store.type === 'ზეთები'
        );
        
        const vip = oilStores.filter((s: any) => s.isVip === true);
        const regular = oilStores.filter((s: any) => s.isVip !== true);
        
        setVipStores(vip);
        setStores(regular);
        
        if (offersResponse && offersResponse.length > 0) {
          const offersWithStores = offersResponse
            .map((offer: SpecialOffer) => {
              const store = oilStores.find(
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
            })
            .filter(Boolean);
          
          setSpecialOffers(offersWithStores);
        } else {
          setSpecialOffers([]);
        }
      }
    } catch (err) {
      console.error('Error loading oils:', err);
      setSpecialOffers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStores();
  }, [loadStores]);

  const convertStoreToDetailItem = (store: any): DetailItem => {
    const mainImage = store.images?.[0] || store.image || 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?q=80&w=800&auto=format&fit=crop';
    const gallery = store.images || [mainImage];
    
    return {
      id: store.id || store._id,
      title: store.name,
      name: store.name,
      description: store.description || `${store.name} - ხარისხიანი ზეთები და საპოხი მასალები`,
      image: mainImage,
      type: 'store',
      location: store.location,
      phone: store.phone,
      address: store.address,
      workingHours: store.workingHours,
      services: store.services,
      gallery: gallery,
      latitude: store.latitude,
      longitude: store.longitude,
    };
  };

  const handleStorePress = (store: any) => {
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
      const detailItem = convertStoreToDetailItem(store);
      router.push({
        pathname: '/parts-details-new',
        params: { item: JSON.stringify(detailItem) }
      });
    }
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
          uri: item.images?.[0] || item.image || 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?q=80&w=800&auto=format&fit=crop' 
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
            uri: store.images?.[0] || store.image || 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?q=80&w=800&auto=format&fit=crop' 
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
  const MapBanner = () => (
    <View style={styles.mapBannerSection}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => router.push('/map?type=ზეთები')}
        style={styles.mapBannerContainer}
      >
        <LinearGradient
          colors={['#0EA5E9', '#0284C7']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.mapBanner}
        >
          <View style={styles.mapBannerContent}>
            <View style={styles.mapBannerIconWrapper}>
              <View style={styles.mapBannerIconInner}>
                <Ionicons name="map" size={22} color="#0EA5E9" />
              </View>
              <Animated.View
                style={[
                  styles.mapBannerPulse,
                  {
                    transform: [{ scale: pulseAnim }],
                    opacity: pulseAnim.interpolate({
                      inputRange: [1, 1.3],
                      outputRange: [0.2, 0],
                    }),
                  },
                ]}
              />
            </View>
            <View style={styles.mapBannerTextContainer}>
              <Text style={styles.mapBannerTitle}>რუკაზე მონახე</Text>
              <Text style={styles.mapBannerSubtitle}>
                დააჭირე და იპოვე შენთან ახლოს მყოფი მაღაზიები
              </Text>
            </View>
            <View style={styles.mapBannerArrow}>
              <Ionicons name="arrow-forward" size={18} color="#0EA5E9" />
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <CategoryListScreen
        title="ზეთები"
        vipData={vipStores}
        regularData={stores}
        loading={loading}
        renderVIPCard={renderVIPStore}
        renderListItem={renderStoreItem}
        onAddPress={loadStores}
        showAddButton={true}
        addModalDefaultType="store"
        addModalDefaultFormData={{ type: 'ზეთები' }}
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
          <MapBanner key="map-banner" />,
        ]}
      />


      {/* Special Offer Modal */}
      <SpecialOfferModal
        visible={showSpecialOfferModal}
        offer={selectedOffer}
        onClose={() => setShowSpecialOfferModal(false)}
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
  offerCardPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  offerCardOldPrice: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
    fontWeight: '500',
  },
  offerCardNewPrice: {
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
