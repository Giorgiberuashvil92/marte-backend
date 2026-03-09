import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  StatusBar,
  Dimensions,
  Animated,
  Alert,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import { useUser } from '../../contexts/UserContext';
import { engagementApi } from '../../services/engagementApi';
import { analyticsService } from '../../services/analytics';
import API_BASE_URL from '@/config/api';

const { width } = Dimensions.get('window');

const MAIN_CATEGORIES = [
  {
    id: 'parts',
    title: 'ნაწილები',
    subtitle: 'ავტონაწილების მოძიება და შეძენა',
    icon: 'construct-outline',
    color: '#3B82F6',
    route: '/parts-new',
  },
  {
    id: 'stores',
    title: 'ავტომაღაზიები',
    subtitle: 'მაღაზიები და სერვისები',
    icon: 'storefront-outline',
    color: '#EC4899',
    route: '/stores-new',
  },
  {
    id: 'oils',
    title: 'ზეთები',
    subtitle: 'ძრავის ზეთები და საპოხი მასალები',
    icon: 'water-outline',
    color: '#0EA5E9',
    route: '/oils-new',
  },
  {
    id: 'services',
    title: 'ავტოსერვისები',
    subtitle: 'სერვისები და მოვლა',
    icon: 'settings-outline',
    color: '#F59E0B',
    route: '/services-new',
  },
  {
    id: 'mechanics',
    title: 'ხელოსნები',
    subtitle: 'მექანიკოსები და სპეციალისტები',
    icon: 'build-outline',
    color: '#10B981',
    route: '/mechanics-new',
  },
  // {
  //   id: 'accessories',
  //   title: 'აქსესუარები',
  //   subtitle: 'ავტომობილის აქსესუარები და დამატებები',
  //   icon: 'grid-outline',
  //   color: '#F97316',
  //   route: '/accessories',
  // },
  
  {
    id: 'interior',
    title: 'ავტომობილის ინტერიერი',
    subtitle: 'სალონის აქსესუარები და დეკორაცია',
    icon: 'car-sport-outline',
    color: '#A855F7',
    route: '/interior',
  },
  
  {
    id: 'detailing',
    title: 'დითეილინგი',
    subtitle: 'ავტომობილის მოვლა',
    icon: 'sparkles-outline',
    color: '#8B5CF6',
    route: '/detailing',
  },
  {
    id: 'towing',
    title: 'ევაკუატორი',
    subtitle: '24/7 გადაყვანა და გადამოტანა',
    icon: 'car-sport-outline',
    color: '#EF4444',
    route: '/towing',
  },
  
];

const FeaturedSkeleton = () => {
  return (
    <View style={styles.featureCardSkeleton}>
      <View style={styles.featureImageSkeleton} />
      <View style={styles.featureContentSkeleton}>
        <View style={styles.featureLineSkeleton} />
        <View style={[styles.featureLineSkeleton, { width: '40%' }]} />
      </View>
    </View>
  );
};

export default function MarketplaceScreen() {
  const { user } = useUser();
  const router = useRouter();
  
  // State for featured services
  const [featuredServices, setFeaturedServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Animation values
  const scrollY = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  // Load special offers and discounts
  const loadSpecialOffers = async () => {
    setLoading(true);
    try {
      // Load parts, stores, and dismantlers - filter for items with discounts/special offers
      const [partsResponse, storesResponse, dismantlersResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/parts?sort=createdAt&order=desc&limit=10`),
        fetch(`${API_BASE_URL}/stores?sort=createdAt&order=desc&limit=10`),
        fetch(`${API_BASE_URL}/dismantlers?sort=createdAt&order=desc&limit=10`)  
      ]);

      const [parts, stores, dismantlers] = await Promise.all([
        partsResponse.ok ? partsResponse.json() : [],
        storesResponse.ok ? storesResponse.json() : [],
        dismantlersResponse.ok ? dismantlersResponse.json() : []
      ]);

      // Combine all items and filter for special offers
      const allItems = [
        ...(parts.data || parts || []).map((item: any) => ({
          id: item._id || item.id,
          title: item.title || item.name,
          description: item.description || `${item.brand} ${item.model}`,
          price: item.price || undefined,
          originalPrice: item.originalPrice || item.oldPrice || undefined,
          discount: item.originalPrice && item.price 
            ? Math.round(((item.originalPrice - item.price) / item.originalPrice) * 100)
            : undefined,
          image: item.images?.[0] || 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?q=80&w=600&auto=format&fit=crop',
          rating: 4.5 + Math.random() * 0.5,
          verified: true,
          type: 'part',
          itemData: item,
          hasOffer: !!(item.originalPrice || item.discount || item.specialOffer)
        })),
        ...(stores.data || stores || []).map((item: any) => ({
          id: item._id || item.id,
          title: item.name || item.title,
          description: item.description || item.type,
          price: undefined,
          image: item.images?.[0] || 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?q=80&w=400&auto=format&fit=crop',
          rating: 4.5 + Math.random() * 0.5,
          verified: true,
          type: 'store',
          itemData: item,
          hasOffer: !!(item.specialOffer || item.promotion)
        })),
        ...(dismantlers.data || dismantlers || []).map((item: any) => ({
          id: item._id || item.id,
          title: `${item.brand} ${item.model}`,
          description: `${item.yearFrom}-${item.yearTo} წლები`,
          price: undefined,
          image: item.photos?.[0] || 'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?q=80&w=400&auto=format&fit=crop',
          rating: 4.5 + Math.random() * 0.5,
          verified: true,
          type: 'dismantler',
          itemData: item,
          hasOffer: !!(item.specialOffer || item.promotion)
        }))
      ];

      // Filter items with offers/discounts, or show top items if no discounts
      const itemsWithOffers = allItems.filter(item => item.hasOffer || item.discount);
      const finalItems = itemsWithOffers.length > 0 
        ? itemsWithOffers.sort((a, b) => (b.discount || 0) - (a.discount || 0)).slice(0, 6)
        : allItems.slice(0, 6); // Fallback to latest items if no offers

      if (finalItems.length > 0) {
        setFeaturedServices(finalItems);
      }
    } catch (error) {
      console.error('Error loading special offers:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Track screen view when focused
  useFocusEffect(
    React.useCallback(() => {
      analyticsService.logScreenViewWithBackend('გაყიდვები', 'MarketplaceScreen', user?.id);
      analyticsService.logSalesPageView('გაყიდვები', user?.id);
    }, [user?.id])
  );

  const handleCategoryPress = (category: any) => {
    // Track category click
    analyticsService.logCategoryClick(category.id, category.title, 'გაყიდვები', user?.id);
    
    if (category.route) {
      router.push(category.route as any);
    }
  };

  const renderCategoryCard = (category: any, index: number) => {
    return (
      <TouchableOpacity
        key={category.id}
        style={styles.categoryCard}
        onPress={() => handleCategoryPress(category)}
        activeOpacity={0.7}
      >
        <View style={[styles.categoryIconContainer, { backgroundColor: `${category.color}15` }]}>
          <Ionicons name={category.icon as any} size={20} color={category.color} />
        </View>
        <View style={styles.categoryContent}>
          <Text style={styles.categoryTitle}>{category.title}</Text>
          <Text style={styles.categorySubtitle}>{category.subtitle}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
      </TouchableOpacity>
    );
  };

  const renderFeaturedCard = (item: any, index: number) => {
    const hasDiscount = item.discount && item.discount > 0;
    const hasOffer = item.hasOffer || hasDiscount;
    
    const handlePress = () => {
      const itemData = item.itemData || {};
      
      // Track item click
      analyticsService.logSalesItemClick(item.id, item.title, item.type, 'გაყიდვები', user?.id);
      
      if (item.type === 'part') {
        router.push({
          pathname: '/details',
          params: {
            id: item.id,
            type: 'part',
            title: item.title,
            description: item.description,
            price: item.price || '',
            image: item.image,
            rating: item.rating?.toFixed(1) || '4.5',
            // Pass additional part data
            brand: itemData.brand || '',
            model: itemData.model || '',
            category: itemData.category || '',
            condition: itemData.condition || '',
            location: itemData.location || '',
            phone: itemData.phone || '',
            seller: itemData.seller || itemData.name || '',
          }
        });
      } else if (item.type === 'store') {
        // Navigate to details page with store data
        router.push({
          pathname: '/details',
          params: {
            id: item.id,
            type: 'store',
            title: item.title,
            description: item.description,
            image: item.image,
            rating: item.rating?.toFixed(1) || '4.5',
            address: itemData.address || itemData.location || '',
            phone: itemData.phone || '',
          }
        });
      } else if (item.type === 'dismantler') {
        // Track view
        const dismantlerId = item.id;
        if (user?.id && dismantlerId) {
          console.log('👁️ [MARKETPLACE] Tracking view for dismantler:', dismantlerId, 'user:', user.id);
          engagementApi.trackDismantlerView(dismantlerId, user.id).catch((err) => {
            console.error('❌ [MARKETPLACE] Error tracking dismantler view:', err);
          });
        }
        // Navigate to details page with dismantler data
        router.push({
          pathname: '/details',
          params: {
            id: item.id,
            type: 'dismantler',
            title: item.title,
            description: item.description,
            image: item.image,
            rating: item.rating?.toFixed(1) || '4.5',
            brand: itemData.brand || '',
            model: itemData.model || '',
            yearFrom: itemData.yearFrom || '',
            yearTo: itemData.yearTo || '',
            location: itemData.location || '',
            phone: itemData.phone || '',
            name: itemData.name || '',
          }
        });
      } else {
        router.push('/details');
      }
    };

    return (
    <TouchableOpacity 
      key={item.id} 
      style={styles.featureCard} 
      activeOpacity={0.95}
        onPress={handlePress}
    >
      <Image source={{ uri: item.image }} style={styles.featureImage} />
      <LinearGradient
        colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.65)"]}
        style={styles.featureOverlay}
      />
      <View style={styles.featureBadgesRow}>
        {hasDiscount && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountBadgeText}>-{item.discount}%</Text>
          </View>
        )}
        {hasOffer && !hasDiscount && (
          <View style={styles.offerBadge}>
            <Ionicons name="pricetag" size={12} color="#FFFFFF" />
            <Text style={styles.offerBadgeText}>შეთავაზება</Text>
          </View>
        )}
        {item.verified && (
          <View style={styles.badgePillLight}><Ionicons name="checkmark-circle" size={14} color="#10B981" /><Text style={styles.badgePillLightText}>ვერიფიცირებული</Text></View>
        )}
      </View>
      <View style={styles.featureContent}>
        <Text style={styles.featureTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.featureSubtitle} numberOfLines={1}>{item.description}</Text>
        <View style={styles.featureMetaRow}>
          <View style={styles.featureRating}><Ionicons name="star" size={14} color="#F59E0B" /><Text style={styles.featureRatingText}>{item.rating?.toFixed(1)}</Text></View>
          {/* Price with discount */}
          {item.type === 'part' && item.price && (
            <View style={styles.priceContainer}>
              {item.originalPrice && item.originalPrice > item.price && (
                <Text style={styles.originalPrice}>{item.originalPrice}₾</Text>
              )}
              <Text style={styles.currentPrice}>{item.price}₾</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Compact Header */}
      <SafeAreaView edges={['top']} style={styles.compactHeader}>
       
      </SafeAreaView>

      <Animated.ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      >
        {/* Categories Section */}
        <View style={styles.categoriesSection}>
          <Text style={styles.sectionTitle}>კატეგორიები</Text>
          <View style={styles.categoriesList}>
            {MAIN_CATEGORIES.map((category, index) => renderCategoryCard(category, index))}
          </View>
        </View>

        {/* Quick Actions removed per request */}

        <View style={{ height: 100 }} />
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  // Compact Header
  compactHeader: {
    backgroundColor: 'transparent',
  },
  compactHeaderContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
  },
  compactTitle: {
    fontSize: 22,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  compactSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  compactSearchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: '#111827',
  },
  
  // Modern Header
  modernHeader: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: '#6B7280',
    marginTop: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 52,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: '#111827',
  },

  content: {
    flex: 1,
  },

  // Categories Section
  categoriesSection: {
    paddingTop: 20,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#111827',
    marginBottom: 14,
    letterSpacing: -0.5,
  },
  categoriesList: {
    gap: 10,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  categoryIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  categoryContent: {
    flex: 1,
  },
  categoryTitle: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
    letterSpacing: -0.3,
  },
  categorySubtitle: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: '#6B7280',
    lineHeight: 16,
  },

  // Featured Section
  featuredSection: {
    paddingTop: 32,
    paddingBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  seeAllText: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '600',
    color: '#3B82F6',
  },
  miniGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 12,
  },
  miniCard: {
    width: (width - 56) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    position: 'relative',
  },
  miniImage: {
    width: '100%',
    height: 80,
  },
  miniContent: {
    padding: 12,
  },
  miniTitle: {
    fontSize: 13,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '600',
    color: '#111827',
    marginBottom: 6,
  },
  miniMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  miniRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  miniRatingText: {
    fontSize: 11,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '500',
    color: '#6B7280',
  },
  miniPrice: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#111827',
  },
  miniVerified: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 8,
    padding: 3,
  },

  // Featured revamped styles
  featureCarousel: {
    paddingLeft: 20,
    paddingRight: 6,
    gap: 14,
  },
  featureCard: {
    width: Math.round(width * 0.8),
    height: 180,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#111827',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  // Hero promo banner styles
  heroPromoContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  heroPromo: {
    height: 180,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#0B0F1A',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 10,
  },
  heroPromoBackground: { width: '100%', height: '100%', position: 'absolute' },
  heroPromoOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  heroPromoTopRow: { position: 'absolute', left: 12, right: 12, top: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroPromoPillLight: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  heroPromoPillLightText: { color: '#111827', fontSize: 12, fontFamily: 'HelveticaMedium', textTransform: 'uppercase', fontWeight: '700' },
  heroPromoDiscount: { backgroundColor: '#EF4444', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  heroPromoDiscountText: { color: '#FFFFFF', fontFamily: 'HelveticaMedium', textTransform: 'uppercase', fontWeight: '800' },
  heroPromoContent: { position: 'absolute', left: 12, right: 12, bottom: 12, gap: 12 },
  heroPromoTitle: { color: '#FFFFFF', fontSize: 18, fontFamily: 'HelveticaMedium', textTransform: 'uppercase', fontWeight: '800', letterSpacing: -0.3, textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 },
  heroPromoSubtitle: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontFamily: 'HelveticaMedium', textTransform: 'uppercase' },
  heroPromoFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroPromoFeatures: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroPromoFeature: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.35)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  heroPromoFeatureText: { color: '#E5E7EB', fontFamily: 'HelveticaMedium', textTransform: 'uppercase', fontWeight: '700', fontSize: 11 },
  heroPromoButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#111827', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  heroPromoButtonText: { color: '#FFFFFF', fontFamily: 'HelveticaMedium', textTransform: 'uppercase', fontWeight: '700', fontSize: 13 },
  featureImage: { width: '100%', height: '100%' },
  featureOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '60%' },
  featureBadgesRow: { position: 'absolute', left: 12, right: 12, top: 12, flexDirection: 'row', gap: 8 },
  badgePillPrimary: { backgroundColor: 'rgba(59,130,246,0.95)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  badgePillPrimaryText: { color: '#FFFFFF', fontSize: 11, fontFamily: 'HelveticaMedium', textTransform: 'uppercase', fontWeight: '700' },
  badgePillLight: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 12 },
  badgePillLightText: { color: '#111827', fontSize: 11, fontFamily: 'HelveticaMedium', textTransform: 'uppercase', fontWeight: '700' },
  featureContent: { position: 'absolute', left: 12, right: 12, bottom: 12 },
  featureTitle: { color: '#FFFFFF', fontSize: 16, fontFamily: 'HelveticaMedium', textTransform: 'uppercase', fontWeight: '800', letterSpacing: -0.3, marginBottom: 8 },
  featureMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  featureRating: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  featureRatingText: { color: '#FDE68A', fontFamily: 'HelveticaMedium', textTransform: 'uppercase', fontWeight: '700' },
  discountBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  discountBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '800',
  },
  offerBadge: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  offerBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  originalPrice: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    textDecorationLine: 'line-through',
    fontWeight: '500',
  },
  currentPrice: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
  },

  // Skeletons
  featureCardSkeleton: {
    width: Math.round(width * 0.8),
    height: 180,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
  },
  featureImageSkeleton: { flex: 1, backgroundColor: '#E5E7EB' },
  featureContentSkeleton: { position: 'absolute', left: 12, right: 12, bottom: 12 },
  featureLineSkeleton: { height: 12, backgroundColor: '#D1D5DB', borderRadius: 6, marginBottom: 8, width: '70%' },

  // Quick Actions
  quickSection: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  quickGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  quickAction: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 6,
  },
  quickText: {
    fontSize: 11,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  featureSubtitle: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: '#9CA3AF',
    marginBottom: 8,
  },
});