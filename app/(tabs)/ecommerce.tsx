import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  TextInput,
  FlatList,
  RefreshControl,
  Modal,
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

const ECOMMERCE_CATEGORIES = [
  {
    id: 'parts',
    title: 'ნაწილები',
    subtitle: 'ავტონაწილები',
    icon: 'construct-outline',
    color: '#3B82F6',
    route: '/parts',
  },
  {
    id: 'oils',
    title: 'ზეთები',
    subtitle: 'ძრავის ზეთები',
    icon: 'water-outline',
    color: '#0EA5E9',
    route: '/oils',
  },
  {
    id: 'accessories',
    title: 'აქსესუარები',
    subtitle: 'ავტო აქსესუარები',
    icon: 'grid-outline',
    color: '#F97316',
    route: '/accessories',
  },
  {
    id: 'interior',
    title: 'ინტერიერი',
    subtitle: 'სალონის აქსესუარები',
    icon: 'car-sport-outline',
    color: '#A855F7',
    route: '/interior',
  },
  {
    id: 'tools',
    title: 'ხელსაწყოები',
    subtitle: 'ავტო ხელსაწყოები',
    icon: 'hammer-outline',
    color: '#10B981',
    route: '/tools',
  },
  {
    id: 'electronics',
    title: 'ელექტრონიკა',
    subtitle: 'ავტო ელექტრონიკა',
    icon: 'phone-portrait-outline',
    color: '#EC4899',
    route: '/electronics',
  },
];

export default function EcommerceScreen() {
  const { user } = useUser();
  const router = useRouter();
  
  // State for products
  const [products, setProducts] = useState<any[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [availableBrands, setAvailableBrands] = useState<string[]>([]);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Animation values
  const scrollY = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  // Load products
  const loadProducts = React.useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      // Load ecommerce products (admin-created products)
      let ecommerceProducts: any[] = [];
      
      try {
        const apiUrl = `${API_BASE_URL}/ecommerce-products?isActive=true&limit=50`;
        console.log('🛒 Loading ecommerce products from:', apiUrl);
        
        const productsResponse = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        console.log('📦 Response status:', productsResponse.status);
        
        if (productsResponse.ok) {
          const productsData = await productsResponse.json();
          console.log('✅ Products data received:', productsData);
          ecommerceProducts = productsData.data || productsData || [];
          console.log('📊 Formatted products count:', ecommerceProducts.length);
        } else {
          const errorText = await productsResponse.text();
          console.error('❌ API Error:', productsResponse.status, errorText);
        }
      } catch (error) {
        console.error('❌ Error loading ecommerce products:', error);
      }

      // Format ecommerce products
      const formattedProducts = (ecommerceProducts || []).map((item: any) => ({
        id: item._id || item.id,
        title: item.title,
        description: item.description,
        price: item.price || 0,
        originalPrice: item.originalPrice,
        discount: item.originalPrice && item.price 
          ? Math.round(((item.originalPrice - item.price) / item.originalPrice) * 100)
          : undefined,
        image: item.images?.[0] || 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?q=80&w=600&auto=format&fit=crop',
        rating: 4.5 + Math.random() * 0.5,
        reviews: Math.floor(Math.random() * 100) + 10,
        verified: true,
        type: 'ecommerce-product',
        category: item.category || 'parts',
        brand: item.brand || '',
        itemData: item,
        inStock: item.inStock !== false,
      }));

      // Extract unique brands
      const brands = Array.from(new Set(
        formattedProducts
          .map(p => p.brand)
          .filter(b => b && b.trim() !== '')
      )).sort();
      setAvailableBrands(brands);
      setAllProducts(formattedProducts);

      // Filter by category if selected
      let filteredProducts = selectedCategory 
        ? formattedProducts.filter(p => p.category === selectedCategory)
        : formattedProducts;

      // Filter by brands if selected
      if (selectedBrands.length > 0) {
        filteredProducts = filteredProducts.filter(p => 
          p.brand && selectedBrands.includes(p.brand)
        );
      }

      // Filter by search query
      const searchFiltered = searchQuery.trim()
        ? filteredProducts.filter(p => 
            p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (p.brand && p.brand.toLowerCase().includes(searchQuery.toLowerCase()))
          )
        : filteredProducts;

      setProducts(searchFiltered);
    } catch (error) {
      console.error('Error loading products:', error);
      setProducts([]);
    } finally {
      setLoading(false);
      if (isRefresh) setRefreshing(false);
    }
  }, [selectedCategory, searchQuery, selectedBrands]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

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

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Track screen view when focused
  useFocusEffect(
    React.useCallback(() => {
      analyticsService.logScreenViewWithBackend('Shop', 'ShopScreen', user?.id);
    }, [user?.id])
  );

  const handleCategoryPress = (category: any) => {
    analyticsService.logCategoryClick(category.id, category.title, 'Shop', user?.id);
    
    if (selectedCategory === category.id) {
      setSelectedCategory(null);
    } else {
      setSelectedCategory(category.id);
    }
  };

  const handleProductPress = (product: any) => {
    analyticsService.logSalesItemClick(product.id, product.title, product.type, 'Shop', user?.id);
    
    const itemData = product.itemData || {};
    
    if (product.type === 'ecommerce-product') {
      router.push({
        pathname: '/details',
        params: {
          id: product.id,
          type: 'ecommerce-product',
          title: product.title,
          description: product.description,
          price: product.price || '',
          originalPrice: product.originalPrice || '',
          image: product.image,
          rating: product.rating?.toFixed(1) || '4.5',
          category: itemData.category || '',
          brand: itemData.brand || '',
          inStock: itemData.inStock ? 'true' : 'false',
          stock: itemData.stock?.toString() || '0',
        }
      });
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadProducts(true);
  }, [loadProducts]);

  const renderCategoryCard = (category: any) => {
    const isSelected = selectedCategory === category.id;
    return (
      <TouchableOpacity
        key={category.id}
        style={[
          styles.categoryCard,
          isSelected && styles.categoryCardSelected
        ]}
        onPress={() => handleCategoryPress(category)}
        activeOpacity={0.7}
      >
        <Text style={[
          styles.categoryTitle,
          isSelected && styles.categoryTitleSelected
        ]}>
          {category.title}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderProductCard = ({ item }: { item: any }) => {
    const hasDiscount = item.originalPrice && item.originalPrice > item.price;
    const discountPercent = hasDiscount 
      ? Math.round(((item.originalPrice - item.price) / item.originalPrice) * 100)
      : 0;
    const isFeatured = item.itemData?.isFeatured || false;
    
    return (
      <TouchableOpacity 
        style={[
          styles.productCard,
          isFeatured && styles.productCardFeatured
        ]} 
        activeOpacity={0.85}
        onPress={() => handleProductPress(item)}
      >
        <View style={styles.productImageContainer}>
          <Image source={{ uri: item.image }} style={styles.productImage} />
          
          {/* Gradient Overlay */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.05)']}
            style={styles.imageGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
          />
          
          {/* Top Badges */}
          <View style={styles.topBadgesContainer}>
            {isFeatured && (
              <View style={styles.featuredBadge}>
                <Ionicons name="star" size={10} color="#FFFFFF" />
                <Text style={styles.featuredBadgeText}>გამორჩეული</Text>
              </View>
            )}
            {hasDiscount && (
              <View style={styles.discountBadge}>
                <Text style={styles.discountBadgeText}>
                  -{discountPercent}%
                </Text>
              </View>
            )}
          </View>
          
          {/* Wishlist Button */}
          <TouchableOpacity 
            style={styles.wishlistButton}
            onPress={(e) => {
              e.stopPropagation();
              // TODO: Add to wishlist
            }}
          >
            <Ionicons name="heart-outline" size={18} color="#666666" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.productContent}>
          {/* Category/Brand Badge */}
          <View style={styles.badgeContainer}>
            {(item.brand || item.category) && (
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryBadgeText}>
                  {item.brand || item.category || 'ნაწილები'}
                </Text>
              </View>
            )}
          </View>
          
          {/* Title */}
          <Text style={styles.productTitle} numberOfLines={2}>
            {item.title}
          </Text>
          
          {/* Rating */}
          <View style={styles.productRatingRow}>
            <Ionicons name="star" size={12} color="#F59E0B" />
            <Text style={styles.productRatingText}>
              {item.rating?.toFixed(1) || '4.5'}
            </Text>
            {item.reviews && (
              <Text style={styles.reviewsText}>({item.reviews})</Text>
            )}
          </View>
          
          {/* Price */}
          {item.price && (
            <View style={styles.priceContainer}>
              <Text style={styles.currentPrice}>{item.price}₾</Text>
              {hasDiscount && (
                <Text style={styles.originalPrice}>{item.originalPrice}₾</Text>
              )}
            </View>
          )}
          
          {/* Stock Indicator */}
          {item.inStock !== false && (
            <View style={styles.stockContainer}>
              <View style={styles.stockDot} />
              <Text style={styles.stockText}>საწყობშია</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const userName = user?.name || 'მომხმარებელი';
  const firstName = userName.split(' ')[0] || userName;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        {/* Sticky Header */}
        <View style={styles.stickyHeader}>
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <View style={styles.headerLeft}>
              
              
              </View>
              <View style={styles.headerIcons}>
                
                <TouchableOpacity style={styles.iconButton}>
                  <Ionicons name="bag-outline" size={22} color="#000000" />
                </TouchableOpacity>
                
              </View>
            </View>
            
            {/* Search */}
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={18} color="#999999" />
              <TextInput
                style={styles.searchInput}
                placeholder="ძებნა"
                placeholderTextColor="#999999"
                value={searchQuery}
                onChangeText={(text) => {
                  setSearchQuery(text);
                  if (searchTimeoutRef.current) {
                    clearTimeout(searchTimeoutRef.current);
                  }
                  searchTimeoutRef.current = setTimeout(() => {
                    loadProducts();
                  }, 500);
                }}
              />
              <TouchableOpacity onPress={() => setShowFilterModal(true)}>
                <Ionicons name="options-outline" size={18} color="#999999" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Sticky Categories */}
          <View style={styles.categoriesContainer}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoriesScroll}
            >
              <TouchableOpacity
                style={[
                  styles.categoryCard,
                  !selectedCategory && styles.categoryCardSelected
                ]}
                onPress={() => setSelectedCategory(null)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.categoryTitle,
                  !selectedCategory && styles.categoryTitleSelected
                ]}>
                  ყველა
                </Text>
              </TouchableOpacity>
              {ECOMMERCE_CATEGORIES.map(renderCategoryCard)}
            </ScrollView>
          </View>
        </View>

        {/* Scrollable Content with Products */}
        {loading && products.length === 0 ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>იტვირთება...</Text>
          </View>
        ) : products.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>პროდუქტები არ მოიძებნა</Text>
          </View>
        ) : (
          <Animated.View 
            style={{
              flex: 1,
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            }}
          >
            <FlatList
              data={products}
              renderItem={renderProductCard}
              keyExtractor={(item) => item.id}
              numColumns={2}
              columnWrapperStyle={styles.productRow}
              contentContainerStyle={styles.productList}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl 
                  refreshing={refreshing} 
                  onRefresh={onRefresh}
                  colors={['#8B5CF6', '#7C3AED']}
                  tintColor="#8B5CF6"
                  progressBackgroundColor="#FFFFFF"
                />
              }
              ListHeaderComponent={
                <>
                  {/* Promotional Banner */}
                  <View style={styles.bannerContainer}>
                    <LinearGradient
                      colors={['#9333EA', '#EC4899']}
                      style={styles.banner}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      <View style={styles.bannerContent}>
                        <View style={styles.bannerTextContainer}>
                          <Text style={styles.bannerSmallText}>ექსკლუზიური ფასდაკლება</Text>
                          <Text style={styles.bannerTitle}>სუპერ ფასდაკლება 50%-მდე</Text>
                          <TouchableOpacity style={styles.bannerButton}>
                            <Text style={styles.bannerButtonText}>შეძენა</Text>
                          </TouchableOpacity>
                        </View>
                        <View style={styles.bannerImageContainer}>
                          <Ionicons name="car-sport" size={100} color="rgba(255,255,255,0.2)" />
                        </View>
                      </View>
                    </LinearGradient>
                  </View>

                  {/* Recent Viewed Section */}
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>ბოლოს ნანახი</Text>
                    <TouchableOpacity>
                      <Text style={styles.seeAllText}>ყველას ნახვა</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Recent Products Horizontal Scroll */}
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.recentProductsScroll}
                  >
                    {products.slice(0, 5).map((item) => (
                      <TouchableOpacity
                        key={item.id}
                        style={styles.recentProductCard}
                        onPress={() => handleProductPress(item)}
                        activeOpacity={0.8}
                      >
                        <View style={styles.recentProductImageContainer}>
                          <Image source={{ uri: item.image }} style={styles.recentProductImage} />
                          <TouchableOpacity 
                            style={styles.recentWishlistButton}
                            onPress={(e) => {
                              e.stopPropagation();
                            }}
                          >
                            <Ionicons name="heart-outline" size={18} color="#666666" />
                          </TouchableOpacity>
                        </View>
                        <View style={styles.recentProductContent}>
                          <Text style={styles.recentProductBrand}>{item.category || 'ნაწილები'}</Text>
                          <View style={styles.recentProductRating}>
                            <Ionicons name="star" size={12} color="#F59E0B" />
                            <Text style={styles.recentProductRatingText}>3.5</Text>
                          </View>
                          <View style={styles.recentProductPrice}>
                            <Text style={styles.recentProductCurrentPrice}>{item.price}₾</Text>
                            {item.originalPrice && item.originalPrice > item.price && (
                              <Text style={styles.recentProductOriginalPrice}>{item.originalPrice}₾</Text>
                            )}
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  {/* Special For You Section */}
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>განსაკუთრებული თქვენთვის</Text>
                    <TouchableOpacity>
                      <Text style={styles.seeAllText}>ყველას ნახვა</Text>
                    </TouchableOpacity>
                  </View>
                </>
              }
            />
          </Animated.View>
        )}

        {/* Filter Modal */}
        <Modal
          visible={showFilterModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowFilterModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>ფილტრაცია</Text>
                <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                  <Ionicons name="close" size={24} color="#000000" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                {/* Brand Filter */}
                <View style={styles.filterSection}>
                  <Text style={styles.filterSectionTitle}>ბრენდი</Text>
                  <View style={styles.brandContainer}>
                    {availableBrands.map((brand) => {
                      const isSelected = selectedBrands.includes(brand);
                      return (
                        <TouchableOpacity
                          key={brand}
                          style={[
                            styles.brandChip,
                            isSelected && styles.brandChipSelected
                          ]}
                          onPress={() => {
                            if (isSelected) {
                              setSelectedBrands(selectedBrands.filter(b => b !== brand));
                            } else {
                              setSelectedBrands([...selectedBrands, brand]);
                            }
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={[
                            styles.brandChipText,
                            isSelected && styles.brandChipTextSelected
                          ]}>
                            {brand}
                          </Text>
                          {isSelected && (
                            <Ionicons name="checkmark" size={14} color="#FFFFFF" style={{ marginLeft: 4 }} />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.resetButton}
                  onPress={() => {
                    setSelectedBrands([]);
                  }}
                >
                  <Text style={styles.resetButtonText}>გასუფთავება</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.applyButton}
                  onPress={() => {
                    setShowFilterModal(false);
                    loadProducts();
                  }}
                >
                  <Text style={styles.applyButtonText}>გამოყენება</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  safeArea: {
    backgroundColor: '#FFFFFF',
    flex: 1,
  },
  stickyHeader: {
    backgroundColor: '#FFFFFF',
    zIndex: 100,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileImageContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  greetingContainer: {
    gap: 2,
  },
  greeting: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  welcomeText: {
    fontSize: 11,
    color: '#999999',
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 42,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#000000',
  },
  bannerContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  banner: {
    borderRadius: 14,
    overflow: 'hidden',
    height: 140,
  },
  bannerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    height: '100%',
  },
  bannerTextContainer: {
    flex: 1,
  },
  bannerSmallText: {
    fontSize: 11,
    color: '#FFFFFF',
    opacity: 0.9,
    marginBottom: 4,
  },
  bannerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  bannerButton: {
    backgroundColor: '#6B21A8',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  bannerButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  bannerImageContainer: {
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoriesContainer: {
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  categoriesScroll: {
    paddingHorizontal: 20,
    gap: 10,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: '#F5F5F5',
    gap: 5,
  },
  categoryCardSelected: {
    backgroundColor: '#000000',
  },
  categoryTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666666',
  },
  categoryTitleSelected: {
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  modalScroll: {
    maxHeight: 400,
  },
  filterSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  filterSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  brandContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  brandChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  brandChipSelected: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  brandChipText: {
    fontSize: 12,
    color: '#666666',
    fontWeight: '500',
  },
  brandChipTextSelected: {
    color: '#FFFFFF',
  },
  modalFooter: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  resetButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
  },
  resetButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
  },
  applyButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#000000',
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
  },
  seeAllText: {
    fontSize: 12,
    color: '#666666',
    fontWeight: '500',
  },
  recentProductsScroll: {
    paddingHorizontal: 20,
    gap: 16,
    paddingBottom: 8,
  },
  recentProductCard: {
    width: 150,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  recentProductImageContainer: {
    width: '100%',
    height: 180,
    position: 'relative',
    backgroundColor: '#F5F5F5',
  },
  recentProductImage: {
    width: '100%',
    height: '100%',
  },
  recentWishlistButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recentProductContent: {
    padding: 12,
  },
  recentProductBrand: {
    fontSize: 11,
    color: '#666666',
    marginBottom: 5,
    fontWeight: '500',
  },
  recentProductRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 6,
  },
  recentProductRatingText: {
    fontSize: 11,
    color: '#000000',
    fontWeight: '500',
  },
  recentProductPrice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recentProductCurrentPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
  },
  recentProductOriginalPrice: {
    fontSize: 11,
    color: '#999999',
    textDecorationLine: 'line-through',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  loadingText: {
    fontSize: 14,
    color: '#999999',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 14,
    color: '#999999',
  },
  productList: {
    padding: 12,
    paddingBottom: 100,
  },
  productRow: {
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  productCard: {
    width: (width - 36) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  productCardFeatured: {
    borderWidth: 2,
    borderColor: '#FCD34D',
    shadowColor: '#FCD34D',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  productImageContainer: {
    width: '100%',
    height: 200,
    position: 'relative',
    backgroundColor: '#F8F9FA',
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imageGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
  },
  topBadgesContainer: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    gap: 6,
    zIndex: 10,
  },
  featuredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FCD34D',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  featuredBadgeText: {
    color: '#000000',
    fontSize: 9,
    fontWeight: '700',
  },
  discountBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  discountBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  wishlistButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.98)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 10,
  },
  productContent: {
    padding: 14,
    paddingTop: 12,
  },
  badgeContainer: {
    marginBottom: 8,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F0F4FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  categoryBadgeText: {
    fontSize: 9,
    color: '#3B82F6',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  productBrand: {
    fontSize: 10,
    color: '#999999',
    marginBottom: 4,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  productTitle: {
    fontSize: 14,
    color: '#1F2937',
    marginBottom: 8,
    fontWeight: '600',
    minHeight: 40,
    lineHeight: 20,
  },
  productRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 10,
  },
  productRatingText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '600',
    marginLeft: 2,
  },
  reviewsText: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '400',
    marginLeft: 4,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 6,
  },
  currentPrice: {
    color: '#000000',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  originalPrice: {
    color: '#9CA3AF',
    fontSize: 12,
    textDecorationLine: 'line-through',
    fontWeight: '500',
  },
  stockContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  stockDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  stockText: {
    fontSize: 10,
    color: '#10B981',
    fontWeight: '500',
  },
});
