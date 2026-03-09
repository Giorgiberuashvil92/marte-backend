  import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Image, 
  StatusBar, 
  Animated,
  Modal,
  TextInput,
  ImageBackground,
  Linking,
  FlatList,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
  import { SafeAreaView } from 'react-native-safe-area-context';
  import { Ionicons } from '@expo/vector-icons';
  import { LinearGradient } from 'expo-linear-gradient';
  import { useRouter, useLocalSearchParams } from 'expo-router';
  import { carBrandsApi } from '../services/carBrandsApi';
  import DetailModal, { DetailItem } from '../components/ui/DetailModal';
  import AddModal, { AddModalType } from '../components/ui/AddModal';
  import { addItemApi } from '../services/addItemApi';
  import { categoriesApi, Category } from '../services/categoriesApi';
  import { useUser } from '../contexts/UserContext';
  import { engagementApi } from '../services/engagementApi';
  import { analyticsService } from '../services/analytics';
  import { useFocusEffect } from 'expo-router';






  export default function PartsHomeScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { user } = useUser();
    const [activeTab, setActiveTab] = useState<'დაშლილები' | 'ნაწილები'>('დაშლილები');
    const [showFilterModal, setShowFilterModal] = useState(false);
    
    // Filter states for different tabs
    const [dismantlerFilters, setDismantlerFilters] = useState({
      brand: '',
      model: '',
      yearFrom: '',
      yearTo: '',
      condition: '',
      location: '',
    });

    const [partsFilters, setPartsFilters] = useState({
      brand: '',
      model: '',
      category: '',
      condition: '',
      priceMin: '',
      priceMax: '',
      location: '',
    });


    // Dropdown states
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);
    const [showLocationDropdown, setShowLocationDropdown] = useState(false);
    
    // Detail Modal states
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedDetailItem, setSelectedDetailItem] = useState<DetailItem | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);

    // Real data states
    const [dismantlers, setDismantlers] = useState<any[]>([]);
    const [parts, setParts] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [locations, setLocations] = useState<string[]>([]);
    
    // Pagination states
    const [dismantlersPage, setDismantlersPage] = useState(1);
    const [partsPage, setPartsPage] = useState(1);
    const [hasMoreDismantlers, setHasMoreDismantlers] = useState(true);
    const [hasMoreParts, setHasMoreParts] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const ITEMS_PER_PAGE = 3; // 3-4 ელემენტი ცალ-ცალკე
    
    // Parts likes state
    const [partsLikes, setPartsLikes] = useState<Record<string, { likesCount: number; isLiked: boolean }>>({});
    const [loadingLikes, setLoadingLikes] = useState(false);
    
    // Dismantlers likes state
    const [dismantlersLikes, setDismantlersLikes] = useState<Record<string, { likesCount: number; isLiked: boolean }>>({});
    const [loadingDismantlersLikes, setLoadingDismantlersLikes] = useState(false);
    
    // VIP states
    const [vipDismantlers, setVipDismantlers] = useState<any[]>([]);
    const [vipParts, setVipParts] = useState<any[]>([]);
    
    // User's dismantlers state
    const [userDismantlers, setUserDismantlers] = useState<any[]>([]);
    const [hasUserDismantlers, setHasUserDismantlers] = useState(false);

    // Car data states - Load from API
    const [carMakes, setCarMakes] = useState<string[]>([]);
    const [carModels, setCarModels] = useState<string[]>([]);
    const [carModelsMap, setCarModelsMap] = useState<{ [key: string]: string[] }>({});
    const [carBrandsData, setCarBrandsData] = useState<{ [key: string]: { name: string; country?: string; logo?: string; models: string[] } }>({});
    const [searchQuery, setSearchQuery] = useState('');
    const [brandSearchQuery, setBrandSearchQuery] = useState('');
    
    // Categories from API
    const [partsCategories, setPartsCategories] = useState<string[]>([]);
    const [loadingCategories, setLoadingCategories] = useState(false);

    // Track screen view when focused
    useFocusEffect(
      React.useCallback(() => {
        const pageName = activeTab === 'ნაწილები' ? 'ნაწილები' : 'დაშლილები';
        analyticsService.logScreenViewWithBackend(pageName, 'PartsScreen', user?.id);
        analyticsService.logSalesPageView(pageName, user?.id);
      }, [activeTab, user?.id])
    );

    // Load real data functions
    const loadDismantlers = async (page: number = 1, append: boolean = false) => {
      try {
        if (!append) {
          setLoading(true);
          setDismantlersPage(1);
        } else {
          setLoadingMore(true);
        }
        setError(null);
        
        const filters = {
          ...dismantlerFilters,
          page,
          limit: ITEMS_PER_PAGE,
        };
        
        const response = await addItemApi.getDismantlers(filters as any);
        
        if (response.success && response.data) {
          const allDismantlers = response.data;
          // Separate VIP dismantlers - მხოლოდ isVip === true
          const vip = allDismantlers.filter((d: any) => d.isVip === true);
          // Regular dismantlers - მხოლოდ არა-VIP (isVip !== true ან undefined/false)
          const regular = allDismantlers.filter((d: any) => d.isVip !== true);
          
          if (append) {
            setDismantlers(prev => [...prev, ...regular]);
            setVipDismantlers(prev => [...prev, ...vip]);
          } else {
            setDismantlers(regular);
            setVipDismantlers(vip);
          }
          
          // Check if there are more items
          setHasMoreDismantlers(allDismantlers.length === ITEMS_PER_PAGE);
          
          // Load likes for all dismantlers
          if (allDismantlers.length > 0 && user?.id) {
            const dismantlerIds = allDismantlers.map((d: any) => d.id || d._id).filter(Boolean);
            if (dismantlerIds.length > 0) {
              loadDismantlersLikes(dismantlerIds);
            }
          }
        } else {
          setError('დაშლილების ჩატვირთვა ვერ მოხერხდა');
          setHasMoreDismantlers(false);
        }
      } catch (error) {
        console.error('Error loading dismantlers:', error);
        setError('დაშლილების ჩატვირთვა ვერ მოხერხდა');
        setHasMoreDismantlers(false);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    };

    const loadParts = async (page: number = 1, append: boolean = false) => {
      try {
        if (!append) {
          setLoading(true);
          setPartsPage(1);
        } else {
          setLoadingMore(true);
        }
        setError(null);
        const apiFilters: any = {
          ...partsFilters,
          minPrice: partsFilters.priceMin ? Number(partsFilters.priceMin) : undefined,
          maxPrice: partsFilters.priceMax ? Number(partsFilters.priceMax) : undefined,
          page,
          limit: ITEMS_PER_PAGE,
        };
        // Remove priceMin/priceMax as they're replaced by minPrice/maxPrice
        delete apiFilters.priceMin;
        delete apiFilters.priceMax;
        // Remove empty strings
        Object.keys(apiFilters).forEach(key => {
          if (apiFilters[key] === '' || apiFilters[key] === undefined) {
            delete apiFilters[key];
          }
        });
        
        const response = await addItemApi.getParts(apiFilters);
        if (response.success && response.data) {
          const allParts = response.data;
          const vip = allParts.filter((p: any) => p.isVip === true);
          const regular = allParts.filter((p: any) => p.isVip !== true);
          
          if (append) {
            setParts(prev => [...prev, ...regular]);
            setVipParts(prev => [...prev, ...vip]);
          } else {
            setParts(regular);
            setVipParts(vip);
          }
          
          // Check if there are more items
          setHasMoreParts(allParts.length === ITEMS_PER_PAGE);
          
          if (allParts.length > 0 && user?.id) {
            const partIds = allParts.map((p: any) => p.id || p._id).filter(Boolean);
            if (partIds.length > 0) {
              loadPartsLikes(partIds);
            }
          }
        } else {
          setError('ნაწილების ჩატვირთვა ვერ მოხერხდა');
          setHasMoreParts(false);
        }
      } catch (error) {
        console.error('Error loading parts:', error);
        setError('ნაწილების ჩატვირთვა ვერ მოხერხდა');
        setHasMoreParts(false);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    };


    // Load parts likes
    const loadPartsLikes = useCallback(async (partIds: string[]) => {
      try {
        setLoadingLikes(true);
        const likes = await engagementApi.getPartsLikes(partIds, user?.id);
        setPartsLikes((prev) => ({ ...prev, ...likes }));
      } catch (error) {
        console.error('Error loading parts likes:', error);
      } finally {
        setLoadingLikes(false);
      }
    }, [user?.id]);

    // Load dismantlers likes
    const loadDismantlersLikes = useCallback(async (dismantlerIds: string[]) => {
      try {
        setLoadingDismantlersLikes(true);
        const likes = await engagementApi.getDismantlersLikes(dismantlerIds, user?.id);
        setDismantlersLikes((prev) => ({ ...prev, ...likes }));
      } catch (error) {
        console.error('Error loading dismantlers likes:', error);
      } finally {
        setLoadingDismantlersLikes(false);
      }
    }, [user?.id]);

    // Render VIP Dismantler Card
    const renderVIPDismantler = (dismantler: any) => {
      const dismantlerId = dismantler.id || dismantler._id;
      return (
        <TouchableOpacity
          style={styles.vipCard}
          onPress={() => {
            const detailItem = convertDismantlerToDetailItem(dismantler);
            setSelectedDetailItem(detailItem);
            setShowDetailModal(true);
            
            // Track view
            if (user?.id && dismantlerId) {
              engagementApi.trackDismantlerView(dismantlerId, user.id).catch((err) => {
                console.error('Error tracking dismantler view:', err);
              });
            }
          }}
          activeOpacity={0.7}
        >
          <ImageBackground
            source={{
              uri: dismantler.photos && dismantler.photos.length > 0
                ? dismantler.photos[0]
                : dismantler.images && dismantler.images.length > 0
                  ? dismantler.images[0]
                  : dismantler.image || 'https://images.unsplash.com/photo-1563298723-dcfebaa392e3?q=80&w=800&auto=format&fit=crop'
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
                <Text style={styles.vipCardTitle} numberOfLines={2}>{dismantler.name}</Text>
                <View style={styles.vipCardMeta}>
                  <Ionicons name="location" size={14} color="#FFFFFF" />
                  <Text style={styles.vipCardLocation}>{dismantler.location}</Text>
                </View>
                {dismantler.brand && dismantler.model && (
                  <View style={styles.vipCardMeta}>
                    <Ionicons name="car" size={14} color="#FFFFFF" />
                    <Text style={styles.vipCardLocation}>{dismantler.brand} {dismantler.model}</Text>
                  </View>
                )}
              </View>
            </LinearGradient>
          </ImageBackground>
        </TouchableOpacity>
      );
    };

    // Render Dismantler Card for FlatList
    const renderDismantlerCard = React.useCallback(({ item: dismantler, index }: { item: any; index: number }) => {
      const dismantlerId = dismantler.id || dismantler._id;
      return (
        <View key={dismantlerId || index} style={styles.modernDismantlerCard}>
          <ImageBackground 
            source={{
              uri: dismantler.photos && dismantler.photos.length > 0 
                ? dismantler.photos[0] 
                : dismantler.images && dismantler.images.length > 0 
                  ? dismantler.images[0]
                  : dismantler.image || 'https://images.unsplash.com/photo-1563298723-dcfebaa392e3?q=80&w=800&auto=format&fit=crop'
            }}
            style={styles.modernDismantlerBackgroundImage}
            resizeMode="cover"
          >
            <LinearGradient
              colors={['rgba(0,0,0,0.4)', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.5)']}
              style={styles.modernDismantlerGradientOverlay}
            >
              <View style={styles.modernDismantlerHeader}>
                <View style={styles.modernDismantlerProfileSection}>
                  <View style={styles.modernDismantlerAvatarPlaceholder}>
                    <Image 
                      source={{
                        uri: dismantler.photos && dismantler.photos.length > 0 
                          ? dismantler.photos[0] 
                          : dismantler.image || 'https://images.unsplash.com/photo-1563298723-dcfebaa392e3?q=80&w=800&auto=format&fit=crop'
                      }} 
                      style={styles.modernDismantlerAvatar} 
                    />
                  </View>
                  <Text style={styles.modernDismantlerUsername}>{dismantler.name}</Text>
                </View>
                <TouchableOpacity 
                  style={styles.modernDismantlerLikeButton}
                  onPress={async (e) => {
                    e.stopPropagation();
                    if (!user?.id || !dismantlerId) return;
                    try {
                      const currentLike = dismantlersLikes[dismantlerId];
                      const newLikesCount = currentLike?.isLiked 
                        ? (currentLike.likesCount - 1) 
                        : (currentLike?.likesCount || 0) + 1;
                      setDismantlersLikes((prev) => ({
                        ...prev,
                        [dismantlerId]: {
                          likesCount: newLikesCount,
                          isLiked: !currentLike?.isLiked,
                        },
                      }));
                      const result = await engagementApi.toggleDismantlerLike(dismantlerId, user.id);
                      setDismantlersLikes((prev) => ({
                        ...prev,
                        [dismantlerId]: {
                          likesCount: result.likesCount,
                          isLiked: result.isLiked,
                        },
                      }));
                    } catch (error) {
                      console.error('Error toggling dismantler like:', error);
                      const currentLike = dismantlersLikes[dismantlerId];
                      setDismantlersLikes((prev) => ({
                        ...prev,
                        [dismantlerId]: currentLike || { likesCount: 0, isLiked: false },
                      }));
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons 
                    name={dismantlersLikes[dismantlerId]?.isLiked ? "heart" : "heart-outline"} 
                    size={16} 
                    color={dismantlersLikes[dismantlerId]?.isLiked ? "#EF4444" : "#FFFFFF"} 
                  />
                  <Text style={styles.modernDismantlerActionText}>
                    {dismantlersLikes[dismantlerId]?.likesCount || 0}
                  </Text>
                </TouchableOpacity>
              </View>
              
              <TouchableOpacity 
                style={styles.modernDismantlerMainCard}
                onPress={() => {
                  if (user?.id && dismantlerId) {
                    engagementApi.trackDismantlerView(dismantlerId, user.id).catch((err) => {
                      console.error('❌ [DISMANTLERS] Error tracking dismantler view:', err);
                    });
                  }
                  const detailItem = convertDismantlerToDetailItem(dismantler);
                  setSelectedDetailItem(detailItem);
                  setShowDetailModal(true);
                }}
                activeOpacity={0.95}
              >
                <View style={styles.modernDismantlerInfoSection} />
                <View style={styles.modernDismantlerSeparator} />
                <View style={styles.modernDismantlerTypeSection}>
                  <View style={styles.modernDismantlerInfoSection}>
                    <View style={styles.modernDismantlerCarInfoButton}>
                      <Text style={styles.modernDismantlerCarInfoText}>
                        {dismantler.brand && dismantler.model ? 
                          `${dismantler.brand} ${dismantler.model}` : 
                          'დაშლილი მანქანები'
                        }
                      </Text>
                    </View>
                    {dismantler.yearFrom && dismantler.yearTo && (
                      <View style={styles.modernDismantlerYearButton}>
                        <Text style={styles.modernDismantlerYearText}>
                          {dismantler.yearFrom} - {dismantler.yearTo}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={styles.modernDismantlerActionsFooter}>
                  <View style={styles.modernDismantlerActionsLeft}>
                    <View style={styles.modernDismantlerLocationButton}>
                      <Ionicons name="location-outline" size={16} color="#FFFFFF" />
                      <Text style={styles.modernDismantlerLocationButtonText}>
                        {dismantler.location || 'მდებარეობა'}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity 
                    style={styles.modernDismantlerContactButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      const detailItem = convertDismantlerToDetailItem(dismantler);
                      setSelectedDetailItem(detailItem);
                      setShowDetailModal(true);
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="information-outline" size={14} color="#FFFFFF" />
                    <Text style={styles.modernDismantlerContactButtonText}>ინფო</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </LinearGradient>
          </ImageBackground>
        </View>
      );
    }, [dismantlersLikes, user?.id]);

    // Render Part Card for FlatList
    const renderPartCard = React.useCallback(({ item: part, index }: { item: any; index: number }) => {
      const partId = part.id || part._id;
      return (
        <View key={partId || index} style={styles.modernPartCard}>
          <ImageBackground 
            source={{
              uri: part.photos && part.photos.length > 0 
                ? part.photos[0] 
                : part.images && part.images.length > 0 
                  ? part.images[0]
                  : part.image || 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?q=80&w=800&auto=format&fit=crop'
            }}
            style={styles.modernPartBackgroundImage}
            resizeMode="cover"
          >
            <LinearGradient
              colors={['rgba(0,0,0,0.4)', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.5)']}
              style={styles.modernPartGradientOverlay}
            >
              <View style={styles.modernPartHeader}>
                <View style={styles.modernPartProfileSection}>
                  <View style={styles.modernPartAvatarPlaceholder}>
                    <Image 
                      source={{
                        uri: part.photos && part.photos.length > 0 
                          ? part.photos[0] 
                          : part.image || 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?q=80&w=800&auto=format&fit=crop'
                      }} 
                      style={styles.modernPartAvatar} 
                    />
                  </View>
                  <Text style={styles.modernPartUsername}>{part.name}</Text>
                </View>
                <TouchableOpacity 
                  style={styles.modernPartLikeButton}
                  onPress={async (e) => {
                    e.stopPropagation();
                    if (!user?.id || !partId) return;
                    try {
                      const currentLike = partsLikes[partId];
                      const newLikesCount = currentLike?.isLiked 
                        ? (currentLike.likesCount - 1) 
                        : (currentLike?.likesCount || 0) + 1;
                      setPartsLikes((prev) => ({
                        ...prev,
                        [partId]: {
                          likesCount: newLikesCount,
                          isLiked: !currentLike?.isLiked,
                        },
                      }));
                      const result = await engagementApi.togglePartLike(partId, user.id);
                      setPartsLikes((prev) => ({
                        ...prev,
                        [partId]: {
                          likesCount: result.likesCount,
                          isLiked: result.isLiked,
                        },
                      }));
                    } catch (error) {
                      console.error('Error toggling part like:', error);
                      const currentLike = partsLikes[partId];
                      setPartsLikes((prev) => ({
                        ...prev,
                        [partId]: currentLike || { likesCount: 0, isLiked: false },
                      }));
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons 
                    name={partsLikes[partId]?.isLiked ? "heart" : "heart-outline"} 
                    size={16} 
                    color={partsLikes[partId]?.isLiked ? "#EF4444" : "#FFFFFF"} 
                  />
                  <Text style={styles.modernPartActionText}>
                    {partsLikes[partId]?.likesCount || 0}
                  </Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity 
                style={styles.modernPartMainCard}
                onPress={() => {
                  const detailItem = convertPartToDetailItem(part);
                  setSelectedDetailItem(detailItem);
                  setShowDetailModal(true);
                }}
                activeOpacity={0.95}
              >
                <View style={styles.modernPartInfoSection}>
                  <Text style={styles.modernPartNameInfo}>
                    {part.title || part.name || 'ავტონაწილი'}
                  </Text>
                  {part.category && (
                    <Text style={styles.modernPartCategoryInfo}>
                      {part.category}
                    </Text>
                  )}
                </View>
                <View style={styles.modernPartSeparator} />
                <View style={styles.modernPartTypeSection}>
                  <View style={styles.modernPartTypeLeft}>
                    <Text style={styles.modernPartLocationText}>
                      {part.price ? `${part.price}` : (part.category || 'ნაწილი')}
                    </Text>
                  </View>
                </View>
                <View style={styles.modernPartActionsFooter}>
                  <View style={styles.modernPartActionsLeft}>
                    <View style={styles.modernPartLocationButton}>
                      <Ionicons name="location-outline" size={16} color="#FFFFFF" />
                      <Text style={styles.modernPartLocationButtonText}>
                        {part.location || 'მდებარეობა'}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity 
                    style={styles.modernPartContactButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      const detailItem = convertPartToDetailItem(part);
                      setSelectedDetailItem(detailItem);
                      setShowDetailModal(true);
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="information-outline" size={14} color="#FFFFFF" />
                    <Text style={styles.modernPartContactButtonText}>ინფო</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </LinearGradient>
          </ImageBackground>
        </View>
      );
    }, [partsLikes, user?.id]);

    // Render VIP Part Card
    const renderVIPPart = (part: any) => {
      const partId = part.id || part._id;
      return (
        <TouchableOpacity
          style={styles.vipCard}
          onPress={() => {
            const detailItem = convertPartToDetailItem(part);
            setSelectedDetailItem(detailItem);
            setShowDetailModal(true);
          }}
          activeOpacity={0.7}
        >
          <ImageBackground
            source={{
              uri: part.photos && part.photos.length > 0
                ? part.photos[0]
                : part.images && part.images.length > 0
                  ? part.images[0]
                  : part.image || 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?q=80&w=800&auto=format&fit=crop'
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
                <Text style={styles.vipCardTitle} numberOfLines={2}>{part.title || part.name || 'ავტონაწილი'}</Text>
                <View style={styles.vipCardMeta}>
                  <Ionicons name="location" size={14} color="#FFFFFF" />
                  <Text style={styles.vipCardLocation}>{part.location}</Text>
                </View>
                {part.price && (
                  <View style={styles.vipCardMeta}>
                    <Ionicons name="cash" size={14} color="#FFFFFF" />
                    <Text style={styles.vipCardLocation}>{part.price}</Text>
                  </View>
                )}
              </View>
            </LinearGradient>
          </ImageBackground>
        </TouchableOpacity>
      );
    };

    // Load parts categories from API
    const loadPartsCategories = async () => {
      try {
        setLoadingCategories(true);
        const allCategories = await categoriesApi.getAllCategories();
        // Find categories with 'part' in serviceTypes
        const partsCats = allCategories
          .filter((cat: Category) => cat.serviceTypes?.includes('part'))
          .map((cat: Category) => cat.name);
        
        if (partsCats.length > 0) {
          setPartsCategories(partsCats);
        } else {
          // Fallback to hardcoded categories
          setPartsCategories(PART_CATEGORIES || []);
        }
      } catch (error) {
        console.error('Error loading parts categories:', error);
        // Fallback to hardcoded categories
        setPartsCategories(PART_CATEGORIES || []);
      } finally {
        setLoadingCategories(false);
      }
    };

    const loadLocations = useCallback(async () => {
      try {
        const response = await addItemApi.getPartsLocations();
        if (response.success && response.data) {
          setLocations(response.data);
        }
      } catch (err) {
        console.error('Error loading locations:', err);
      }
    }, []);

    // Load car brands from API
    useEffect(() => {
      const loadCarBrands = async () => {
        try {
          // Get full brand data with logo and country
          const brandsFull = await carBrandsApi.getBrands(false);
          const brandsList = await carBrandsApi.getBrandsList();
          const brands = brandsList.map(b => b.name);
          const modelsMap: { [key: string]: string[] } = {};
          const brandsDataMap: { [key: string]: { name: string; country?: string; logo?: string; models: string[] } } = {};
          
          // Create a map of full brand data by name
          const fullBrandsMap = new Map(brandsFull.map(b => [b.name, b]));
          
          brandsList.forEach(brand => {
            modelsMap[brand.name] = brand.models || [];
            const fullBrand = fullBrandsMap.get(brand.name);
            brandsDataMap[brand.name] = {
              name: brand.name,
              country: fullBrand?.country,
              logo: fullBrand?.logo,
              models: brand.models || [],
            };
          });
          setCarMakes(brands);
          setCarModelsMap(modelsMap);
          setCarBrandsData(brandsDataMap);
        } catch (err) {
          console.error('Error loading car brands:', err);
        }
      };
      loadCarBrands();
    }, []);

    // Initialize data on mount
    useEffect(() => {
      loadPartsCategories();
      loadLocations();
      // Load initial data
      loadDismantlers();
    }, [loadLocations]);

    // Load user's dismantlers
    const loadUserDismantlers = useCallback(async () => {
      if (!user?.id) {
        setHasUserDismantlers(false);
        return;
      }
      
      try {
        const response = await addItemApi.getDismantlers({ ownerId: user.id } as any);
        if (response.success && response.data) {
          const userDismantlersList = response.data || [];
          setUserDismantlers(userDismantlersList);
          setHasUserDismantlers(userDismantlersList.length > 0);
        } else {
          setHasUserDismantlers(false);
        }
      } catch (error) {
        console.error('Error loading user dismantlers:', error);
        setHasUserDismantlers(false);
      }
    }, [user?.id]);

    // Load user's dismantlers when user changes
    useEffect(() => {
      loadUserDismantlers();
    }, [loadUserDismantlers]);

    // Load data when tab changes
    useEffect(() => {
      if (activeTab === 'დაშლილები') {
        loadDismantlers(1, false);
        loadUserDismantlers(); // Reload user dismantlers when switching to dismantlers tab
      } else if (activeTab === 'ნაწილები') {
        loadParts(1, false);
      }
    }, [activeTab]);

    // Reload data when filters change
    useEffect(() => {
      if (activeTab === 'დაშლილები') {
        loadDismantlers(1, false);
      }
    }, [dismantlerFilters]);

    useEffect(() => {
      if (activeTab === 'ნაწილები') {
        loadParts(1, false);
      }
    }, [partsFilters]);
    
    // Load more items when reaching end
    const loadMoreDismantlers = () => {
      if (!loadingMore && hasMoreDismantlers) {
        const nextPage = dismantlersPage + 1;
        setDismantlersPage(nextPage);
        loadDismantlers(nextPage, true);
      }
    };
    
    const loadMoreParts = () => {
      if (!loadingMore && hasMoreParts) {
        const nextPage = partsPage + 1;
        setPartsPage(nextPage);
        loadParts(nextPage, true);
      }
    };


    // Load car models when brand changes
    useEffect(() => {
      if (dismantlerFilters.brand && carModelsMap[dismantlerFilters.brand]) {
        setCarModels(carModelsMap[dismantlerFilters.brand]);
      } else {
        setCarModels([]);
      }
    }, [dismantlerFilters.brand, carModelsMap]);
    
    // Animation values
    const cardAnimations = useRef(parts.map(() => new Animated.Value(0))).current;

    // Extract other data from JSON (categories, conditions, etc.)
    const PART_CATEGORIES = ['Engine', 'Transmission', 'Body', 'Interior', 'Exterior', 'Electrical', 'Suspension', 'Brakes', 'Wheels', 'Other'];
    const CONDITIONS = ['New', 'Used', 'Refurbished', 'Damaged'];
    const LOCATIONS = ['Tbilisi', 'Batumi', 'Kutaisi', 'Rustavi', 'Gori', 'Zugdidi', 'Poti', 'Other'];
    const YEARS = Array.from({ length: 30 }, (_, i) => (2024 - i).toString());
    const STORE_TYPES = ['Retail', 'Wholesale', 'Online', 'Physical'];
    const RATINGS = ['5', '4', '3', '2', '1'];

    // Filtered brands based on search
    const filteredBrands = useMemo(() => {
      if (!brandSearchQuery.trim()) return carMakes;
      return carMakes.filter(brand => 
        brand.toLowerCase().includes(brandSearchQuery.toLowerCase())
      );
    }, [brandSearchQuery, carMakes]);

    // Helper function to get current tab filters
    const getCurrentFilters = () => {
      switch (activeTab) {
        case 'დაშლილები': return dismantlerFilters;
        case 'ნაწილები': return partsFilters;
        default: return dismantlerFilters;
      }
    };

    // Helper functions for DetailModal
    const convertPartToDetailItem = (part: any): DetailItem => {
      const mainImage = part.photos && part.photos.length > 0 
        ? part.photos[0] 
        : part.images && part.images.length > 0 
          ? part.images[0]
          : part.image || 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?q=80&w=600&auto=format&fit=crop';
      
      // Create gallery from all photos or fallback to single image
      const gallery = part.photos && part.photos.length > 0 
        ? part.photos 
        : part.images && part.images.length > 0 
          ? part.images
          : [mainImage];

      return {
        id: part.id,
        title: part.title || part.name,
        description: part.description,
        price: part.price,
        image: mainImage,
        type: 'part',
        seller: part.seller || part.name,
        location: part.location,
        brand: part.brand,
        category: part.category,
        condition: part.condition,
        phone: part.phone,
        gallery: gallery, // Use real photos for gallery
        specifications: {
          'ბრენდი': part.brand || '',
          'კატეგორია': part.category || '',
        'მდგომარეობა': part.condition || '',
        'მყიდველი': part.seller || '',
        'ტელეფონი': part.phone || '',
      },
      features: ['ორიგინალი', 'გარანტია', 'ხარისხიანი']
    };
  };




    const convertDismantlerToDetailItem = (dismantler: any): DetailItem => {
      const mainImage = dismantler.photos && dismantler.photos.length > 0 
        ? dismantler.photos[0] 
        : dismantler.images && dismantler.images.length > 0 
          ? dismantler.images[0]
          : dismantler.image || 'https://images.unsplash.com/photo-1563298723-dcfebaa392e3?q=80&w=800&auto=format&fit=crop';
      
      const gallery = dismantler.photos && dismantler.photos.length > 0 
        ? dismantler.photos 
        : dismantler.images && dismantler.images.length > 0 
          ? dismantler.images
          : [mainImage];
      
      return {
        id: dismantler.id || dismantler._id,
        title: dismantler.name,
        name: dismantler.name,
        description: dismantler.description,
        image: mainImage,
        type: 'dismantler',
        location: dismantler.location,
        phone: dismantler.phone,
        workingHours: '09:00 - 18:00',
        address: dismantler.location,
        features: ['გამოცდილი პერსონალი', 'ხარისხიანი სერვისი'],
        gallery: gallery,
        specifications: {
          'ტიპი': 'დაშლილი მანქანები',
        'ბრენდი': dismantler.brand || 'უცნობი',
        'მოდელი': dismantler.model || 'უცნობი',
        'წლები': (dismantler.yearFrom && dismantler.yearTo) ? `${dismantler.yearFrom} - ${dismantler.yearTo}` : (dismantler.yearFrom || dismantler.yearTo || 'უცნობი'),
          'მდებარეობა': dismantler.location,
          'ტელეფონი': dismantler.phone || 'მიუთითებელი არ არის',
        }
      };
    };

    const handleAddItem = (type: AddModalType, data: any) => {
      
      // Refresh the data based on the type and current tab
      const typeNames: Record<AddModalType, string> = {
        dismantler: 'დაშლილების განცხადება',
        part: 'ნაწილი',
        store: 'მაღაზია',
        carwash: 'სამართ-დასახურებელი',
        mechanic: 'ხელოსანი',
        service: 'ავტოსერვისი',
      };
      
      
      switch (type) {
        case 'dismantler':
          loadDismantlers();
          loadUserDismantlers();
          break;
        case 'part':
          loadParts();
          break;
      }
    };

    const filteredParts = useMemo(() => {
      const q = (searchQuery || '').toLowerCase();
      const brandFilter = (partsFilters.brand || '').toLowerCase();
      const modelFilter = (partsFilters.model || '').toLowerCase();
      const conditionFilter = (partsFilters.condition || '').toLowerCase();
      const locationFilter = (partsFilters.location || '').toLowerCase();
      const priceMin = partsFilters.priceMin ? Number(partsFilters.priceMin) : undefined;
      const priceMax = partsFilters.priceMax ? Number(partsFilters.priceMax) : undefined;

      return parts.filter(part => {
        const title = (part.title || '').toLowerCase();
        const desc = (part.description || '').toLowerCase();
        const brand = (part.brand || part.make || '').toLowerCase();
        const model = (part.model || '').toLowerCase();
        const condition = (part.condition || '').toLowerCase();
        const location = (part.location || '').toLowerCase();
        const priceVal = part.price ? Number(String(part.price).replace(/[^0-9.]/g, '')) : undefined;

        if (q && !title.includes(q) && !desc.includes(q)) return false;
        if (brandFilter && !brand.includes(brandFilter)) return false;
        if (modelFilter && !model.includes(modelFilter)) return false;
        if (conditionFilter && !condition.includes(conditionFilter)) return false;
        if (locationFilter && !location.includes(locationFilter)) return false;
        if (priceMin !== undefined && (priceVal === undefined || priceVal < priceMin)) return false;
        if (priceMax !== undefined && (priceVal === undefined || priceVal > priceMax)) return false;

        return true;
      });
    }, [parts, searchQuery, partsFilters]);


    // Start card animations
    React.useEffect(() => {
      const animations = cardAnimations.map((anim, index) => 
        Animated.timing(anim, {
          toValue: 1,
          duration: 600,
          delay: index * 150,
          useNativeDriver: true,
        })
      );
      Animated.stagger(100, animations).start();
    }, [activeTab]);

    const getTabIcon = (tab: string) => {
      switch (tab) {
        case 'დაშლილები': return 'car-outline';
        case 'ნაწილები': return 'cog-outline';
        default: return 'grid-outline';
      }
    };

    const handleTabChange = (tab: any) => {
      // Reset animations
      cardAnimations.forEach(anim => anim.setValue(0));
      setActiveTab(tab);
    };

    // Dropdown component
    const renderDropdown = (
      key: string, 
      value: string, 
      placeholder: string, 
      options: string[],
      onSelect: (value: string) => void
    ) => (
      <View style={styles.dropdownContainer}>
        <TouchableOpacity 
          style={styles.dropdownButton}
          onPress={() => setOpenDropdown(openDropdown === key ? null : key)}
        >
          <Text style={[styles.dropdownText, !value && styles.dropdownPlaceholder]}>
            {value || placeholder}
          </Text>
          <Ionicons 
            name={openDropdown === key ? "chevron-up" : "chevron-down"} 
            size={16} 
            color="#6B7280" 
          />
        </TouchableOpacity>
      </View>
    );




    return (
      <View style={styles.innovativeContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
        
        {/* Innovative Header */}
        <LinearGradient
          colors={['#F8FAFC', '#FFFFFF']}
          style={styles.innovativeHeader}
        >
          <SafeAreaView>
            <View style={styles.headerContent}>
              <TouchableOpacity style={styles.backBtn} onPress={() => {
                // თუ category-დან მოვიდა (params-დან), category-ზე დაბრუნდეს
                if (params.fromCategory || params.categoryId || params.categoryType) {
                  router.push({
                    pathname: '/category',
                    params: {
                      type: params.categoryType || 'part',
                      categoryId: params.categoryId,
                      name: params.categoryName,
                    }
                  });
                } else if (router.canGoBack()) {
                  // თუ არის history, წინა გვერდზე დაბრუნდეს
                  router.back();
                } else {
                  // თუ არ არის history, მთავარზე დაბრუნდეს
                  router.push('/(tabs)' as any);
                }
              }}>
                <Ionicons name="arrow-back" size={24} color="#111827" />
              </TouchableOpacity>
              
              <View style={styles.headerCenter}>
                <Text style={styles.innovativeTitle}>ავტონაწილები</Text>
                <View style={styles.titleUnderline} />
              </View>
              
              <View style={styles.headerRightSection}>
                <TouchableOpacity 
                  style={styles.headerAddBtn}
                  onPress={() => setShowAddModal(true)}
                  activeOpacity={0.8}
                >
                  <View style={styles.addBtnContent}>
                    <Ionicons name="car-sport" size={20} color="#FFFFFF" />
                    <Ionicons name="add-circle" size={14} color="#FFFFFF" style={styles.addIcon} />
                  </View>
                </TouchableOpacity>
                <Text style={styles.addLabel}>განცხადების დამატება</Text>
              </View>
            </View>
            
            {/* Floating Tab Selector */}
            <View style={styles.floatingTabSelector}>
              {['დაშლილები', 'ნაწილები'].map((t, idx) => (
                <TouchableOpacity
                  key={t}
                  onPress={() => handleTabChange(t as any)}
                  style={[
                    styles.floatingTabItem,
                    activeTab === t && styles.floatingTabItemActive
                  ]}
                >
                  <View style={styles.tabIconWrapper}>
                    <Ionicons 
                      name={getTabIcon(t) as any} 
                      size={20} 
                      color={activeTab === t ? "#FFFFFF" : "#111827"} 
                    />
                  </View>
                  <Text style={[
                    styles.floatingTabItemText, 
                    activeTab === t && styles.floatingTabItemTextActive
                  ]}>
                    {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* AI Search Section */}
            <View style={styles.aiSearchSection}>
              {/* AI Search Banner */}
              
              {/* განცხადებების მართვა - მხოლოდ თუ აქვს დაშლილების განცხადებები */}
              {activeTab === 'დაშლილები' && hasUserDismantlers && (
                <TouchableOpacity 
                  style={styles.manageButton}
                  onPress={() => router.push('/dismantler-management' as any)}
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
                            {userDismantlers.length} განცხადება
                          </Text>
                        </View>
                      </View>
                      <View style={styles.manageButtonRight}>
                        <View style={styles.manageButtonBadge}>
                          <Text style={styles.manageButtonBadgeText}>
                            {userDismantlers.length}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
                      </View>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              )}

              {/* Simple Filter Button */}
              <TouchableOpacity 
                style={styles.simpleFilterButton}
                onPress={() => setShowFilterModal(true)}
                activeOpacity={0.9}
              >
                <View style={styles.simpleFilterContent}>
                  <View style={styles.simpleFilterLeft}>
                    <Ionicons name="options" size={20} color="#3B82F6" />
                  <Text style={styles.simpleFilterText}>
                    {Object.values(getCurrentFilters()).some(v => v) ? 'ფილტრები აქტიურია' : 'ფილტრაცია'}
                  </Text>
                  </View>
                  <View style={styles.simpleFilterRight}>
                    {Object.values(getCurrentFilters()).some(v => v) && (
                      <View style={styles.simpleFilterBadge}>
                        <Text style={styles.simpleFilterBadgeText}>
                          {Object.values(getCurrentFilters()).filter(v => v).length}
                        </Text>
                      </View>
                    )}
                    <Ionicons name="chevron-forward" size={16} color="#6B7280" />
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </LinearGradient>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          
          {/* Loading State */}
          {loading && (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>იტვირთება...</Text>
            </View>
          )}

          {/* Error State */}
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity 
                style={styles.retryButton} 
                onPress={() => {
                  if (activeTab === 'დაშლილები') loadDismantlers();
                  else if (activeTab === 'ნაწილები') loadParts();
                }}
              >
                <Text style={styles.retryText}>თავიდან ცდა</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Content */}
          {!loading && !error && (
            <>
              {/* VIP Dismantlers Section */}
              {activeTab === 'დაშლილები' && vipDismantlers.length > 0 && (
                <View style={styles.vipSection}>
                  <View style={styles.vipSectionHeader}>
                    <Ionicons name="star" size={20} color="#F59E0B" />
                    <Text style={styles.sectionTitle}>VIP დაშლილები</Text>
                  </View>
                  <FlatList
                    horizontal
                    data={vipDismantlers}
                    renderItem={({ item }) => renderVIPDismantler(item)}
                    keyExtractor={(item, index) => item.id || item._id || `vip-dismantler-${index}`}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.vipList}
                    removeClippedSubviews={true}
                    initialNumToRender={3}
                    maxToRenderPerBatch={3}
                    windowSize={2}
                    getItemLayout={(data, index) => ({
                      length: width * 0.75 + 16,
                      offset: (width * 0.75 + 16) * index,
                      index,
                    })}
                  />
                </View>
              )}

              {activeTab === 'დაშლილები' && (
                <View style={styles.modernSection}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.modernSectionTitle}>დაშლილების მაღაზიები</Text>
                    
                  </View>
                  {dismantlers.length > 0 ? (
                    <FlatList
                      data={dismantlers}
                      renderItem={renderDismantlerCard}
                      keyExtractor={(item, index) => item.id || item._id || `dismantler-${index}`}
                      ListFooterComponent={
                        loadingMore ? (
                          <View style={styles.loadingMoreContainer}>
                            <ActivityIndicator size="small" color="#8B5CF6" />
                            <Text style={styles.loadingMoreText}>იტვირთება...</Text>
                          </View>
                        ) : null
                      }
                      onEndReached={loadMoreDismantlers}
                      onEndReachedThreshold={0.5}
                      scrollEnabled={false}
                      nestedScrollEnabled={true}
                      removeClippedSubviews={true}
                      initialNumToRender={3}
                      maxToRenderPerBatch={3}
                      windowSize={2}
                      updateCellsBatchingPeriod={50}
                      getItemLayout={(data, index) => ({
                        length: 220,
                        offset: 220 * index,
                        index,
                      })}
                    />
                  ) : (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyText}>დაშლილები არ მოიძებნა</Text>
                    </View>
                  )}
                </View>
              )}

              {/* VIP Parts Section */}
              {activeTab === 'ნაწილები' && vipParts.length > 0 && (
                <View style={styles.vipSection}>
                  <View style={styles.vipSectionHeader}>
                    <Ionicons name="star" size={20} color="#F59E0B" />
                    <Text style={styles.sectionTitle}>VIP ნაწილები</Text>
                  </View>
                  <FlatList
                    horizontal
                    data={vipParts}
                    renderItem={({ item }) => renderVIPPart(item)}
                    keyExtractor={(item, index) => item.id || item._id || `vip-part-${index}`}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.vipList}
                    removeClippedSubviews={true}
                    initialNumToRender={3}
                    maxToRenderPerBatch={3}
                    windowSize={2}
                    getItemLayout={(data, index) => ({
                      length: width * 0.75 + 16,
                      offset: (width * 0.75 + 16) * index,
                      index,
                    })}
                  />
                </View>
              )}

              {activeTab === 'ნაწილები' && (
                <View style={styles.modernSection}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.modernSectionTitle}>პოპულარული ნაწილები</Text>
                    
                  </View>
                  {filteredParts.length > 0 ? (
                    <FlatList
                      data={filteredParts}
                      renderItem={renderPartCard}
                      keyExtractor={(item, index) => item.id || item._id || `part-${index}`}
                      ListFooterComponent={
                        loadingMore ? (
                          <View style={styles.loadingMoreContainer}>
                            <ActivityIndicator size="small" color="#8B5CF6" />
                            <Text style={styles.loadingMoreText}>იტვირთება...</Text>
                          </View>
                        ) : null
                      }
                      onEndReached={loadMoreParts}
                      onEndReachedThreshold={0.5}
                      scrollEnabled={false}
                      nestedScrollEnabled={true}
                      removeClippedSubviews={true}
                      initialNumToRender={3}
                      maxToRenderPerBatch={3}
                      windowSize={2}
                      updateCellsBatchingPeriod={50}
                      getItemLayout={(data, index) => ({
                        length: 220,
                        offset: 220 * index,
                        index,
                      })}
                    />
                  ) : (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyText}>ნაწილები არ მოიძებნა</Text>
                    </View>
                  )}
                </View>
              )}

            </>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Filter Modal */}
        <Modal
          visible={showFilterModal}
          animationType="slide"
          presentationStyle="pageSheet"
        >
          <View style={styles.modalContainer}>
            <SafeAreaView style={styles.modalContent}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <TouchableOpacity 
                  style={styles.modalCloseBtn}
                  onPress={() => setShowFilterModal(false)}
                >
                  <Ionicons name="close" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.modalTitle}>ფილტრები</Text>
                <TouchableOpacity 
                  style={styles.modalResetBtn}
                  onPress={() => {
                    setDismantlerFilters({
                      brand: '',
                      model: '',
                      yearFrom: '',
                      yearTo: '',
                      condition: '',
                      location: '',
                    });
                    setPartsFilters({
                      brand: '',
                    model: '',
                      category: '',
                      condition: '',
                      priceMin: '',
                      priceMax: '',
                      location: '',
                    });
                  }}
                >
                  <Text style={styles.modalResetText}>გასუფთავება</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                {/* Dismantler Filters */}
                {activeTab === 'დაშლილები' && (
                  <>
                    <View style={styles.filterSection}>
                      <Text style={styles.filterSectionTitle}>ბრენდი</Text>
                      {renderDropdown(
                        'dismantler-brand',
                        dismantlerFilters.brand,
                        'აირჩიეთ ბრენდი',
                        filteredBrands,
                        (value) => setDismantlerFilters(prev => ({ ...prev, brand: value, model: '' }))
                      )}
                    </View>

                    <View style={styles.filterSection}>
                      <Text style={styles.filterSectionTitle}>მოდელი</Text>
                      <View style={[styles.dropdownContainer, !dismantlerFilters.brand && styles.dropdownDisabled]}>
                        <TouchableOpacity 
                          style={[styles.dropdownButton, !dismantlerFilters.brand && styles.dropdownButtonDisabled]}
                          onPress={() => dismantlerFilters.brand && setOpenDropdown(openDropdown === 'dismantler-model' ? null : 'dismantler-model')}
                          disabled={!dismantlerFilters.brand}
                        >
                          <Text style={[styles.dropdownText, !dismantlerFilters.model && styles.dropdownPlaceholder, !dismantlerFilters.brand && styles.dropdownTextDisabled]}>
                            {dismantlerFilters.model || (dismantlerFilters.brand ? 'აირჩიეთ მოდელი' : 'ჯერ აირჩიეთ ბრენდი')}
                          </Text>
                          <Ionicons 
                            name={openDropdown === 'dismantler-model' ? "chevron-up" : "chevron-down"} 
                            size={16} 
                            color={dismantlerFilters.brand ? "#6B7280" : "#D1D5DB"} 
                          />
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={styles.filterSection}>
                      <Text style={styles.filterSectionTitle}>წელი</Text>
                      <View style={styles.yearRangeContainer}>
                        <View style={styles.yearInputWrapper}>
                          <Text style={styles.yearLabel}>წლიდან</Text>
                          {renderDropdown(
                            'dismantler-year-from',
                            dismantlerFilters.yearFrom,
                            'წელი',
                            YEARS,
                            (value) => setDismantlerFilters(prev => ({ ...prev, yearFrom: value }))
                          )}
                        </View>
                        <View style={styles.yearInputWrapper}>
                          <Text style={styles.yearLabel}>წლამდე</Text>
                          {renderDropdown(
                            'dismantler-year-to',
                            dismantlerFilters.yearTo,
                            'წელი',
                            YEARS,
                            (value) => setDismantlerFilters(prev => ({ ...prev, yearTo: value }))
                          )}
                        </View>
                      </View>
                    </View>

                 

                    <View style={styles.filterSection}>
                      <Text style={styles.filterSectionTitle}>მდებარეობა</Text>
                      {renderDropdown(
                        'dismantler-location',
                        dismantlerFilters.location,
                        'აირჩიეთ ქალაქი',
                        LOCATIONS,
                        (value) => setDismantlerFilters(prev => ({ ...prev, location: value }))
                      )}
                    </View>
                  </>
                )}

                {/* Parts Filters */}
                {activeTab === 'ნაწილები' && (
                  <>
                    <View style={styles.filterSection}>
                      <Text style={styles.filterSectionTitle}>კატეგორია</Text>
                      {renderDropdown(
                        'parts-category',
                        partsFilters.category,
                        'აირჩიეთ კატეგორია',
                        partsCategories.length > 0 ? partsCategories : PART_CATEGORIES,
                        (value) => setPartsFilters(prev => ({ ...prev, category: value }))
                      )}
                    </View>

                    <View style={styles.filterSection}>
                      <Text style={styles.filterSectionTitle}>ბრენდი</Text>
                      {renderDropdown(
                        'parts-brand',
                        partsFilters.brand,
                        'აირჩიეთ ბრენდი',
                        filteredBrands,
                        (value) => setPartsFilters(prev => ({ ...prev, brand: value }))
                      )}
                    </View>

                   

                    <View style={styles.filterSection}>
                      <Text style={styles.filterSectionTitle}>ფასი (₾)</Text>
                      <View style={styles.priceInputsContainer}>
                        <View style={styles.priceInputWrapper}>
                          <Text style={styles.priceInputLabel}>დან</Text>
                          <TextInput
                            style={styles.priceInput}
                            value={partsFilters.priceMin}
                            onChangeText={(text) => setPartsFilters(prev => ({ ...prev, priceMin: text }))}
                            placeholder="0"
                            keyboardType="numeric"
                          />
                        </View>
                        <View style={styles.priceSeparator} />
                        <View style={styles.priceInputWrapper}>
                          <Text style={styles.priceInputLabel}>მდე</Text>
                          <TextInput
                            style={styles.priceInput}
                            value={partsFilters.priceMax}
                            onChangeText={(text) => setPartsFilters(prev => ({ ...prev, priceMax: text }))}
                            placeholder="9999"
                            keyboardType="numeric"
                          />
                        </View>
                      </View>
                    </View>

                    <View style={styles.filterSection}>
                      <Text style={styles.filterSectionTitle}>მდებარეობა</Text>
                      <TouchableOpacity 
                        style={styles.dropdownButton}
                        onPress={() => setShowLocationDropdown(!showLocationDropdown)}
                      >
                        <Text style={styles.dropdownText}>
                          {partsFilters.location || 'აირჩიეთ ქალაქი'}
                        </Text>
                        <Ionicons 
                          name={showLocationDropdown ? "chevron-up" : "chevron-down"} 
                          size={16} 
                          color="#6B7280" 
                        />
                      </TouchableOpacity>
                      {showLocationDropdown && (
                        <View style={styles.dropdownContainer}>
                          <ScrollView style={styles.dropdownScroll} nestedScrollEnabled>
                            <TouchableOpacity
                              style={styles.dropdownItem}
                              onPress={() => {
                                setPartsFilters({ ...partsFilters, location: '' });
                                setShowLocationDropdown(false);
                              }}
                            >
                              <Text style={[styles.dropdownItemText, !partsFilters.location && styles.dropdownItemTextSelected]}>
                                ყველა ქალაქი
                              </Text>
                            </TouchableOpacity>
                            {locations.map((location, index) => (
                              <TouchableOpacity
                                key={index}
                                style={styles.dropdownItem}
                                onPress={() => {
                                  setPartsFilters({ ...partsFilters, location });
                                  setShowLocationDropdown(false);
                                }}
                              >
                                <Text style={[styles.dropdownItemText, partsFilters.location === location && styles.dropdownItemTextSelected]}>
                                  {location}
                                </Text>
                                {partsFilters.location === location && (
                                  <Ionicons name="checkmark" size={20} color="#3B82F6" />
                                )}
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </View>
                      )}
                    </View>
                  </>
                )}


                <View style={{ height: 100 }} />
              </ScrollView>

              {/* Apply Button */}
              <View style={styles.modalFooter}>
                <TouchableOpacity 
                  style={styles.applyFiltersBtn}
                  onPress={() => setShowFilterModal(false)}
                >
                  <Text style={styles.applyFiltersBtnText}>
                    {activeTab === 'ნაწილები' 
                      ? `ნაწილების ნახვა (${filteredParts.length})` 
                      : `დაშლილების ნახვა (${dismantlers.length})`}
                  </Text>
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </View>

          {/* Dropdown Overlay */}
          {openDropdown && (
            <View style={styles.dropdownOverlay}>
              <TouchableOpacity 
                style={styles.dropdownBackdrop}
                onPress={() => setOpenDropdown(null)}
              />
              <View style={styles.dropdownOptionsModal}>
                {/* Clean Modal Header */}
                <View style={styles.cleanModalHeader}>
                  <View style={styles.cleanHeaderContent}>
                    <View style={styles.cleanHeaderLeft}>
                      <View style={styles.cleanIconBadge}>
                        <Ionicons 
                          name={openDropdown === 'dismantler-brand' || openDropdown === 'parts-brand' ? 'car-sport' : 'list'} 
                          size={22} 
                          color="#3B82F6" 
                        />
                      </View>
                      <View>
                        <Text style={styles.cleanHeaderTitle}>
                          {openDropdown === 'dismantler-brand' || openDropdown === 'parts-brand' 
                            ? 'ბრენდის არჩევა' 
                            : openDropdown === 'parts-category'
                            ? 'კატეგორიის არჩევა'
                            : 'არჩევა'}
                        </Text>
                        <Text style={styles.cleanHeaderSubtitle}>
                          {openDropdown === 'dismantler-brand' || openDropdown === 'parts-brand' 
                            ? `${filteredBrands.length} ბრენდი ხელმისაწვდომი`
                            : openDropdown === 'parts-category'
                            ? `${partsCategories.length > 0 ? partsCategories.length : PART_CATEGORIES.length} კატეგორია ხელმისაწვდომი`
                            : 'აირჩიეთ ოფცია'}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity 
                      style={styles.cleanCloseButton}
                      onPress={() => setOpenDropdown(null)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="close" size={20} color="#6B7280" />
                    </TouchableOpacity>
                  </View>
                </View>
                
                {/* Clean Search Section */}
                {(openDropdown === 'dismantler-brand' || openDropdown === 'parts-brand') && (
                  <View style={styles.cleanSearchSection}>
                    <View style={styles.cleanSearchWrapper}>
                      <Ionicons name="search" size={18} color="#9CA3AF" style={styles.cleanSearchIcon} />
                      <TextInput
                        style={styles.cleanSearchInput}
                        placeholder="ძებნა ბრენდებში..."
                        placeholderTextColor="#9CA3AF"
                        value={brandSearchQuery}
                        onChangeText={setBrandSearchQuery}
                      />
                      {brandSearchQuery.length > 0 && (
                        <TouchableOpacity 
                          onPress={() => setBrandSearchQuery('')} 
                          style={styles.cleanClearButton}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="close-circle" size={18} color="#6B7280" />
                        </TouchableOpacity>
                      )}
                    </View>
                    {brandSearchQuery.length > 0 && (
                      <Text style={styles.cleanResultsText}>
                        {filteredBrands.length} შედეგი
                      </Text>
                    )}
                  </View>
                )}
                
                {/* Search Section for Category */}
                {openDropdown === 'parts-category' && (
                  <View style={styles.cleanSearchSection}>
                    <View style={styles.cleanSearchWrapper}>
                      <Ionicons name="search" size={18} color="#9CA3AF" style={styles.cleanSearchIcon} />
                      <TextInput
                        style={styles.cleanSearchInput}
                        placeholder="ძებნა კატეგორიებში..."
                        placeholderTextColor="#9CA3AF"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                      />
                      {searchQuery.length > 0 && (
                        <TouchableOpacity 
                          onPress={() => setSearchQuery('')} 
                          style={styles.cleanClearButton}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="close-circle" size={18} color="#6B7280" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                )}

                {(() => {
                  let options: string[] = [];
                  let onSelect: (value: string) => void = () => {};
                  
                  switch(openDropdown) {
                    case 'dismantler-brand':
                      options = filteredBrands;
                      onSelect = (value) => setDismantlerFilters(prev => ({ ...prev, brand: value, model: '' }));
                      break;
                    case 'parts-brand':
                      options = filteredBrands;
                      onSelect = (value) => setPartsFilters(prev => ({ ...prev, brand: value }));
                      break;
                    case 'parts-category':
                      options = partsCategories.length > 0 ? partsCategories : PART_CATEGORIES;
                      onSelect = (value) => setPartsFilters(prev => ({ ...prev, category: value }));
                      break;
                    case 'dismantler-model':
                      if (!dismantlerFilters.brand) {
                        options = ['ჯერ აირჩიეთ ბრენდი'];
                        onSelect = () => {};
                      } else if (carModels.length === 0) {
                        options = ['მოდელები ვერ მოიძებნა'];
                        onSelect = () => {};
                      } else {
                        options = carModels;
                        onSelect = (value) => setDismantlerFilters(prev => ({ ...prev, model: value }));
                      }
                      break;
                    case 'dismantler-year-from':
                      options = YEARS;
                      onSelect = (value) => setDismantlerFilters(prev => ({ ...prev, yearFrom: value }));
                      break;
                    case 'dismantler-year-to':
                      options = YEARS;
                      onSelect = (value) => setDismantlerFilters(prev => ({ ...prev, yearTo: value }));
                      break;
                    case 'dismantler-condition':
                      options = CONDITIONS;
                      onSelect = (value) => setDismantlerFilters(prev => ({ ...prev, condition: value }));
                      break;
                    case 'dismantler-location':
                      options = LOCATIONS;
                      onSelect = (value) => setDismantlerFilters(prev => ({ ...prev, location: value }));
                      break;
                  }

                  // For brand dropdowns, options are already filtered by filteredBrands
                  // For other dropdowns, apply search filtering
                  const isBrandDropdown = openDropdown === 'dismantler-brand' || openDropdown === 'parts-brand';
                  let filteredOptions = options;
                  
                  if (!isBrandDropdown && searchQuery.trim()) {
                    filteredOptions = options.filter(option => 
                      option.toLowerCase().includes(searchQuery.toLowerCase())
                    );
                  }
                  
                  // For category dropdown, also allow search
                  if (openDropdown === 'parts-category' && searchQuery.trim()) {
                    filteredOptions = options.filter(option => 
                      option.toLowerCase().includes(searchQuery.toLowerCase())
                    );
                  }

                  return (
                    <ScrollView style={styles.dropdownScrollView} showsVerticalScrollIndicator={false}>
                      {filteredOptions.map((option, index) => {
                        let currentValue = '';
                        switch(openDropdown) {
                          case 'dismantler-brand': currentValue = dismantlerFilters.brand; break;
                          case 'parts-brand': currentValue = partsFilters.brand; break;
                          case 'parts-category': currentValue = partsFilters.category; break;
                          case 'dismantler-model': currentValue = dismantlerFilters.model; break;
                          case 'dismantler-year-from': currentValue = dismantlerFilters.yearFrom; break;
                          case 'dismantler-year-to': currentValue = dismantlerFilters.yearTo; break;
                          case 'dismantler-condition': currentValue = dismantlerFilters.condition; break;
                          case 'dismantler-location': currentValue = dismantlerFilters.location; break;
                        }
                        
                        const isDisabledMessage = option === 'ჯერ აირჩიეთ ბრენდი' || 
                                                option === 'მოდელები ვერ მოიძებნა';
                        
                        const isBrandOption = (openDropdown === 'dismantler-brand' || openDropdown === 'parts-brand') && !isDisabledMessage;
                        const brandData = isBrandOption ? carBrandsData[option] : null;
                        
                        return (
                          <TouchableOpacity
                            key={`${openDropdown}-${option}-${index}`}
                            style={[
                              styles.dropdownOptionModal,
                              index === filteredOptions.length - 1 && styles.dropdownOptionLast,
                              isDisabledMessage && styles.dropdownOptionDisabled,
                              currentValue === option && styles.dropdownOptionSelected
                            ]}
                            activeOpacity={0.7}
                            onPress={() => {
                              if (!isDisabledMessage) {
                                onSelect(option);
                                setOpenDropdown(null);
                                if (isBrandDropdown) {
                                  setBrandSearchQuery('');
                                } else {
                                  setSearchQuery('');
                                }
                              }
                            }}
                            disabled={isDisabledMessage}
                          >
                            {brandData ? (
                              <View style={styles.cleanBrandCard}>
                                {brandData.logo && (
                                  <View style={styles.cleanBrandLogoContainer}>
                                    <Image 
                                      source={{ uri: brandData.logo }} 
                                      style={styles.cleanBrandLogo}
                                      resizeMode="contain"
                                    />
                                  </View>
                                )}
                                <View style={styles.cleanBrandInfo}>
                                  <Text style={[
                                    styles.cleanBrandName,
                                    currentValue === option && styles.cleanBrandNameSelected
                                  ]}>
                                    {option}
                                  </Text>
                                  <View style={styles.cleanBrandMeta}>
                                    {brandData.country && (
                                      <>
                                        <Text style={styles.cleanCountryText}>{brandData.country}</Text>
                                        <View style={styles.cleanDivider} />
                                      </>
                                    )}
                                    <Text style={styles.cleanModelsText}>{brandData.models.length} მოდელი</Text>
                                  </View>
                                </View>
                                {currentValue === option && (
                                  <View style={styles.cleanSelectedIndicator}>
                                    <Ionicons name="checkmark-circle" size={24} color="#3B82F6" />
                                  </View>
                                )}
                              </View>
                            ) : (
                              <View style={styles.regularOptionContent}>
                                <Text style={[
                                  styles.dropdownOptionText,
                                  currentValue === option && styles.dropdownOptionTextActive,
                                  isDisabledMessage && styles.dropdownOptionTextDisabled
                                ]}>
                                  {option}
                                </Text>
                                {currentValue === option && !isDisabledMessage && (
                                  <Ionicons name="checkmark" size={16} color="#3B82F6" />
                                )}
                                {isDisabledMessage && (
                                  <Ionicons name="information-circle" size={16} color="#9CA3AF" />
                                )}
                              </View>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                      
                      {filteredOptions.length === 0 && (
                        (isBrandDropdown ? brandSearchQuery.length > 0 : searchQuery.length > 0)
                      ) && (
                        <View style={styles.noResultsContainer}>
                          <Ionicons name="search" size={32} color="#D1D5DB" />
                          <Text style={styles.noResultsText}>შედეგები ვერ მოიძებნა</Text>
                          <Text style={styles.noResultsSubtext}>სცადეთ სხვა საძიებო სიტყვა</Text>
                        </View>
                      )}
                    </ScrollView>
                  );
                })()}
              </View>
            </View>
          )}
        </Modal>

        {/* Detail Modal */}
        <DetailModal
          visible={showDetailModal}
          item={selectedDetailItem}
          onClose={() => setShowDetailModal(false)}
          onContact={() => {
            setShowDetailModal(false);
          }}
          onFavorite={() => {
          }}
          isFavorite={false}
        />

        {/* Add Modal */}
        <AddModal
          visible={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSave={handleAddItem}
          defaultType={activeTab === 'დაშლილები' ? 'dismantler' : 'part'}
        />
      </View>
    );
  }

  const { width } = Dimensions.get('window');

  const styles = StyleSheet.create({
    // Main Container
    innovativeContainer: {
      flex: 1,
      backgroundColor: '#F8FAFC',
    },

    // Innovative Header
    innovativeHeader: {
      paddingBottom: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 20,
      elevation: 15,
    },
    headerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 20,
      marginBottom: 24,
    },
    backBtn: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#111827',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 8,
    },
    headerCenter: {
      alignItems: 'center',
    },
    innovativeTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: '#111827',
      letterSpacing: -0.5,
    },
    titleUnderline: {
      width: 40,
      height: 3,
      backgroundColor: '#3B82F6',
      borderRadius: 2,
      marginTop: 4,
    },
    headerRightSection: {
      alignItems: 'center',
      gap: 4,
    },
    addLabel: {
      fontSize: 10,
      fontWeight: '500',
      color: '#6B7280',
      letterSpacing: -0.1,
      textAlign: 'center',
    },
    headerAddBtn: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: '#3B82F6',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#3B82F6',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.3,
      shadowRadius: 15,
      elevation: 10,
      borderWidth: 2,
      borderColor: 'rgba(255,255,255,0.2)',
    },
    addBtnContent: {
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    addIcon: {
      position: 'absolute',
      bottom: -4,
      right: -4,
      backgroundColor: '#1D4ED8',
      borderRadius: 7,
      borderWidth: 1,
      borderColor: '#FFFFFF',
    },

    // Floating Tab Selector
    floatingTabSelector: {
      flexDirection: 'row',
      marginHorizontal: 20,
      backgroundColor: '#FFFFFF',
      borderRadius: 25,
      padding: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 20,
      elevation: 12,
    },
    floatingTabItem: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      paddingHorizontal: 8,
      borderRadius: 20,
      gap: 6,
    },
    floatingTabItemActive: {
      backgroundColor: '#111827',
      shadowColor: '#111827',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    },
    tabIconWrapper: {
      width: 24,
      height: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    floatingTabItemText: {
      fontSize: 11,
      fontWeight: '500',
      color: '#111827',
    },
    floatingTabItemTextActive: {
      color: '#FFFFFF',
    },

    // AI Search Section
    aiSearchSection: {
      marginHorizontal: 20,
      marginTop: 16,
      gap: 12,
    },
    aiSearchBanner: {
      borderRadius: 20,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 16,
      elevation: 12,
    },
    aiGradient: {
      padding: 16,
    },
    aiSearchContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    aiIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(255,255,255,0.2)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    aiTextContainer: {
      flex: 1,
    },
    aiTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: '#FFFFFF',
      marginBottom: 2,
    },
    aiSubtitle: {
      fontSize: 11,
      color: 'rgba(255,255,255,0.8)',
      fontWeight: '400',
    },

    // განცხადებების მართვა ღილაკი
    manageButton: {
      borderRadius: 18,
      shadowColor: '#3B82F6',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.25,
      shadowRadius: 16,
      elevation: 8,
      overflow: 'hidden',
    },
    manageButtonGradient: {
      borderRadius: 18,
    },
    manageButtonContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 18,
      paddingVertical: 16,
    },
    manageButtonLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    manageButtonIconContainer: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    manageButtonTextContainer: {
      flex: 1,
    },
    manageButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#FFFFFF',
      marginBottom: 2,
      letterSpacing: -0.3,
    },
    manageButtonSubtext: {
      fontSize: 12,
      fontWeight: '500',
      color: 'rgba(255, 255, 255, 0.85)',
    },
    manageButtonRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    manageButtonBadge: {
      minWidth: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: 'rgba(255, 255, 255, 0.25)',
      borderWidth: 1.5,
      borderColor: 'rgba(255, 255, 255, 0.4)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
    },
    manageButtonBadgeText: {
      fontSize: 13,
      fontWeight: '800',
      color: '#FFFFFF',
    },
    
    // Simple Filter Button
    simpleFilterButton: {
      backgroundColor: '#FFFFFF',
      borderRadius: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 6,
      borderWidth: 1,
      borderColor: '#E5E7EB',
    },
    simpleFilterContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    simpleFilterLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    simpleFilterText: {
      fontSize: 13,
      fontWeight: '500',
      color: '#374151',
    },
    simpleFilterRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    simpleFilterBadge: {
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: '#3B82F6',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
    },
    simpleFilterBadgeText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#FFFFFF',
    },


    content: {
      flex: 1,
      backgroundColor: '#F8FAFC',
    },

    // Modern Section Styles
    modernSection: {
      paddingHorizontal: 20,
      paddingTop: 24,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    // VIP section header override
    vipSectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
      gap: 8,
    },
    // VIP Section Styles
    vipSection: {
      marginBottom: 24,
      paddingHorizontal: 20,
      paddingTop: 24,
    },
    sectionTitle: {
      fontSize: 18,
      fontFamily: 'HelveticaMedium',
      textTransform: 'uppercase',
      color: '#111827',
    },
    vipCard: {
      width: width * 0.75,
      height: 200,
      borderRadius: 20,
      overflow: 'hidden',
      marginRight: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 6,
    },
    vipCardImage: {
      width: '100%',
      height: '100%',
    },
    vipCardImageStyle: {
      borderRadius: 20,
    },
    vipCardGradient: {
      flex: 1,
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
      fontWeight: '700',
      color: '#F59E0B',
      fontFamily: 'HelveticaMedium',
      textTransform: 'uppercase',
    },
    vipCardContent: {
      gap: 8,
    },
    vipCardTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: '#FFFFFF',
      fontFamily: 'HelveticaMedium',
      textTransform: 'uppercase',
    },
    vipCardMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    vipCardLocation: {
      fontSize: 13,
      color: '#FFFFFF',
      fontWeight: '500',
      fontFamily: 'HelveticaMedium',
      textTransform: 'uppercase',
    },
    vipList: {
      paddingRight: 20,
    },
    sectionActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#3B82F6',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      gap: 6,
      shadowColor: '#3B82F6',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 6,
      elevation: 4,
    },
    addBtnText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '600',
    },
    modernSectionTitle: {
      fontSize: 16,
      fontFamily: 'HelveticaMedium',
      textTransform: 'uppercase',
      fontWeight: '700',
      color: '#111827',
      letterSpacing: -0.2,
    },
    seeAllBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
    },
    seeAllText: {
      fontSize: 12,
      fontWeight: '500',
      color: '#3B82F6',
    },





    // Vertical Stores List
    verticalStoresList: {
      gap: 16,
    },
    verticalStoreCard: {
      flexDirection: 'row',
      backgroundColor: '#FFFFFF',
      borderRadius: 20,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 8,
      borderWidth: 1,
      borderColor: '#F3F4F6',
      marginBottom: 4,
    },
    verticalStoreImageSection: {
      width: 120,
      height: 120,
      position: 'relative',
    },
    verticalStoreImage: {
      width: '100%',
      height: '100%',
    },
    verticalStoreImageOverlay: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: 40,
    },
    verticalStoreImageBadges: {
      position: 'absolute',
      top: 8,
      left: 8,
      right: 8,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    verticalTypeBadge: {
      backgroundColor: 'rgba(59, 130, 246, 0.9)',
      paddingHorizontal: 6,
      paddingVertical: 3,
      borderRadius: 8,
    },
    verticalTypeText: {
      color: '#FFFFFF',
      fontSize: 9,
      fontWeight: '500',
    },
    verticalStoreContent: {
      flex: 1,
      padding: 12,
      justifyContent: 'space-between',
    },
    verticalStoreMainInfo: {
      flex: 1,
    },
    verticalStoreName: {
      fontSize: 15,
      fontWeight: '600',
      color: '#111827',
      marginBottom: 6,
      lineHeight: 18,
    },
    verticalStoreMetaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 10,
    },
    verticalLocationInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      flex: 1,
    },
    verticalLocationText: {
      fontSize: 12,
      color: '#6B7280',
      fontWeight: '400',
    },
    verticalStoreStats: {
      flexDirection: 'row',
      gap: 6,
    },
    verticalStatItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      backgroundColor: '#F3F4F6',
      paddingHorizontal: 5,
      paddingVertical: 2,
      borderRadius: 6,
    },
    verticalStatText: {
      fontSize: 9,
      fontWeight: '500',
      color: '#6B7280',
      maxWidth: 80,
    },
    verticalStoreActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    verticalActionBtnSecondary: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: '#F9FAFB',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: '#E5E7EB',
    },
    verticalActionBtnPrimary: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#111827',
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 12,
      gap: 4,
      shadowColor: '#111827',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 6,
      elevation: 4,
    },
    verticalActionPrimaryText: {
      fontSize: 12,
      fontWeight: '500',
      color: '#FFFFFF',
    },


    // Filter Modal Styles
    modalContainer: {
      flex: 1,
      backgroundColor: '#F8FAFC',
    },
    modalContent: {
      flex: 1,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      backgroundColor: '#FFFFFF',
      borderBottomWidth: 1,
      borderBottomColor: '#E5E7EB',
    },
    modalCloseBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: '#F9FAFB',
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: '#111827',
    },
    modalResetBtn: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
    },
    modalResetText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#EF4444',
    },
    modalScroll: {
      flex: 1,
      paddingHorizontal: 20,
    },
    filterSection: {
      marginTop: 24,
    },
    filterSectionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: '#111827',
      marginBottom: 12,
    },
    dropdownButton: {
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: '#E5E7EB',
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    dropdownText: {
      fontSize: 14,
      color: '#374151',
      fontWeight: '400',
    },
    dropdownPlaceholder: {
      color: '#9CA3AF',
    },
    dropdownDisabled: {
      opacity: 0.6,
    },
    dropdownButtonDisabled: {
      backgroundColor: '#F9FAFB',
      borderColor: '#E5E7EB',
    },
  dropdownTextDisabled: {
    color: '#9CA3AF',
  },
  dropdownContainer: {
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    maxHeight: 200,
  },
  dropdownScroll: {
    maxHeight: 200,
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dropdownItemText: {
    fontSize: 15,
    color: '#111827',
    flex: 1,
  },
  dropdownItemTextSelected: {
    color: '#3B82F6',
    fontWeight: '600',
  },
    dropdownOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 2000,
      justifyContent: 'center',
      alignItems: 'center',
    },
    dropdownBackdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    dropdownOptionsModal: {
      backgroundColor: '#FFFFFF',
      borderRadius: 32,
      width: 340,
      height: 520,
      alignSelf: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: 0.3,
      shadowRadius: 24,
      elevation: 20,
      overflow: 'hidden',
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 20,
      marginTop: 16,
      marginBottom: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: '#F3F4F6',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#E5E7EB',
    },
    searchIcon: {
      marginRight: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 16,
      color: '#374151',
      paddingVertical: 0,
    },
    clearButton: {
      padding: 2,
      marginLeft: 8,
    },
    dropdownScrollView: {
      height: 400,
      paddingBottom: 8,
    },
    noResultsContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 40,
      paddingHorizontal: 20,
    },
    noResultsText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#6B7280',
      marginTop: 12,
      marginBottom: 4,
    },
    noResultsSubtext: {
      fontSize: 14,
      color: '#9CA3AF',
    },
    dropdownOptionModal: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: '#E5E7EB',
      minHeight: 70,
      backgroundColor: '#FFFFFF',
    },
    dropdownOptionDisabled: {
      backgroundColor: '#F9FAFB',
      opacity: 0.7,
    },
    dropdownOptionSelected: {
      backgroundColor: '#F8FAFC',
      borderLeftWidth: 3,
      borderLeftColor: '#3B82F6',
    },
    dropdownOptionTextDisabled: {
      color: '#9CA3AF',
      fontStyle: 'italic',
    },
    dropdownOptionLast: {
      borderBottomWidth: 0,
    },
    dropdownOptionText: {
      fontSize: 16,
      color: '#111827',
      fontWeight: '500',
      lineHeight: 20,
    },
    dropdownOptionTextActive: {
      color: '#3B82F6',
      fontWeight: '600',
    },
    yearRangeContainer: {
      flexDirection: 'row',
      gap: 12,
    },
    yearInputWrapper: {
      flex: 1,
    },
    yearLabel: {
      fontSize: 12,
      fontWeight: '500',
      color: '#6B7280',
      marginBottom: 8,
    },
    priceInputsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    priceInputWrapper: {
      flex: 1,
    },
    priceInputLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: '#6B7280',
      marginBottom: 8,
    },
    priceInput: {
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: '#E5E7EB',
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 16,
      color: '#111827',
    },
    priceSeparator: {
      width: 20,
      height: 1,
      backgroundColor: '#D1D5DB',
      marginTop: 20,
    },
    modalFooter: {
      padding: 20,
      backgroundColor: '#FFFFFF',
      borderTopWidth: 1,
      borderTopColor: '#E5E7EB',
    },
    applyFiltersBtn: {
      backgroundColor: '#111827',
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: 'center',
      shadowColor: '#111827',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 12,
      elevation: 8,
    },
    applyFiltersBtnText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },

    // Enhanced Dropdown Option Styles
    dropdownOptionContent: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    dropdownOptionTextContainer: {
      flex: 1,
      marginLeft: 12,
    },
    brandLogo: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: '#F9FAFB',
      borderWidth: 1,
      borderColor: '#E5E7EB',
    },
    brandCountryText: {
      fontSize: 12,
      color: '#6B7280',
      fontWeight: '400',
      marginTop: 2,
    },

    // Clean Modal Header Styles
    cleanModalHeader: {
      backgroundColor: '#FFFFFF',
      borderBottomWidth: 1,
      borderBottomColor: '#E5E7EB',
      paddingHorizontal: 20,
      paddingVertical: 18,
    },
    cleanHeaderContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    cleanHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    cleanIconBadge: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: '#F8FAFC',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 14,
      borderWidth: 1,
      borderColor: '#E5E7EB',
    },
    cleanHeaderTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: '#111827',
      letterSpacing: -0.3,
    },
    cleanHeaderSubtitle: {
      fontSize: 13,
      fontWeight: '500',
      color: '#6B7280',
      marginTop: 2,
    },
    cleanCloseButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: '#F9FAFB',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: '#E5E7EB',
    },

    // Enhanced Search Styles
    brandSearchContainer: {
      paddingHorizontal: 20,
      paddingVertical: 16,
      backgroundColor: '#FFFFFF',
    },
    searchInputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#F9FAFB',
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: '#E5E7EB',
    },
    searchIconStyle: {
      marginRight: 12,
    },
    brandSearchInput: {
      flex: 1,
      fontSize: 16,
      color: '#111827',
      fontWeight: '400',
    },
    clearSearchButton: {
      padding: 4,
      marginLeft: 8,
    },

    // Advanced Search Styles
    advancedSearchSection: {
      paddingHorizontal: 24,
      paddingVertical: 20,
      backgroundColor: '#FAFBFC',
    },
    glassSearchWrapper: {
      marginBottom: 12,
    },
    searchGlassEffect: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.9)',
      borderRadius: 20,
      paddingHorizontal: 20,
      paddingVertical: 16,
      shadowColor: '#6366F1',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 8,
      borderWidth: 1,
      borderColor: 'rgba(99, 102, 241, 0.2)',
    },
    glassSearchIcon: {
      marginRight: 12,
    },
    glassSearchInput: {
      flex: 1,
      fontSize: 16,
      color: '#111827',
      fontWeight: '500',
    },
    glassClearButton: {
      padding: 4,
    },
    searchResultsText: {
      fontSize: 14,
      color: '#6366F1',
      fontWeight: '600',
      textAlign: 'center',
    },

    // Modern Brand Card Styles
    modernBrandCard: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      paddingVertical: 4,
    },
    brandLogoContainer: {
      position: 'relative',
      marginRight: 16,
    },
    modernBrandLogo: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: '#F9FAFB',
      borderWidth: 2,
      borderColor: '#E5E7EB',
    },
    selectedBadge: {
      position: 'absolute',
      top: -4,
      right: -4,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: '#10B981',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: '#FFFFFF',
    },
    brandInfoSection: {
      flex: 1,
    },
    modernBrandName: {
      fontSize: 18,
      fontWeight: '700',
      color: '#111827',
      marginBottom: 6,
    },
    modernBrandNameSelected: {
      color: '#6366F1',
    },
    brandMetaRow: {
      flexDirection: 'row',
      gap: 8,
    },
    countryChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(99, 102, 241, 0.1)',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      gap: 4,
    },
    countryChipText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#6366F1',
    },
    modelsChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(236, 72, 153, 0.1)',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      gap: 4,
    },
    modelsChipText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#EC4899',
    },
    selectedIndicator: {
      marginLeft: 12,
    },
    regularOptionContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flex: 1,
    },

    // Clean Search Styles
    cleanSearchSection: {
      backgroundColor: '#F9FAFB',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: '#E5E7EB',
    },
    cleanSearchWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#FFFFFF',
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: '#E5E7EB',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    cleanSearchIcon: {
      marginRight: 12,
    },
    cleanSearchInput: {
      flex: 1,
      fontSize: 15,
      color: '#111827',
      fontWeight: '500',
    },
    cleanClearButton: {
      padding: 4,
    },
    cleanResultsText: {
      fontSize: 13,
      color: '#3B82F6',
      fontWeight: '600',
      textAlign: 'center',
      marginTop: 8,
    },

    // Clean Brand Card Styles
    cleanBrandCard: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      paddingVertical: 2,
    },
    cleanBrandLogoContainer: {
      marginRight: 16,
    },
    cleanBrandLogo: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: '#F9FAFB',
      borderWidth: 1,
      borderColor: '#E5E7EB',
    },
    cleanBrandInfo: {
      flex: 1,
    },
    cleanBrandName: {
      fontSize: 16,
      fontWeight: '700',
      color: '#111827',
      marginBottom: 4,
      letterSpacing: -0.2,
    },
    cleanBrandNameSelected: {
      color: '#3B82F6',
    },
    cleanBrandMeta: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    cleanCountryText: {
      fontSize: 13,
      fontWeight: '500',
      color: '#6B7280',
    },
    cleanDivider: {
      width: 1,
      height: 12,
      backgroundColor: '#E5E7EB',
      marginHorizontal: 8,
    },
    cleanModelsText: {
      fontSize: 13,
      fontWeight: '500',
      color: '#6B7280',
    },
    cleanSelectedIndicator: {
      marginLeft: 12,
    },

    // Vertical Parts List
    verticalPartsList: {
      gap: 16,
    },
    verticalPartCard: {
      flexDirection: 'row',
      backgroundColor: '#FFFFFF',
      borderRadius: 20,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 8,
      borderWidth: 1,
      borderColor: '#F3F4F6',
      marginBottom: 4,
    },
    verticalPartImageSection: {
      width: 120,
      height: 120,
      position: 'relative',
    },
    verticalPartImage: {
      width: '100%',
      height: '100%',
    },
    verticalPartImageOverlay: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: 40,
    },
    verticalPartConditionBadge: {
      position: 'absolute',
      top: 8,
      left: 8,
      backgroundColor: 'rgba(59, 130, 246, 0.9)',
      paddingHorizontal: 6,
      paddingVertical: 3,
      borderRadius: 8,
    },
    verticalPartConditionText: {
      color: '#FFFFFF',
      fontSize: 9,
      fontWeight: '500',
    },
    verticalPartPriceBadge: {
      position: 'absolute',
      bottom: 8,
      right: 8,
      backgroundColor: 'rgba(17, 24, 39, 0.9)',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    verticalPartPriceText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '700',
    },
    verticalPartContent: {
      flex: 1,
      padding: 12,
      justifyContent: 'space-between',
    },
    verticalPartMainInfo: {
      flex: 1,
    },
    verticalPartName: {
      fontSize: 15,
      fontWeight: '600',
      color: '#111827',
      marginBottom: 6,
      lineHeight: 18,
    },
    verticalPartMetaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 10,
    },
    verticalPartLocationInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      flex: 1,
    },
    verticalPartLocationText: {
      fontSize: 12,
      color: '#6B7280',
      fontWeight: '400',
    },
    verticalPartStats: {
      flexDirection: 'row',
      gap: 6,
    },
    verticalPartStatItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      backgroundColor: '#F3F4F6',
      paddingHorizontal: 5,
      paddingVertical: 2,
      borderRadius: 6,
    },
    verticalPartStatText: {
      fontSize: 9,
      fontWeight: '500',
      color: '#6B7280',
      maxWidth: 80,
    },
    verticalPartActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    verticalPartActionBtnSecondary: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: '#F9FAFB',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: '#E5E7EB',
    },
    verticalPartActionBtnPrimary: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#111827',
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 12,
      gap: 4,
      shadowColor: '#111827',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 6,
      elevation: 4,
    },
    verticalPartActionPrimaryText: {
      fontSize: 12,
      fontWeight: '500',
      color: '#FFFFFF',
    },
    
    // Loading and Error States
    loadingContainer: {
      padding: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    loadingText: {
      fontSize: 16,
      color: '#6B7280',
      fontWeight: '500',
    },
    errorContainer: {
      padding: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    errorText: {
      fontSize: 16,
      color: '#EF4444',
      textAlign: 'center',
      marginBottom: 16,
      fontWeight: '500',
    },
    retryButton: {
      backgroundColor: '#3B82F6',
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 8,
    },
    retryText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '600',
    },
    emptyState: {
      padding: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyText: {
      fontSize: 16,
      color: '#9CA3AF',
      fontWeight: '500',
  },

  // Modern Store Card Styles
  modernStoresContainer: {
    gap: 12,
  },
  
  modernStoreCard: {
    height: 220,
    marginBottom: 10,
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  
  modernStoreBackgroundImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'space-between',
    borderRadius: 10,
  },
  
  modernStoreGradientOverlay: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 12,
  },
  
  modernStoreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  
  modernStoreProfileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  
  modernStoreAvatarPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    overflow: 'hidden',
  },
  
  modernStoreAvatar: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  
  modernStoreUsername: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'HelveticaMedium', textTransform: 'uppercase',
  },
  
  modernStoreLikeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backdropFilter: 'blur(10px)',
  },
  
  modernStoreActionText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontFamily: 'HelveticaMedium', textTransform: 'uppercase',
    fontWeight: '500',
  },
  
  modernStoreMainCard: {
    borderRadius: 8,
    padding: 8,
  },
  
  modernStoreInfoSection: {
    marginBottom: 12,
  },
  
  modernStoreLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  
  modernStoreLocationText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontFamily: 'HelveticaMedium', textTransform: 'uppercase',
    fontWeight: '500',
  },
  
  modernStoreSeparator: {
    height: 1,
    marginVertical: 8,
  },
  
  modernStoreTypeSection: {
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  
  modernStoreTypeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  
  modernStoreCallButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(17, 24, 39, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  
  modernStoreActionsFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  
  modernStoreActionsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  
  modernStoreActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backdropFilter: 'blur(10px)',
  },
  
  modernStoreLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backdropFilter: 'blur(10px)',
  },
  
  modernStoreLocationButtonText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontFamily: 'HelveticaMedium', textTransform: 'uppercase',
    fontWeight: '500',
    maxWidth: 80,
  },

  // Modern Parts Styles
  modernPartsContainer: {
    gap: 12,
  },

  modernPartCard: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },

  modernPartBackgroundImage: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },

  modernPartGradientOverlay: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },

  modernPartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  modernPartProfileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },

  modernPartAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },

  modernPartAvatar: {
    width: '100%',
    height: '100%',
  },

  modernPartUsername: {
    fontSize: 14,
    color: '#FFFFFF',
    fontFamily: 'HelveticaMedium', textTransform: 'uppercase',
    fontWeight: '600',
    flex: 1,
  },

  modernPartLikeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backdropFilter: 'blur(10px)',
  },

  modernPartActionText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontFamily: 'HelveticaMedium', textTransform: 'uppercase',
    fontWeight: '600',
  },

  modernPartMainCard: {
    flex: 1,
    justifyContent: 'flex-end',
  },

  modernPartInfoSection: {
    marginBottom: 8,
  },

  modernPartNameInfo: {
    fontSize: 14,
    color: '#FFFFFF',
    fontFamily: 'HelveticaMedium', textTransform: 'uppercase',
    fontWeight: '700',
    marginBottom: 2,
  },

  modernPartCategoryInfo: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    fontFamily: 'HelveticaMedium', textTransform: 'uppercase',
    fontWeight: '500',
  },

  modernPartSeparator: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginVertical: 6,
  },

  modernPartTypeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  modernPartTypeLeft: {
    flex: 1,
  },

  modernPartLocationText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
    fontFamily: 'HelveticaMedium', textTransform: 'uppercase',
    fontWeight: '500',
  },

  modernPartCallButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(17, 24, 39, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },

  modernPartActionsFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },

  modernPartActionsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  modernPartActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backdropFilter: 'blur(10px)',
  },

  modernPartLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backdropFilter: 'blur(10px)',
  },

  modernPartLocationButtonText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontFamily: 'HelveticaMedium', textTransform: 'uppercase',
    fontWeight: '500',
    maxWidth: 80,
  },

  modernPartContactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 15,
    backgroundColor: 'rgba(17, 24, 39, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },

  modernPartContactButtonText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontFamily: 'HelveticaMedium', textTransform: 'uppercase',
    fontWeight: '600',
  },

  // Modern Dismantlers Styles
  modernDismantlersContainer: {
    gap: 12,
  },

  modernDismantlerCard: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },

  modernDismantlerBackgroundImage: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },

  modernDismantlerGradientOverlay: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },

  modernDismantlerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  modernDismantlerProfileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },

  modernDismantlerAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },

  modernDismantlerAvatar: {
    width: '100%',
    height: '100%',
  },

  modernDismantlerUsername: {
    fontSize: 14,
    color: '#FFFFFF',
    fontFamily: 'HelveticaMedium', textTransform: 'uppercase',
    fontWeight: '600',
    flex: 1,
  },

  modernDismantlerLikeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backdropFilter: 'blur(10px)',
  },

  modernDismantlerActionText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontFamily: 'HelveticaMedium', textTransform: 'uppercase',
    fontWeight: '600',
  },

  modernDismantlerMainCard: {
    flex: 1,
    justifyContent: 'flex-end',
  },

  modernDismantlerInfoSection: {
    marginBottom: 8,
  },

  modernDismantlerCarInfoButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(17, 24, 39, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    marginBottom: 4,
    alignSelf: 'flex-start',
  },

  modernDismantlerCarInfoText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontFamily: 'HelveticaMedium', textTransform: 'uppercase',
    fontWeight: '600',
  },

  modernDismantlerYearButton: {
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(17, 24, 39, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignSelf: 'flex-start',
  },

  modernDismantlerYearText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontFamily: 'HelveticaMedium', textTransform: 'uppercase',
    fontWeight: '500',
  },

  modernDismantlerSeparator: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginVertical: 6,
  },

  modernDismantlerTypeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  modernDismantlerTypeLeft: {
    flex: 1,
  },

  modernDismantlerLocationText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
    fontFamily: 'HelveticaMedium', textTransform: 'uppercase',
    fontWeight: '500',
  },

  modernDismantlerCallButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(17, 24, 39, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },

  modernDismantlerActionsFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },

  modernDismantlerActionsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  modernDismantlerActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backdropFilter: 'blur(10px)',
  },

  modernDismantlerLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backdropFilter: 'blur(10px)',
  },

  modernDismantlerLocationButtonText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontFamily: 'HelveticaMedium', textTransform: 'uppercase',
    fontWeight: '500',
    maxWidth: 80,
  },

  modernDismantlerContactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 15,
    backgroundColor: 'rgba(17, 24, 39, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },

  modernDismantlerContactButtonText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontFamily: 'HelveticaMedium', textTransform: 'uppercase',
    fontWeight: '600',
  },

  // Modern AI Card with Dark Background
  modernAICard: {
    width: '100%',
    height: 80,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },

  modernAIBackground: {
    flex: 1,
    backgroundColor: 'black',
    padding: 12,
    justifyContent: 'center',
  },
  
  modernStoreContactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 15,
    backgroundColor: 'rgba(17, 24, 39, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  
  modernStoreContactButtonText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontFamily: 'HelveticaMedium', textTransform: 'uppercase',
    fontWeight: '600',
  },
  loadingMoreContainer: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingMoreText: {
    marginTop: 8,
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'HelveticaMedium', textTransform: 'uppercase',
  },
});


