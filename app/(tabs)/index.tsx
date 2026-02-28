import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ImageBackground,
  Image,
  Dimensions,
  RefreshControl,
  Modal,
  Linking,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

import { LinearGradient } from 'expo-linear-gradient';
import Colors from '../../constants/Colors';
import { useRouter } from 'expo-router';
import { useUser } from '../../contexts/UserContext';
import { useSubscription } from '../../contexts/SubscriptionContext';
import SubscriptionModal from '../../components/ui/SubscriptionModal';
import PremiumInfoModal from '../../components/ui/PremiumInfoModal';
import API_BASE_URL from '../../config/api';
import { bogApi } from '../../services/bogApi';
import BOGPaymentModal from '../../components/ui/BOGPaymentModal';
import ServiceCard from '../../components/ui/ServiceCard';
import CommunitySection from '../../components/ui/CommunitySection';
import ReminderSection from '../../components/ui/ReminderSection';
import StoriesRow from '../../components/ui/StoriesRow';
import StoryViewer from '../../components/ui/StoryViewer';
import StoryOverlay from '../../components/ui/StoryOverlay';
import NotificationsModal from '../../components/ui/NotificationsModal';
import RacingBanner from '../../components/ui/RacingBanner';
import CarRentalCard from '../../components/ui/CarRentalCard';
import DetailView, { DetailViewProps } from '../../components/DetailView';
import { useEffect } from 'react';
import { useFocusEffect } from 'expo-router';
import { getResponsiveDimensions, getResponsiveCardWidth } from '../../utils/responsive';
import { analyticsService } from '../../services/analytics';
import CredoBankBannerTracker from '../../components/CredoBankBannerTracker';
import AnalyticsTracker, { useButtonTracking } from '../../components/AnalyticsTracker';
import { analyticsApi } from '../../services/analyticsApi';

const { screenWidth, contentWidth, horizontalMargin, isTablet } = getResponsiveDimensions();
const H_MARGIN = 20;
const H_GAP = 10;
const POPULAR_CARD_WIDTH = getResponsiveDimensions().contentWidth - (H_MARGIN * 2);
const RENTAL_CARD_WIDTH = 280; 


// Popular services are now fetched from API

export default function TabOneScreen() {
  const router = useRouter();
  const screenName = 'მთავარი';
  // უბრალოდ light mode გამოვიყენოთ error-ის თავიდან ასაცილებლად
  const colors = Colors['light'];
  const { user, shouldOpenPremiumModal, clearPremiumModalFlag, logout } = useUser();
  const { subscription, hasActiveSubscription, isPremiumUser } = useSubscription();
  const displayFirstName = user?.name ? user.name.split(' ')[0] : '';
  const insets = useSafeAreaInsets();
  const fabBottom = Math.max(96, 20 + insets.bottom);
  const greetingText = React.useMemo(() => {
    const base = displayFirstName ? `გამარჯობა, ${displayFirstName}` : 'გამარჯობა';
    const maxChars = 20;
    const sliced = base.slice(0, Math.max(0, maxChars - 1)); // ვტოვებთ ადგილს ძახილისთვის
    return `${sliced}!`;
  }, [displayFirstName]);
  
  // Promo banner state
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const [notificationsModalVisible, setNotificationsModalVisible] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [openStoryIndex, setOpenStoryIndex] = useState<number | null>(null);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [showBOGPaymentModal, setShowBOGPaymentModal] = useState(false);
  const [bogPaymentUrl, setBogPaymentUrl] = useState<string>('');
  const [bogOAuthStatus, setBogOAuthStatus] = useState<any>(null);
  const [isProcessingTestPayment, setIsProcessingTestPayment] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [sendingFeedback, setSendingFeedback] = useState(false);
  const [showPremiumInfoModal, setShowPremiumInfoModal] = useState(false);
  
  // Refresh stories when overlay closes (to update seen status)
  const refreshStories = React.useCallback(async () => {
    try {
      const userIdParam = user?.id ? `&userId=${encodeURIComponent(user.id)}` : '';
      const res = await fetch(`${API_BASE_URL}/stories?highlight=true${userIdParam}`);
      const json = await res.json().catch(() => ({}));
      const data = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
      // Log raw items array separately to see full content
     
      

      const mapped = data.map((s: any) => ({
        id: String(s.id || s._id),
        author: { id: String(s.authorId || 'svc'), name: s.authorName || 'Story', avatar: s.authorAvatar },
        createdAt: Number(s.createdAt || Date.now()),
        items: Array.isArray(s.items) ? s.items.map((it: any) => {
          const uri = it.uri || it.url || it.image || it.imageUrl || (typeof it.image === 'object' && it.image?.uri) || '';
          return {
            id: String(it.id || it._id || Math.random()),
            type: it.type || 'image',
            uri: uri,
            durationMs: it.durationMs,
            caption: it.caption,
            poll: it.poll,
          };
        }) : [],
        highlight: !!s.highlight,
        category: s.category,
        seen: !!s.isSeen,
        internalImage: s.internalImage || undefined,
      }));
      
      setStories(mapped);
    } catch (error) {
      console.error('❌ Error fetching stories:', error);
    }
  }, [user?.id]);
  
  const [popularServices, setPopularServices] = useState<any[]>([]);
  const [nearbyServices, setNearbyServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [nearbyLoading, setNearbyLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false); // Pull-to-refresh state
  const [offers, setOffers] = useState<any[]>([]);
  const [offersLoading, setOffersLoading] = useState<boolean>(false);
  const [quickActionsIndex, setQuickActionsIndex] = useState(0);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [selectedService, setSelectedService] = useState<any | null>(null);
  
  // Car Rental state
  const [rentalCars, setRentalCars] = useState<any[]>([]);
  const [rentalCarsLoading, setRentalCarsLoading] = useState(true);

  const quickActionsList = [
    {
      key: 'fuel',
      title: 'საწვავი',
      subtitle: 'ფასების შედარება და რეკომენდაციები',
      icon: 'flame',
      colors: ['#F59E0B', '#D97706'],
      pill: 'საწვავი',
      tag: 'ახალი',
      route: '/fuel-stations' as any,
    },
    {
      key: 'parts',
      title: 'ნაწილები',
      subtitle: 'ავტონაწილების მოძიება და შეძენა',
      icon: 'construct',
      colors: ['#10B981', '#059669'],
      pill: 'დაშლილები',
      tag: 'ძიება',
      route: '/parts' as any,
    },
    {
      key: 'wash',
      title: 'ავტო სამრეცხაო',
      subtitle: 'ბუქინგი უახლოეს სამრეცხაოში',
      icon: 'water',
      colors: ['#22C55E', '#16A34A'],
      pill: 'დაჯავშნა',
      tag: 'ახალი',
      route: '/(tabs)/carwash' as any,
    },

    {
      key: 'mechanic',
      title: 'ხელოსანი',
      subtitle: 'მექანიკოსების ძიება და ჯავშნები',
      icon: 'build',
      colors: ['#3B82F6', '#1D4ED8'],
      pill: 'ჯავშნა',
      tag: 'სერვისი',
      route: '/mechanics' as any,
    },

    {
      key: 'rental',
      title: 'მანქანის გაქირავება',
      subtitle: 'მანქანების გაქირავება და ჯავშნები',
      icon: 'car-sport',
      colors: ['#8B5CF6', '#7C3AED'],
      pill: 'გაქირავება',
      tag: 'ახალი',
      route: '/car-rental-list' as any,
    },
   
  ];

  const carfaxCard = {
    key: 'carfax',
    title: 'კარფაქსი',
    subtitle: 'ავტომობილის ისტორიის შემოწმება',
    icon: 'document-text',
    colors: ['#FFFFFF', '#F9FAFB'],
    pill: 'შემოწმება',
    tag: 'დაცვა',
    route: '/carfax' as any,
  };

  
  const [stories, setStories] = useState<any[]>([]);

  useEffect(() => {
    refreshStories();
  }, [refreshStories]);

  useEffect(() => {
    const validateUser = async () => {
      if (!user?.id) {
        return; 
      }

      // Check if user role is 'customer' - should logout
      if (user.role === 'customer') {
        console.warn('⚠️ [HOME] User has customer role, logging out...');
        await logout();
        router.replace('/login');
        return;
      }

      try {
        const verifyResponse = await fetch(`${API_BASE_URL}/auth/verify-user/${user.id}`);
        const verifyData = await verifyResponse.json();

        if (!verifyData.exists || !verifyData.valid) {
          console.warn('⚠️ [HOME] User not found in backend or invalid, logging out...');
          console.warn('⚠️ [HOME] Reason:', verifyData.reason || 'user_not_found');
          await logout();
          router.replace('/login');
        }
      } catch (verifyError) {
        console.error('❌ [HOME] Error verifying user:', verifyError);
       
        console.warn('⚠️ [HOME] Could not verify user, but continuing');
      }
    };

    validateUser();
  }, [user?.id, user?.role, logout, router]);

  React.useEffect(() => {
    if (shouldOpenPremiumModal) {
      if (subscription?.plan !== 'premium' && subscription?.plan !== 'basic') {
        setShowSubscriptionModal(true);
        clearPremiumModalFlag(); 
      } else {
        setShowPremiumInfoModal(true);
      }
    }
  }, [shouldOpenPremiumModal, subscription?.plan, clearPremiumModalFlag]);

  React.useEffect(() => {
    if (showPremiumInfoModal) {
      if (!subscription || subscription.plan === 'free' || (subscription.plan !== 'premium' && subscription.plan !== 'basic')) {
        setShowPremiumInfoModal(false);
        setTimeout(() => {
          setShowSubscriptionModal(true);
        }, 100);
      }
    }
  }, [showPremiumInfoModal, subscription?.plan]);

  React.useEffect(() => {
    if (user && !hasActiveSubscription && subscription?.plan === 'free') {
      const timer = setTimeout(() => {
        setShowSubscriptionModal(true);
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [user, hasActiveSubscription, subscription?.plan]);
  
  const handleScroll = (event: any) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollPosition / (screenWidth - 60));
    setCurrentBannerIndex(index);
  };

  const fetchServices = async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      
      const response = await fetch(`${API_BASE_URL}/services/popular?limit=6`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const text = await response.text();
      if (!text) {
        throw new Error('Empty response from server');
      }
      
      const data = JSON.parse(text);
      const formattedServices = data.map((service: any) => ({
        id: service.id,
        name: service.title, 
        location: service.location,
        rating: service.rating || 4.5, 
        price: service.price 
          ? (typeof service.price === 'string' ? service.price : `${service.price}₾`)
          : undefined, 
        image: typeof service.images?.[0] === 'string'
          ? { uri: service.images[0] }
          : require('../../assets/images/car-bg.png'),
        images: service.images && Array.isArray(service.images) && service.images.length > 0
          ? service.images.map((img: any) => typeof img === 'string' ? img : (img?.uri || img))
          : undefined,
        category: service.category || service.type, 
        address: service.location, 
        phone: service.phone || 'N/A',
        services: [], 
        isOpen: service.isOpen !== undefined ? service.isOpen : true, 
        waitTime: 0, 
        socialMedia: {}, 
        reviews: service.reviews || Math.floor(Math.random() * 50) + 10, 
        type: service.type,
        description: service.description,
      }));
      
      setPopularServices(formattedServices);
    } catch (error) {
      console.error('❌ Error fetching services:', error);
      setPopularServices([
        {
          id: '1',
          name: 'ძმაკაცი მოტორსი',
          location: 'ვაჟა-ფშაველას გამზირი',
          rating: 4.8,
          price: '50₾',
          image: require('../../assets/images/car-bg.png'),
          category: 'ავტოსერვისი',
          type: 'carwash',
        }
      ]);
    } finally {
      setLoading(false);
      if (isRefresh) setRefreshing(false);
    }
  };

  // Fetch rental cars function
  const fetchRentalCars = async (isRefresh = false) => {
    try {
      if (!isRefresh) setRentalCarsLoading(true);
      
      const response = await fetch(`${API_BASE_URL}/car-rental/popular?limit=5`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setRentalCars(data);
    } catch (error) {
      console.error('❌ Error fetching rental cars:', error);
      setRentalCars([]);
    } finally {
      setRentalCarsLoading(false);
    }
  };

  const handleSendFeedback = async () => {
    const message = feedbackText.trim();
    if (!message) {
      Alert.alert('შეავსე ტექსტი', 'დაწერე რა პრობლემა ან იდეა გაქვს.');
      return;
    }
    setSendingFeedback(true);
    try {
      const response = await fetch(`${API_BASE_URL}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          userId: user?.id,
          userName: user?.name,
          phone: user?.phone,
          source: 'home_fab',
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        Alert.alert('გაგზავნილია', 'მადლობა ფიდბექისთვის!');
        setFeedbackText('');
        setShowFeedbackModal(false);
      } else {
        Alert.alert('შეცდომა', result.error || 'ვერ გავაგზავნეთ, სცადე ხელახლა.');
      }
    } catch (error) {
      console.error('❌ [FEEDBACK] Error:', error);
      Alert.alert('შეცდომა', 'ვერ გავაგზავნეთ, სცადე ხელახლა.');
    } finally {
      setSendingFeedback(false);
    }
  };

  const onRefresh = React.useCallback(async () => {
    try {
      setRefreshing(true);
      await Promise.all([
        fetchServices(true),
        fetchRentalCars(true),
        refreshStories(),
        (async () => {
          setOffersLoading(true);
          try {
            if (!user?.id) return;
            const res = await fetch(`${API_BASE_URL}/offers?userId=${encodeURIComponent(user.id)}`);
            const json = await res.json().catch(() => ({}));
            const data = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
            setOffers(data);
          } finally { setOffersLoading(false); }
        })(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [fetchServices, refreshStories]);

  

  React.useEffect(() => {
    fetchServices();
    fetchRentalCars();
    // BOG OAuth status check
    bogApi.getOAuthStatus().then(setBogOAuthStatus).catch(() => setBogOAuthStatus(null));
  }, []);

  // Track screen view when home page is focused
  useFocusEffect(
    React.useCallback(() => {
      analyticsService.logScreenViewWithBackend('მთავარი', 'HomeScreen', user?.id);
    }, [user?.id])
  );

  // Test payment handler (1 ლარი)
  const handleTestPayment = async () => {
    if (!user?.id) {
      Alert.alert('შეცდომა', 'გთხოვთ შეხვიდეთ სისტემაში');
      return;
    }

    if (!bogOAuthStatus?.isTokenValid) {
      Alert.alert('შეცდომა', 'BOG გადახდის სერვისი არ არის ხელმისაწვდომი');
      return;
    }

    setIsProcessingTestPayment(true);

    try {
      const orderData = {
        callback_url: `${API_BASE_URL}/bog/callback`,
        external_order_id: `test_payment_${Date.now()}_${user.id}`,
        total_amount: 1.0,
        currency: 'GEL',
        product_id: 'test',
        description: 'ტესტ გადახდა - 1 ლარი',
        success_url: `${API_BASE_URL}/payment/success`,
        fail_url: `${API_BASE_URL}/payment/fail`,
      };

      const result = await bogApi.createOrder(orderData);
      setBogPaymentUrl(result.redirect_url);
      setShowBOGPaymentModal(true);
    } catch (error) {
      Alert.alert('შეცდომა', 'გადახდის ინიციალიზაცია ვერ მოხერხდა');
      console.error('Test payment error:', error);
    } finally {
      setIsProcessingTestPayment(false);
    }
  };

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (!user?.id) return;
        setOffersLoading(true);
        const res = await fetch(`${API_BASE_URL}/offers?userId=${encodeURIComponent(user.id)}`);
        const json = await res.json().catch(() => ({}));
        const data = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
        if (!active) return;
        setOffers(data);
      } finally { setOffersLoading(false); }
    })();
    return () => { active = false; };
  }, [user?.id]);

  React.useEffect(() => {
    let active = true;
    const loadUnread = async () => {
      try {
        if (!user?.id) return;
        const res = await fetch(`${API_BASE_URL}/notifications/user/${user.id}`);
        if (!res.ok) return;
        const json = await res.json();
        if (!active) return;
        const list = Array.isArray(json?.data) ? json.data : [];
        const unread = list.filter((n: any) => n?.status !== 'read').length;
        setUnreadCount(unread);
      } catch {}
    };
    loadUnread();
    const t = setInterval(loadUnread, 30000);
    return () => { active = false; clearInterval(t); };
  }, [user?.id]);

  
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#F8FAFC',
    },
    contentWrapper: {
      flex: 1,
      maxWidth: isTablet ? contentWidth : undefined,
      alignSelf: isTablet ? 'center' : 'stretch',
    },
    header: {
      paddingHorizontal: 20,
      paddingTop: 60,
      paddingBottom: 24,
      backgroundColor: 'transparent',
    },
    profileRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      marginBottom: 24,
    },
    avatarSmall: { 
      width: 52, 
      height: 52, 
      borderRadius: 26,
      backgroundColor: '#6366F1',
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      shadowColor: '#6366F1',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.4,
      shadowRadius: 12,
      elevation: 6,
    },
    userName: { 
      fontSize: 18, 
      fontFamily: 'Outfit', 
      fontWeight: '600',
      color: colors.text,
      marginBottom: 2,
    },
    smallLocation: { 
      fontSize: 13, 
      color: colors.secondary, 
      fontFamily: 'Outfit',
      opacity: 0.8,
    },
    roundIcon: {
      width: 48, 
      height: 48, 
      borderRadius: 24, 
      backgroundColor: '#FFFFFF', 
      borderWidth: 1, 
      borderColor: '#E5E7EB',
      alignItems: 'center' as const, 
      justifyContent: 'center' as const,
      shadowColor: '#000', 
      shadowOffset: { width: 0, height: 4 }, 
      shadowOpacity: 0.12, 
      shadowRadius: 8, 
      elevation: 5,
    },
    paginationContainer: {
      flexDirection: 'row' as const,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      marginTop: 16,
      gap: 8,
    },
    paginationDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#D1D5DB',
    },
    paginationDotActive: {
      backgroundColor: '#6366F1',
      width: 24,
    },
    recommendationCard: {
      backgroundColor: '#FFFFFF',
      borderRadius: 20,
      padding: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 4,
    },
    recommendationHeader: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      marginBottom: 12,
    },
    recommendationTitle: {
      fontSize: 16,
      fontWeight: '600' as const,
      color: '#1E293B',
      marginLeft: 8,
      fontFamily: 'Outfit',
    },
    recommendationText: {
      fontSize: 14,
      color: '#64748B',
      lineHeight: 20,
      marginBottom: 16,
      fontFamily: 'Outfit',
    },
    recommendationButton: {
      backgroundColor: '#6366F1',
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 12,
      gap: 8,
    },
    recommendationButtonText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '500' as const,
      fontFamily: 'Outfit',
    },
    headerTop: {
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      alignItems: 'center' as const,
      marginBottom: 24,
    },
    headerButtons: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 12,
    },
    userInfo: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 12,
    },
    avatarContainer: {
      position: 'relative' as const,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: '#3B82F6',
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      shadowColor: '#3B82F6',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 4,
    },
    onlineIndicator: {
      position: 'absolute' as const,
      right: 0,
      bottom: 0,
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: '#22C55E',
      borderWidth: 2,
      borderColor: '#FFFFFF',
    },
    greeting: {
      fontSize: 15,
      color: colors.secondary,
      marginBottom: 6,
      letterSpacing: -0.2,
    },
    username: {
      fontSize: 26,
      fontWeight: '600' as const,
      color: colors.text,
      letterSpacing: -0.5,
      fontFamily: 'Outfit',
    },
    themeButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    notificationButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: '#F3F4F6',
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    notificationBadge: {
      position: 'absolute' as const,
      top: 8,
      right: 8,
      backgroundColor: '#EF4444',
      borderRadius: 10,
      minWidth: 20,
      height: 20,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      borderWidth: 2,
      borderColor: '#FFFFFF',
    },
    notificationCount: {
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '600' as const,
    },
    searchWrapper: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 12,
      marginBottom: 24,
    },
    searchContainer: {
      flex: 1,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      backgroundColor: colors.surface,
      borderRadius: 16,
      paddingHorizontal: 16,
      height: 54,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    filterButton: {
      width: 54,
      height: 54,
      borderRadius: 16,
      backgroundColor: colors.surface,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    searchIcon: {
      marginRight: 10,
    },
    quickActionsContainer: {
      paddingHorizontal: 2,
      paddingTop: 10,
      paddingBottom: 10,
      gap: 8,
    },
    quickActions: {
      flexDirection: 'row' as const,
      gap: 12,
    },
    quickActionsScroll: {
      paddingHorizontal: 4,
      paddingVertical: 4,
      gap: 12,
    },
    quickActionCard: {
      width: 230,
      borderRadius: 18,
      overflow: 'hidden' as const,
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.12,
      shadowRadius: 14,
      elevation: 5,
      borderWidth: 1,
      borderColor: '#E5E7EB',
      backgroundColor: '#FFFFFF',
      position: 'relative' as const,
    },
    quickActionSurface: {
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 18,
      borderWidth: 0,
      gap: 10,
      minHeight: 128,
    },
    quickActionHeader: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 10,
      position: 'relative' as const,
    },
    quickActionIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.3)',
    },
    quickActionTitle: {
      fontSize: 13,
      fontWeight: '600' as const,
      color: '#0B1220',
      fontFamily: 'Outfit',
      letterSpacing: -0.1,
      lineHeight: 18,
    },
    quickActionSubtitle: {
      fontSize: 12,
      color: '#6B7280',
      fontFamily: 'Outfit',
      marginTop: 2,
      lineHeight: 16,
    },
    quickActionBadge: {
      position: 'absolute' as const,
      top: -6,
      right: -6,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: 'rgba(255,255,255,0.16)',
      borderWidth: 1,
      borderColor: 'rgba(0,0,0,0.15)',
      zIndex: 2,
      color: '#FFFFFF',
    },
    quickActionBadgeText: {
      color: '#FFFFFF',
      fontSize: 11,
      fontFamily: 'Outfit_700Bold',
      letterSpacing: 0.3,
      textTransform: 'uppercase',
    },
    quickActionFooter: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
    },
    quickActionPill: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 12,
    },
    quickActionPillText: {
      color: '#0B1220',
      fontSize: 12,
      fontFamily: 'Outfit',
      fontWeight: '600' as const,
      letterSpacing: 0.2,
    },
    quickActionsIndicatorRow: {
      flexDirection: 'row' as const,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      gap: 6,
      paddingTop: 10,
      paddingBottom: 2,
    },
    quickActionsDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#E5E7EB',
    },
    quickActionsDotActive: {
      width: 16,
      backgroundColor: '#0F172A',
    },
    quickActionTextWrap: {
      flex: 1,
      paddingTop: 6,
      paddingRight: 64,
    },
    categoriesContainer: {
      paddingTop: 24,
      paddingHorizontal: 20,
    },
    sectionTitle: {
      fontSize: 18,
      color: '#1F2937',
      fontFamily: 'Outfit',
      marginBottom: 18,
      fontWeight: '500' as const,
      letterSpacing: -0.5,
    },
    categoriesList: {
      marginHorizontal: 0,
      paddingLeft: H_MARGIN,
      paddingRight: H_MARGIN,
    },
    categoryCard: {
      alignItems: 'center' as const,
      marginRight: H_GAP,
      padding: 16,
      borderRadius: 24,
      width: 110,
      borderWidth: 1,
      gap: 12,
    },
    categoryIcon: {
      width: 56,
      height: 56,
      borderRadius: 20,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    categoryName: {
      fontSize: 13,
      fontFamily: 'Outfit',
      fontWeight: '500' as const,
      textAlign: 'center' as const,
      lineHeight: 18,
    },
    featuredContainer: {
      paddingTop: 32,
      paddingHorizontal: 20,
      paddingBottom: 24,
    },
    featuredGrid: {
      gap: 16,
    },
    serviceCard: {
      height: 220,
      borderRadius: 24,
      overflow: 'hidden' as const,
      marginBottom: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 16,
      elevation: 5,
    },
    serviceImage: {
      width: '100%',
      height: '100%',
    },
    serviceOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.2)',
      justifyContent: 'flex-end' as const,
      padding: 20,
      paddingBottom: 24,
    },
    serviceContent: {
      gap: 12,
    },
    serviceName: {
      fontSize: 22,
      fontWeight: '600' as const,
      color: '#FFFFFF',
      textShadowColor: 'rgba(0, 0, 0, 0.3)',
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 4,
      fontFamily: 'Outfit',
    },
    serviceDetails: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 16,
    },
    locationContainer: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 6,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 20,
    },
    locationText: {
      fontSize: 14,
      fontWeight: '500' as const,
      color: '#FFFFFF',
      textShadowColor: 'rgba(0, 0, 0, 0.2)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
    ratingContainer: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 6,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 20,
    },
    ratingText: {
      fontSize: 12,
      color: '#FFFFFF',
      textShadowColor: 'rgba(0, 0, 0, 0.2)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
      fontFamily: 'Outfit',
    },
    popularContainer: {
      paddingHorizontal: 20,
      paddingBottom: 24,
    },
    rentalContainer: {
      paddingHorizontal: 20,
      paddingBottom: 24,
      marginTop: 8,
    },
    rentalContent: {
      paddingRight: 20,
      gap: H_GAP,
    },
    
    chipsRow: {
      flexDirection: 'row' as const,
      gap: 8,
      marginTop: 12,
    },
    mapBanner: {
      marginTop: 20,
      marginHorizontal: 20,
      backgroundColor: '#0B0B0E',
      borderRadius: 20,
      padding: 18,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 16,
      elevation: 8,
    },
    mapBannerTitle: { color: '#FFFFFF', fontFamily: 'Outfit', fontSize: 14 },
    mapBannerSubtitle: { color: '#E5E7EB', fontFamily: 'Outfit', fontSize: 11, marginTop: 4 },
    sectionHeader: {
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      alignItems: 'center' as const,
      marginBottom: 16,
    },
    sectionAction: {
      fontSize: 13,
      fontFamily: 'Outfit',
    },
    popularContent: {
      paddingRight: H_MARGIN,
      gap: H_GAP,
    },
    popularCard: {
      width: POPULAR_CARD_WIDTH,
      height: 220,
      borderRadius: 24,
      overflow: 'hidden' as const,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 16,
      elevation: 8,
    },
    popularImage: {
      width: '100%',
      height: '100%',
    },
    popularOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      padding: 20,
      justifyContent: 'space-between' as const,
    },
    popularHeader: {
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      alignItems: 'flex-start' as const,
    },
    categoryBadge: {
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    categoryText: {
      fontSize: 11,
      fontFamily: 'Outfit',
      color: '#FFFFFF',
    },
    ratingBadge: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 4,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    popularName: {
      fontSize: 18,
      fontFamily: 'Outfit',
      color: '#FFFFFF',
      textShadowColor: 'rgba(0, 0, 0, 0.3)',
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 4,
      marginBottom: 8,
    },
    popularDetails: {
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      alignItems: 'center' as const,
    },
    locationItem: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 6,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 20,
    },
    priceContainer: {
      backgroundColor: '#22C55E',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
    },
    priceText: {
      fontSize: 12,
      fontFamily: 'Outfit',
      color: '#FFFFFF',
    },
    chatsContainer: {
      paddingTop: 8,
      paddingHorizontal: 20,
      paddingBottom: 24,
      gap: 12,
    },
    chatCard: {
      borderRadius: 18,
      padding: 14,
      borderWidth: 1,
      borderColor: 'rgba(229, 231, 235, 0.35)',
      backgroundColor: 'rgba(17, 24, 39, 0.35)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.18,
      shadowRadius: 16,
      elevation: 6,
    },
    chatRow: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, gap: 12 },
    chatLeft: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, flex: 1 },
    chatAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center' as const, justifyContent: 'center' as const, borderWidth: 1, borderColor: 'rgba(229,231,235,0.25)' },
    chatInitials: { color: '#E5E7EB', fontFamily: 'Outfit', fontSize: 12 },
    chatTitle: { color: '#F3F4F6', fontFamily: 'Outfit', fontSize: 14, fontWeight: '700' as const },
    chatMeta: { color: '#D1D5DB', fontFamily: 'Outfit', fontSize: 11, opacity: 0.8 },
    chatSnippet: { color: '#E5E7EB', fontFamily: 'Outfit', fontSize: 12, marginTop: 4, opacity: 0.9 },
    unreadBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, backgroundColor: '#EF4444', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
    unreadText: { color: '#FFFFFF', fontFamily: 'Outfit', fontSize: 11, fontWeight: '700' as const },
    bannerContainer: {
      paddingHorizontal: 20,
      marginTop: 20,
      marginBottom: 8,
    },
    promoBanner: {
      height: 160,
      borderRadius: 20,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.25,
      shadowRadius: 16,
      elevation: 12,
    },
    bannerBackground: {
      flex: 1,
    },
    bannerImageStyle: {
      borderRadius: 20,
    },
    bannerOverlay: {
      flex: 1,
      padding: 20,
      justifyContent: 'space-between',
    },
    bannerContent: {
      flex: 1,
      justifyContent: 'space-between',
    },
    bannerHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    bannerBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      gap: 6,
    },
    bannerBadgeText: {
      fontSize: 12,
      fontFamily: 'Outfit',
      fontWeight: '600',
      color: '#FFFFFF',
    },
    bannerDiscount: {
      backgroundColor: '#EF4444',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 12,
    },
    discountText: {
      fontSize: 14,
      fontFamily: 'Outfit',
      fontWeight: '700',
      color: '#FFFFFF',
    },
    bannerMain: {
      flex: 1,
      justifyContent: 'center',
      marginVertical: 8,
    },
    bannerTitle: {
      fontSize: 24,
      fontFamily: 'Outfit',
      fontWeight: '700',
      color: '#FFFFFF',
      marginBottom: 6,
      textShadowColor: 'rgba(0, 0, 0, 0.3)',
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 4,
    },
    bannerSubtitle: {
      fontSize: 14,
      fontFamily: 'Outfit',
      color: 'rgba(255, 255, 255, 0.9)',
      lineHeight: 20,
    },
    bannerFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    bannerFeatures: {
      flexDirection: 'row',
      gap: 16,
    },
    featureItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    featureText: {
      fontSize: 12,
      fontFamily: 'Outfit',
      fontWeight: '500',
      color: 'rgba(255, 255, 255, 0.9)',
    },
    bannerButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#10B981',
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 16,
      gap: 6,
      shadowColor: '#10B981',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    },
    bannerButtonText: {
      fontSize: 14,
      fontFamily: 'Outfit',
      fontWeight: '600',
      color: '#FFFFFF',
    },
     
    // Social cards styles
    socialCard: {
      width: 320,
      backgroundColor: '#FFFFFF',
      borderRadius: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 6,
      borderWidth: 1,
      borderColor: '#E5E7EB',
      overflow: 'hidden',
    },
    
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      paddingBottom: 12,
    },
    
    profileSection: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    
    profileAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
    },
    
    profileInfo: {
      gap: 2,
    },
    
    profileName: {
      fontSize: 14,
      fontWeight: '600',
      color: '#111827',
      fontFamily: 'Outfit',
    },
    
    postTime: {
      fontSize: 12,
      color: '#6B7280',
      fontFamily: 'Outfit',
    },
    
    moreButton: {
      padding: 4,
    },
    
    cardContent: {
      paddingHorizontal: 16,
      paddingBottom: 12,
      gap: 12,
    },
    
    postText: {
      fontSize: 14,
      color: '#374151',
      lineHeight: 20,
      fontFamily: 'Outfit',
    },
    
    postImage: {
      width: '100%',
      height: 180,
      borderRadius: 12,
    },
    
    offerBanner: {
      height: 80,
      borderRadius: 12,
      overflow: 'hidden',
    },
    
    offerGradient: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    
    offerText: {
      fontSize: 24,
      fontWeight: '800',
      color: '#FFFFFF',
      fontFamily: 'Outfit',
    },
    
    interactionsBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: '#F3F4F6',
    },
    
    interactionLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    
    interactionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    
    interactionText: {
      fontSize: 13,
      color: '#6B7280',
      fontFamily: 'Outfit',
      fontWeight: '500',
    },
    
    saveButton: {
      padding: 4,
    },
    
    subscriptionBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 20,
      marginTop: 6,
      gap: 6,
      borderWidth: 1.5,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 5,
      position: 'relative',
      overflow: 'hidden',
    },
    subscriptionGradient: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: 20,
    },
    // Modern Subscription CTA
    subscriptionCTA: {
      marginTop: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 14,
      overflow: 'hidden',
      position: 'relative',
      borderWidth: 1,
      borderColor: '#E5E7EB',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 6,
      elevation: 4,
      backgroundColor: '#FFFFFF'
    },
    subscriptionCTABlur: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: 14,
    },
    subscriptionCTAGradient: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: 16,
      opacity: 0.08,
    },
    subscriptionCTAIconWrap: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(59,130,246,0.10)',
      borderWidth: 1,
      borderColor: 'rgba(59,130,246,0.25)'
    },
    subscriptionCTAContent: {
      flex: 1,
    },
    subscriptionCTATitle: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '800',
      fontFamily: 'Outfit',
      letterSpacing: 0.2,
    },
    subscriptionCTASubtitle: {
      display: 'none',
    },
    premiumBadge: {
      backgroundColor: '#F59E0B',
      borderColor: '#D97706',
    },
    basicBadge: {
      backgroundColor: '#3B82F6',
      borderColor: '#2563EB',
    },
    freeBadge: {
      backgroundColor: '#10B981',
      borderColor: '#059669',
    },
    
    subscriptionText: {
      fontSize: 12,
      fontWeight: '700',
      fontFamily: 'Outfit',
      color: '#FFFFFF',
      textShadowColor: 'rgba(0, 0, 0, 0.3)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
    referralBanner: {
      marginHorizontal: 2,
      marginTop: 16,
      marginBottom: 16,
      borderRadius: 16,
      overflow: 'hidden',
      shadowColor: '#8B5CF6',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 6,
    },
    referralBannerGradient: {
      paddingHorizontal: 20,
      paddingVertical: 18,
    },
    referralBannerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    referralBannerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    referralBannerTextContainer: {
      flex: 1,
    },
    referralBannerTitle: {
      fontSize: 16,
      fontFamily: 'NotoSans_700Bold',
      color: '#FFFFFF',
      marginBottom: 4,
      fontWeight: '700',
    },
    referralBannerSubtitle: {
      fontSize: 13,
      fontFamily: 'NotoSans_400Regular',
      color: '#EDE9FE',
    },
  });

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#F8FAFC', '#F1F5F9', '#E2E8F0']}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={[styles.contentWrapper, { marginHorizontal: horizontalMargin }]}>
      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#3B82F6']} // Android
            tintColor="#3B82F6" // iOS
            title="სერვისების განახლება..." // iOS
            titleColor="#6B7280" // iOS
          />
        }
      >
        <AnalyticsTracker screenName={screenName} trackAllInteractions={true} />
        {/* Header (new) */}
        <View style={styles.header}>
        <View style={styles.profileRow}>
          <TouchableOpacity 
            style={{ flexDirection: 'row', alignItems: 'center' }}
            onPress={() => {
              analyticsService.logButtonClick('პროფილი', 'მთავარი', undefined, user?.id);
              router.push('/two');
            }}
            activeOpacity={0.7}
          >
            <View style={styles.avatarSmall}>
              {user?.avatar ? (
                <Image 
                  source={{ uri: user.avatar }} 
                  style={{ width: 52, height: 52, borderRadius: 26 }}
                />
              ) : user?.name ? (
                <Text style={{ fontSize: 18, fontWeight: '600', color: '#FFFFFF' }}>
                  {user.name.charAt(0).toUpperCase()}
                </Text>
              ) : (
                <Ionicons name="person" size={20} color="#FFFFFF" />
              )}
            </View>
            <View style={{ marginLeft: 10 }}>
              <Text style={styles.userName} numberOfLines={1}>
                {greetingText}
              </Text>
              {subscription && (subscription.plan === 'premium' || subscription.plan === 'basic') && (
                <TouchableOpacity
                  onPress={() => {
                    // ჯერ შევამოწმოთ subscription-ის plan-ი და მერე გავხსნათ შესაბამისი modal
                    const currentPlan = subscription?.plan;
                    if (currentPlan === 'premium' ) {
                      setShowPremiumInfoModal(true);
                    } else if (currentPlan === 'basic' ) {
                      // თუ plan არის free ან subscription არ არის, გახსნას SubscriptionModal
                      setShowSubscriptionModal(true);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[
                    styles.subscriptionBadge,
                    subscription.plan === 'premium' && styles.premiumBadge,
                    subscription.plan === 'basic' && styles.basicBadge,
                  ]}>
                    <LinearGradient
                      colors={
                        subscription.plan === 'premium' 
                          ? ['#F59E0B', '#D97706']
                          : ['#3B82F6', '#2563EB']
                      }
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.subscriptionGradient}
                    />
                    <Ionicons 
                      name={subscription.plan === 'premium' ? 'star' : 'shield-checkmark'} 
                      size={14} 
                      color="#FFFFFF" 
                    />
                    <Text style={styles.subscriptionText}>
                      {subscription.plan === 'premium' ? 'პრემიუმ' : 'ძირითადი'}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              {(!subscription || subscription.plan === 'free') && (
                <TouchableOpacity
                  onPress={() => setShowSubscriptionModal(true)}
                  activeOpacity={0.7}
                >
                  <View style={[
                    styles.subscriptionBadge,
                    styles.freeBadge,
                  ]}>
                    <LinearGradient
                      colors={['#10B981', '#059669']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.subscriptionGradient}
                    />
                    <Ionicons 
                      name="checkmark-circle" 
                      size={14} 
                      color="#FFFFFF" 
                    />
                    <Text style={styles.subscriptionText}>უფასო</Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity 
              style={styles.roundIcon}
              onPress={() => {
                analyticsService.logButtonClick('შეტყობინებები', 'მთავარი', undefined, user?.id);
                setNotificationsModalVisible(true);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="notifications-outline" size={18} color={'#111827'} />
              {unreadCount > 0 && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationCount}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Referral Banner */}
        {user?.id && (
          <TouchableOpacity
            onPress={() => router.push('/referral')}
            activeOpacity={0.8}
            style={styles.referralBanner}
          >
            <LinearGradient
              colors={['#8B5CF6', '#7C3AED']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.referralBannerGradient}
            >
              <View style={styles.referralBannerContent}>
                <View style={styles.referralBannerLeft}>
                  <Ionicons name="gift" size={24} color="#FFFFFF" />
                  <View style={styles.referralBannerTextContainer}>
                    <Text style={styles.referralBannerTitle}>ლიდერბორდი</Text>
                    <Text style={styles.referralBannerSubtitle}>მოიგე 200 ლიტრი ბენზინი</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* რადარების ბანერი */}
        <TouchableOpacity
          onPress={() => {
            analyticsService.logButtonClick('რადარები', 'მთავარი', undefined, user?.id);
            router.push('/radars');
          }}
          activeOpacity={0.8}
          style={styles.referralBanner}
        >
          <LinearGradient
            colors={['#EF4444', '#DC2626']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.referralBannerGradient}
          >
            <View style={styles.referralBannerContent}>
              <View style={styles.referralBannerLeft}>
                <Ionicons name="camera" size={24} color="#FFFFFF" />
                <View style={styles.referralBannerTextContainer}>
                  <Text style={styles.referralBannerTitle}>რადარი</Text>
                  <Text style={styles.referralBannerSubtitle}>იხილე რადარები და ჯარიმების ინფორმაცია</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* ინოვაციური Stories სექცია */}
        <View style={{ 
          
        }}>
          
          {/* მარტივი Stories */}
          <StoriesRow 
            stories={stories} 
            onOpen={(idx) => { 
              analyticsService.logButtonClick('Stories ნახვა', 'მთავარი', { storyIndex: idx }, user?.id);
              setOpenStoryIndex(idx); 
              setOverlayVisible(true); 
            }} 
          />
        </View>

        {/* Credo Bank Financing Banner */}
        <CredoBankBannerTracker 
          onView={() => analyticsService.logCredoBankBannerView(user?.id)}
        />
        <View style={{ paddingHorizontal: 2, marginBottom: 16, marginTop: 16 }}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => {
              analyticsService.logCredoBankBannerClick(user?.id, 'click');
              analyticsService.logButtonClick('განვადება Credo Bank', 'მთავარი', undefined, user?.id);
              if (!isPremiumUser) {
                setShowSubscriptionModal(true);
              } else {
                router.push('/financing-info');
              }
            }}
            style={{ borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.22, shadowRadius: 18, elevation: 10 }}
          >
            <LinearGradient colors={["#1E293B", "#0F172A"]} style={{ paddingHorizontal: 16, paddingVertical: 24, minHeight: 160, justifyContent: 'center' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  
                  <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '800', letterSpacing: -0.2, marginBottom: 8 }}>0%-იანი განვადება ყველაფერზე</Text>
                  <Text style={{ color: '#CBD5E1', fontSize: 13 }}>გჭირდება ფული ნაწილისთვის ? შეავსე ფორმა და იყიდე ნებისმიერი ნივთი</Text>
                </View>
                <View style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', padding: 12, borderRadius: 12 }}>
                  <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>
        <View style={{ marginTop: 24, marginBottom: 16 }}>
        <TouchableOpacity
          style={{
            width: '100%',
            height: 100,
            borderRadius: 20,
            overflow: 'hidden',
            backgroundColor: '#FFFFFF',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.12,
            shadowRadius: 16,
            elevation: 8,
            borderWidth: 1,
            borderColor: '#E5E7EB',
          }}
          activeOpacity={0.9}
          onPress={() => {
            // შევამოწმოთ subscription - მხოლოდ premium იუზერებს აქვთ წვდომა
            if (!subscription || subscription.plan !== 'premium' || !isPremiumUser) {
              analyticsService.logButtonClick('CarFAX (Premium)', 'მთავარი', { requiresPremium: true }, user?.id);
              setShowSubscriptionModal(true);
            } else {
              analyticsService.logButtonClick('CarFAX', 'მთავარი', undefined, user?.id);
              router.push('/carfax' as any);
            }
          }}
        >
          <View style={{
            flex: 1,
            paddingHorizontal: 24,
            paddingVertical: 20,
            backgroundColor: '#FFFFFF',
            position: 'relative',
          }}>
            {/* Decorative background pattern */}
            <View style={{
              position: 'absolute',
              right: -20,
              top: -20,
              width: 120,
              height: 120,
              borderRadius: 60,
              backgroundColor: '#F3F4F6',
              opacity: 0.5,
            }} />
            <View style={{
              position: 'absolute',
              right: 40,
              bottom: -30,
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: '#F9FAFB',
              opacity: 0.6,
            }} />
            
            <View style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              zIndex: 1,
            }}>
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                flex: 1,
                gap: 16,
              }}>
                <View style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  backgroundColor: '#111827',
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#111827',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.2,
                  shadowRadius: 8,
                  elevation: 4,
                }}>
                  <Ionicons name={carfaxCard.icon as any} size={28} color="#FFFFFF" />
                </View>
                <View style={{
                  flex: 1,
                  gap: 6,
                }}>
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                  }}>
                    <Text style={{
                      fontSize: 18,
                      fontWeight: '800',
                      color: '#111827',
                      fontFamily: 'Outfit',
                      letterSpacing: -0.5,
                    }}>{carfaxCard.title}</Text>
                    <View style={{
                      backgroundColor: '#111827',
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 6,
                    }}>
                      <Text style={{
                        fontSize: 10,
                        fontWeight: '700',
                        color: '#FFFFFF',
                        fontFamily: 'Outfit',
                        letterSpacing: 0.5,
                      }}>{carfaxCard.tag}</Text>
                    </View>
                  </View>
                  <Text style={{
                    fontSize: 13,
                    color: '#6B7280',
                    fontFamily: 'Outfit',
                    lineHeight: 18,
                    fontWeight: '500',
                  }}>{carfaxCard.subtitle}</Text>
                </View>
              </View>
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
              }}>
                <View style={{
                  backgroundColor: '#F3F4F6',
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: '#E5E7EB',
                }}>
                  <Text style={{
                    fontSize: 11,
                    fontWeight: '700',
                    color: '#111827',
                    fontFamily: 'Outfit',
                    letterSpacing: 0.3,
                  }}>{carfaxCard.pill}</Text>
                </View>
                <View style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: '#111827',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
                </View>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </View>

        {/* ახალი სექცია - ჩვენი სერვისები */}
        <View style={styles.quickActionsContainer}>
          <Text style={styles.sectionTitle}>კატეგორიები</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickActionsScroll}
            snapToAlignment="start"
            decelerationRate="fast"
            onScroll={(e) => {
              const cardFull = 230 + 12; 
              const idx = Math.round(e.nativeEvent.contentOffset.x / cardFull);
              setQuickActionsIndex(Math.min(Math.max(idx, 0), quickActionsList.length - 1));
            }}
            scrollEventThrottle={16}
          >
            <View style={styles.quickActions}>
              {quickActionsList.map((action) => (
                <TouchableOpacity
                  key={action.key}
                  style={styles.quickActionCard}
                  activeOpacity={0.9}
                  onPress={() => {
                    // Track category click from home
                    analyticsService.logButtonClick(action.title, 'მთავარი', {
                      category_key: action.key,
                      category_route: action.route,
                    }, user?.id);
                    analyticsApi.trackEvent(
                      'home_category_click',
                      `მთავარი - კატეგორია: ${action.title}`,
                      user?.id,
                      'მთავარი',
                      {
                        category_key: action.key,
                        category_title: action.title,
                        category_route: action.route,
                      }
                    ).catch(() => {});
                    router.push(action.route);
                  }}
                >
                  <LinearGradient
                    colors={action.colors as [string, string]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.quickActionSurface}
                  >
                    <View style={styles.quickActionHeader}>
                      <View style={[styles.quickActionIconWrap, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
                        <Ionicons name={action.icon as any} size={18} color="#FFFFFF" />
                      </View>
                      <View style={styles.quickActionTextWrap}>
                        <Text style={[styles.quickActionTitle, { color: '#FFFFFF', lineHeight: 18 }]} numberOfLines={1} ellipsizeMode="tail">
                          {action.title}
                        </Text>
                        <Text style={[styles.quickActionSubtitle, { color: '#E5E7EB', lineHeight: 16 }]} numberOfLines={2} ellipsizeMode="tail">
                          {action.subtitle}
                        </Text>
                      </View>
                      <View style={styles.quickActionBadge}>
                        <Text style={styles.quickActionBadgeText}>{action.tag}</Text>
                      </View>
                    </View>

                    <View style={styles.quickActionFooter}>
                      <View style={[
                        styles.quickActionPill,
                        { backgroundColor: 'rgba(255,255,255,0.16)', borderColor: 'rgba(255,255,255,0.28)', borderWidth: 1 }
                      ]}>
                        <Text style={[styles.quickActionPillText, { color: '#FFFFFF' }]}>{action.pill}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.86)" />
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          <View style={styles.quickActionsIndicatorRow}>
            {quickActionsList.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.quickActionsDot,
                  i === quickActionsIndex && styles.quickActionsDotActive
                ]}
              />
            ))}
          </View>
        </View>

        {/* Test Payment Button - 1 ლარი */}
        
      </View>



        <ReminderSection />
        
      {/* CarFAX Card - გრძელი პატარა ქარდი */}
     
        
      {/* 🚗 Car Rental Section */}
      <View style={styles.rentalContainer}>
        <View style={styles.sectionHeader}>
          <View style={{ display: 'flex',  alignItems: 'center', justifyContent: 'center', }}>
            <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
              <Text style={{ fontSize: 18, fontWeight: '500', color: '#111827', fontFamily: 'Outfit' }}>მანქანების გაქირავება</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => {
            analyticsService.logButtonClick('ყველა მანქანის ქირავნობა', 'მთავარი', undefined, user?.id);
            router.push('/car-rental-list' as any);
          }}>
            <Text style={styles.sectionAction}>ყველა</Text>
          </TouchableOpacity>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToAlignment="start"
          snapToInterval={RENTAL_CARD_WIDTH + H_GAP}
          decelerationRate="fast"
          contentOffset={{ x: 0, y: 0 }}
          contentContainerStyle={styles.rentalContent}
        >
          {rentalCarsLoading ? (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <Text style={{ color: colors.secondary, fontFamily: 'Outfit' }}>მანქანების ჩატვირთვა...</Text>
            </View>
          ) : (
            rentalCars.map((car) => (
              <CarRentalCard
                key={car.id || car._id}
                id={car.id || car._id}
                brand={car.brand}
                model={car.model}
                year={car.year}
                category={car.category}
                pricePerDay={car.pricePerDay}
                pricePerWeek={car.pricePerWeek}
                image={car.images?.[0] || car.image}
                transmission={car.transmission}
                fuelType={car.fuelType}
                seats={car.seats}
                rating={car.rating || 0}
                reviews={car.reviews || 0}
                location={car.location}
                available={car.available}
                features={car.features}
                onPress={() => {
                  analyticsService.logButtonClick('მანქანის ქირავნობა', 'მთავარი', { carId: car.id || car._id }, user?.id);
                  router.push(`/car-rental/${car.id || car._id}` as any);
                }}
              />
            ))
          )}
        </ScrollView>
      </View>

      {/* Quick filter chips moved to Carwash screen */}
      <View style={styles.popularContainer}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>პოპულარული სერვისები</Text>
          <TouchableOpacity onPress={() => {
            analyticsService.logButtonClick('ყველა სერვისი', 'მთავარი', undefined, user?.id);
            router.push('/all-services');
          }}>
            <Text style={styles.sectionAction}>ყველა</Text>
          </TouchableOpacity>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToAlignment="start"
          snapToInterval={POPULAR_CARD_WIDTH + H_GAP}
          decelerationRate="fast"
          contentOffset={{ x: 0, y: 0 }}
          contentContainerStyle={styles.popularContent}
        >
          {loading ? (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <Text style={{ color: colors.secondary, fontFamily: 'Outfit' }}>სერვისების ჩატვირთვა...</Text>
            </View>
          ) : (
            popularServices.map((service) => (
              <ServiceCard
                key={service.id}
                image={service.image}
                title={service.name}
                category={service.category}
                rating={service.rating}
                location={service.location}
                price={service.price}
                type={service.type} // ახალი ველი - სერვისის ტიპი
                onPress={() => {
                  setSelectedService(service);
                  setShowServiceModal(true);
                }}
              />
            ))
          )}
        </ScrollView>
      </View>


      <CommunitySection />


        <View style={{ height: 40 }} />
      </ScrollView>
      </View>

      {/* Story Overlay */}
      <StoryOverlay
        visible={overlayVisible && openStoryIndex !== null}
        stories={stories}
        initialIndex={openStoryIndex ?? 0}
        viewerUserId={user?.id}
        onClose={() => { 
          setOverlayVisible(false); 
          setOpenStoryIndex(null);
          refreshStories();
        }}
      />

      <NotificationsModal
        visible={notificationsModalVisible}
        onClose={() => setNotificationsModalVisible(false)}
      />

      {/* Subscription Modal */}
      <SubscriptionModal
        visible={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
        onSuccess={() => {
          setShowSubscriptionModal(false);
        }}
      />

      {/* Premium Info Modal - opens when shouldOpenPremiumModal is true AND user is on premium/basic plan, OR when badge is clicked */}
      {/* თუ plan არის free, PremiumInfoModal-ის ნაცვლად გაიხსნება SubscriptionModal */}
      <PremiumInfoModal
        visible={
          Boolean(
            (shouldOpenPremiumModal && (subscription?.plan === 'premium' || subscription?.plan === 'basic')) ||
            (showPremiumInfoModal && subscription && (subscription.plan === 'premium' || subscription.plan === 'basic'))
          )
        }
        onClose={() => {
          clearPremiumModalFlag();
          setShowPremiumInfoModal(false);
        }}
      />

      {/* Service Detail Modal */}
      <Modal
        visible={showServiceModal}
        animationType="slide"
        presentationStyle="overFullScreen"
        onRequestClose={() => setShowServiceModal(false)}
      >
        {selectedService && (() => {
          const imgParam = typeof selectedService.image === 'string'
            ? selectedService.image
            : (selectedService.image && (selectedService.image as any).uri)
              ? (selectedService.image as any).uri : '';
          
          const serviceType = selectedService.type || 'carwash';
          const phone = selectedService.phone || undefined;
          const address = selectedService.address || selectedService.location || '';
          const basePrice = selectedService.price || undefined;
          
          // Dynamic features based on service type
          const getFeatures = () => {
            const baseFeatures = [
              { icon: 'checkmark-circle', label: 'ხარისხიანი სერვისი' },
              { icon: 'time', label: 'სწრაფი მომსახურება' },
            ];
            
            if (serviceType === 'carwash') {
              return [
                { icon: 'wifi', label: 'WiFi' },
                { icon: 'card', label: 'ბარათით გადახდა' },
                ...baseFeatures,
              ];
            } else if (serviceType === 'store' || serviceType === 'dismantler') {
              return [
                { icon: 'cash', label: 'ნაღდი ანგარიშსწორება' },
                { icon: 'car', label: 'ადგილზე მიტანა' },
                ...baseFeatures,
              ];
            } else if (serviceType === 'mechanic') {
              return [
                { icon: 'hammer', label: 'გამოცდილი ხელოსნები' },
                { icon: 'shield-checkmark', label: 'გარანტია' },
                ...baseFeatures,
              ];
            }
            
            return baseFeatures;
          };

          // Prepare images array
          const serviceImages = selectedService.images && Array.isArray(selectedService.images) && selectedService.images.length > 0
            ? selectedService.images.map((img: any) => typeof img === 'string' ? img : (img?.uri || img))
            : imgParam ? [imgParam] : [];

          const detailViewProps: DetailViewProps = {
            id: selectedService.id,
            title: selectedService.name,
            coverImage: imgParam,
            images: serviceImages.length > 0 ? serviceImages : undefined,
            serviceType: serviceType,
            rating: {
              value: selectedService.rating || 4.9,
              count: selectedService.reviews || 0,
            },
            distance: selectedService.distance || undefined,
            eta: selectedService.waitTime ? `${selectedService.waitTime} წთ` : undefined,
            price: basePrice ? { from: basePrice } : undefined,
            vendor: {
              phone: phone || undefined,
              location: { address: address },
            },
            sections: {
              description: selectedService.description || '',
              features: getFeatures(),
            },
            actions: {
              onBook: serviceType === 'carwash' ? () => {
                const loc = {
                  id: selectedService.id,
                  name: selectedService.name,
                  address: address,
                  image: imgParam,
                  category: selectedService.category || serviceType,
                  isOpen: Boolean(selectedService.isOpen),
                  rating: selectedService.rating || 0,
                  reviews: selectedService.reviews || 0,
                  distance: selectedService.distance || '',
                };
                const ds = selectedService.detailedServices || [];
                const tsc = selectedService.timeSlotsConfig || null;

                setShowServiceModal(false);
                router.push({
                  pathname: '/booking',
                  params: {
                    location: JSON.stringify(loc),
                    locationDetailedServices: JSON.stringify(ds),
                    locationTimeSlotsConfig: JSON.stringify(tsc),
                  },
                });
              } : undefined,
              onCall: phone ? () => Linking.openURL(`tel:${phone}`) : undefined,
              onFinance: (amount) => {
                const fallback = basePrice ? parseInt(String(basePrice).replace(/[^0-9]/g, '')) : 0;
                const a = amount || fallback || 0;
                setShowServiceModal(false);
                router.push(`/financing-request?requestId=${encodeURIComponent(selectedService.id)}&amount=${encodeURIComponent(String(a))}`);
              },
              onShare: () => {},
            },
            flags: {
              stickyCTA: true,
              showFinance: serviceType === 'carwash' || serviceType === 'store',
            },
          };

          return (
            <DetailView 
              {...detailViewProps} 
              onClose={() => setShowServiceModal(false)}
      />
          );
        })()}
      </Modal>

      {/* BOG Payment Modal */}
      <BOGPaymentModal
        visible={showBOGPaymentModal}
        paymentUrl={bogPaymentUrl}
        onClose={() => {
          setShowBOGPaymentModal(false);
          setBogPaymentUrl('');
        }}
        onSuccess={() => {
          Alert.alert('წარმატება', 'გადახდა წარმატებით განხორციელდა!');
          setShowBOGPaymentModal(false);
          setBogPaymentUrl('');
        }}
        onError={(error) => {
          Alert.alert('შეცდომა', error || 'გადახდა ვერ მოხერხდა');
          setShowBOGPaymentModal(false);
          setBogPaymentUrl('');
        }}
      />

      {/* Floating feedback button */}
      <TouchableOpacity
        style={[feedbackStyles.fab, { bottom: fabBottom }]}
        activeOpacity={0.85}
        onPress={() => setShowFeedbackModal(true)}
      >
        <Ionicons name="chatbubble-ellipses" size={22} color="#FFFFFF" />
        <Text style={feedbackStyles.fabText}>მოგვწერე</Text>
      </TouchableOpacity>

      {/* Feedback Modal */}
      <Modal
        visible={showFeedbackModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFeedbackModal(false)}
      >
        <View style={feedbackStyles.modalOverlay}>
          <View style={[feedbackStyles.modalCard, { backgroundColor: colors.card || '#FFFFFF' }]}>
            <View style={feedbackStyles.modalHeader}>
              <Text style={[feedbackStyles.modalTitle, { color: colors.text }]}>მოგვწერე იდეა ან პრობლემა</Text>
              <TouchableOpacity onPress={() => setShowFeedbackModal(false)} style={feedbackStyles.closeButton}>
                <Ionicons name="close" size={20} color={colors.secondary} />
              </TouchableOpacity>
            </View>
            <Text style={[feedbackStyles.modalSubtitle, { color: colors.secondary }]}>
              მოგვწერე რა მოგეწონა ან რა უნდა გამოვასწოროთ. შენი სახელი: {user?.name || 'სტუმარი'}
            </Text>
            <TextInput
              style={[
                feedbackStyles.textArea,
                { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface },
              ]}
              placeholder="აღწერე პრობლემა ან გააზიარე იდეა..."
              placeholderTextColor={colors.placeholder}
              value={feedbackText}
              onChangeText={setFeedbackText}
              multiline
              numberOfLines={4}
            />
            <View style={feedbackStyles.modalActions}>
              <TouchableOpacity
                style={[feedbackStyles.secondaryBtn, { borderColor: colors.border }]}
                onPress={() => {
                  setFeedbackText('');
                  setShowFeedbackModal(false);
                }}
                disabled={sendingFeedback}
              >
                <Text style={[feedbackStyles.secondaryText, { color: colors.secondary }]}>დახურვა</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[feedbackStyles.primaryBtn, sendingFeedback && { opacity: 0.7 }]}
                onPress={handleSendFeedback}
                disabled={sendingFeedback}
                activeOpacity={0.85}
              >
                <Text style={feedbackStyles.primaryText}>{sendingFeedback ? 'იგზავნება...' : 'გაგზავნა'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const feedbackStyles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 18,
    bottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#111827',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 50,
  },
  fabText: {
    color: '#FFFFFF',
    fontFamily: 'Outfit',
    fontWeight: '700',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    borderRadius: 18,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Outfit',
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: 13,
    fontFamily: 'Outfit',
    marginBottom: 12,
  },
  closeButton: {
    padding: 6,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    minHeight: 120,
    textAlignVertical: 'top',
    fontFamily: 'Outfit',
    fontSize: 14,
    marginBottom: 12,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  secondaryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  secondaryText: {
    fontFamily: 'Outfit',
    fontSize: 14,
    fontWeight: '600',
  },
  primaryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#111827',
  },
  primaryText: {
    color: '#FFFFFF',
    fontFamily: 'Outfit',
    fontSize: 14,
    fontWeight: '700',
  },
});