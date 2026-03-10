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
  FlatList,
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
import { useFines } from '../../contexts/FinesContext';
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
  const { getTotalFinesCount } = useFines();
  const finesCount = getTotalFinesCount();
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
  const [feedbackCategory, setFeedbackCategory] = useState<'problem' | 'idea' | 'question' | 'other'>('problem');
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
  // quickActionsIndex removed — categories are now vertical list
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [selectedService, setSelectedService] = useState<any | null>(null);
  
  // Car Rental state
  const [rentalCars, setRentalCars] = useState<any[]>([]);
  const [rentalCarsLoading, setRentalCarsLoading] = useState(true);

  const quickActionsList = [
    {
      key: 'carfax',
      title: 'კარფაქსი',
      subtitle: 'ავტომობილის ისტორიის შემოწმება',
      icon: 'document-text-outline',
      colors: ['#111827', '#1F2937'],
      route: '/carfax' as any,
    },
    {
      key: 'fines',
      title: 'ჯარიმები',
      subtitle: 'შსს და მერიის ჯარიმების შემოწმება',
      icon: 'alert-circle-outline',
      colors: ['#EF4444', '#DC2626'],
      route: '/garage/fines' as any,
    },
    {
      key: 'radars',
      title: 'რადარი',
      subtitle: 'რადარების რუკა და გაფრთხილებები',
      icon: 'camera-outline',
      colors: ['#8B5CF6', '#7C3AED'],
      route: '/radars' as any,
    },
    {
      key: 'services',
      title: 'სერვისები',
      subtitle: 'ავტოსერვისები და მოვლა',
      icon: 'settings-outline',
      colors: ['#F59E0B', '#D97706'],
      route: '/services-new' as any,
    },
    {
      key: 'fuel',
      title: 'საწვავი',
      subtitle: 'ფასების შედარება და რეკომენდაციები',
      icon: 'flame-outline',
      colors: ['#10B981', '#059669'],
      route: '/fuel-stations' as any,
    },
    {
      key: 'leaderboard',
      title: 'ლიდერბორდი',
      subtitle: 'რეფერალების რეიტინგი და ჯილდოები',
      icon: 'trophy-outline',
      colors: ['#3B82F6', '#1D4ED8'],
      route: '/referral' as any,
    },
    {
      key: 'parts',
      title: 'ნაწილები',
      subtitle: 'ავტონაწილების მოძიება და შეძენა',
      icon: 'construct-outline',
      colors: ['#EC4899', '#DB2777'],
      route: '/parts-new' as any,
    },
    {
      key: 'stores',
      title: 'მაღაზიები',
      subtitle: 'მაღაზიები და სერვისები',
      icon: 'storefront-outline',
      colors: ['#0EA5E9', '#0284C7'],
      route: '/stores-new' as any,
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

  const feedbackCategories = [
    { key: 'problem' as const, label: 'პრობლემა', icon: 'bug-outline' as const, color: '#EF4444' },
    { key: 'idea' as const, label: 'იდეა', icon: 'bulb-outline' as const, color: '#F59E0B' },
    { key: 'question' as const, label: 'შეკითხვა', icon: 'help-circle-outline' as const, color: '#3B82F6' },
    { key: 'other' as const, label: 'სხვა', icon: 'chatbubble-outline' as const, color: '#8B5CF6' },
  ];

  const handleSendFeedback = async () => {
    const message = feedbackText.trim();
    if (!message) {
      Alert.alert('შეავსე ტექსტი', 'დაწერე რა პრობლემა ან იდეა გაქვს.');
      return;
    }
    setSendingFeedback(true);
    try {
      const categoryLabel = feedbackCategories.find(c => c.key === feedbackCategory)?.label || 'სხვა';
      const response = await fetch(`${API_BASE_URL}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `[${categoryLabel}] ${message}`,
          userId: user?.id,
          userName: user?.name,
          phone: user?.phone,
          source: 'home_fab',
          category: feedbackCategory,
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        Alert.alert('გაგზავნილია ✅', 'მადლობა! ჩვენი გუნდი განიხილავს შენს შეტყობინებას.');
        setFeedbackText('');
        setFeedbackCategory('problem');
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
      fontFamily: 'HelveticaMedium',
      textTransform: 'uppercase', 
      fontWeight: '600',
      color: colors.text,
      marginBottom: 2,
    },
    smallLocation: { 
      fontSize: 13, 
      color: colors.secondary, 
      fontFamily: 'HelveticaMedium',
      textTransform: 'uppercase',
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
      fontFamily: 'HelveticaMedium',
      textTransform: 'uppercase',
    },
    recommendationText: {
      fontSize: 14,
      color: '#64748B',
      lineHeight: 20,
      marginBottom: 16,
      fontFamily: 'HelveticaMedium',
      textTransform: 'uppercase',
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
      fontFamily: 'HelveticaMedium',
      textTransform: 'uppercase',
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
      fontFamily: 'HelveticaMedium',
      textTransform: 'uppercase',
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
    categoriesSection: {
      paddingTop: 20,
      // paddingHorizontal: 16,
    },
    categoriesGrid: {
      flexDirection: 'row' as const,
      flexWrap: 'wrap' as const,
      justifyContent: 'space-between' as const,
      rowGap: 8,
    },
    categoryCard: {
      width: '23.5%' as any,
      alignItems: 'center' as const,
      backgroundColor: '#F3F4F6',
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 2,
    },
    categoryCardInner: {
      position: 'relative' as const,
      marginBottom: 6,
    },
    categoryIconContainer: {
      width: 42,
      height: 42,
      borderRadius: 12,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    categoryCountBadge: {
      position: 'absolute' as const,
      top: -4,
      right: -8,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: '#EF4444',
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      paddingHorizontal: 4,
    },
    categoryCountBadgeText: {
      fontSize: 10,
      fontFamily: 'HelveticaMedium',
      fontWeight: '700' as const,
      color: '#FFFFFF',
    },
    categoryTitle: {
      fontSize: 10,
      fontFamily: 'HelveticaMedium',
      textTransform: 'uppercase' as const,
      fontWeight: '600' as const,
      color: '#111827',
      textAlign: 'center' as const,
      letterSpacing: -0.2,
    },
    sectionTitle: {
      fontSize: 18,
      color: '#111827',
      fontFamily: 'HelveticaMedium',
      textTransform: 'uppercase',
      marginBottom: 14,
      fontWeight: '700' as const,
      letterSpacing: -0.5,
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
      fontFamily: 'HelveticaMedium',
      textTransform: 'uppercase',
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
      fontFamily: 'HelveticaMedium',
      textTransform: 'uppercase',
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
    mapBannerTitle: { color: '#FFFFFF', fontFamily: 'HelveticaMedium', textTransform: 'uppercase', fontSize: 14 },
    mapBannerSubtitle: { color: '#E5E7EB', fontFamily: 'HelveticaMedium', textTransform: 'uppercase', fontSize: 11, marginTop: 4 },
    sectionHeader: {
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      alignItems: 'center' as const,
      marginBottom: 16,
    },
    sectionAction: {
      fontSize: 13,
      fontFamily: 'HelveticaMedium',
      textTransform: 'uppercase',
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
      fontFamily: 'HelveticaMedium',
      textTransform: 'uppercase',
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
      fontFamily: 'HelveticaMedium',
      textTransform: 'uppercase',
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
      fontFamily: 'HelveticaMedium',
      textTransform: 'uppercase',
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
    chatInitials: { color: '#E5E7EB', fontFamily: 'HelveticaMedium', textTransform: 'uppercase',
 fontSize: 12 },
    chatTitle: { color: '#F3F4F6', fontFamily: 'HelveticaMedium', textTransform: 'uppercase',
 fontSize: 14, fontWeight: '700' as const },
    chatMeta: { color: '#D1D5DB', fontFamily: 'HelveticaMedium', textTransform: 'uppercase',
 fontSize: 11, opacity: 0.8 },
    chatSnippet: { color: '#E5E7EB', fontFamily: 'HelveticaMedium', textTransform: 'uppercase',
 fontSize: 12, marginTop: 4, opacity: 0.9 },
    unreadBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, backgroundColor: '#EF4444', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
    unreadText: { color: '#FFFFFF', fontFamily: 'HelveticaMedium', textTransform: 'uppercase',
 fontSize: 11, fontWeight: '700' as const },
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
      fontFamily: 'HelveticaMedium',
      textTransform: 'uppercase',
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
      fontFamily: 'HelveticaMedium',
      textTransform: 'uppercase',
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
      fontFamily: 'HelveticaMedium',
      textTransform: 'uppercase',
      fontWeight: '700',
      color: '#FFFFFF',
      marginBottom: 6,
      textShadowColor: 'rgba(0, 0, 0, 0.3)',
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 4,
    },
    bannerSubtitle: {
      fontSize: 14,
      fontFamily: 'HelveticaMedium',
      textTransform: 'uppercase',
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
      fontFamily: 'HelveticaMedium',
      textTransform: 'uppercase',
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
      fontFamily: 'HelveticaMedium',
      textTransform: 'uppercase',
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
      fontFamily: 'HelveticaMedium',
      textTransform: 'uppercase',
    },
    
    postTime: {
      fontSize: 12,
      color: '#6B7280',
      fontFamily: 'HelveticaMedium',
      textTransform: 'uppercase',
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
      fontFamily: 'HelveticaMedium',
      textTransform: 'uppercase',
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
      fontFamily: 'HelveticaMedium',
      textTransform: 'uppercase',
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
      fontFamily: 'HelveticaMedium',
      textTransform: 'uppercase',
      fontWeight: '500',
    },
    
    saveButton: {
      padding: 4,
    },
    
    subscriptionBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
      marginTop: 6,
      gap: 5,
      backgroundColor: '#F3F4F6',
      borderWidth: 1,
      borderColor: '#E5E7EB',
      borderLeftWidth: 3,
      borderLeftColor: '#9CA3AF',
    },
    subscriptionBadgePremium: {
      borderLeftColor: '#D97706',
    },
    subscriptionBadgeBasic: {
      borderLeftColor: '#2563EB',
    },
    subscriptionBadgeFree: {
      borderLeftColor: '#059669',
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
      fontFamily: 'HelveticaMedium',
      textTransform: 'uppercase',
      letterSpacing: 0.2,
    },
    subscriptionCTASubtitle: {
      display: 'none',
    },
    subscriptionText: {
      fontSize: 11,
      fontFamily: 'HelveticaMedium',
      textTransform: 'uppercase',
      color: '#111827',
      fontWeight: '600',
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
      fontFamily: 'HelveticaMedium',
      textTransform: 'uppercase',
      color: '#FFFFFF',
      marginBottom: 4,
      fontWeight: '700',
    },
    referralBannerSubtitle: {
      fontSize: 13,
      fontFamily: 'HelveticaMedium',
      textTransform: 'uppercase',
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
                    subscription.plan === 'premium' && styles.subscriptionBadgePremium,
                    subscription.plan === 'basic' && styles.subscriptionBadgeBasic,
                  ]}>
                    <Ionicons
                      name={subscription.plan === 'premium' ? 'star' : 'shield-checkmark'}
                      size={13}
                      color="#6B7280"
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
                  <View style={[styles.subscriptionBadge, styles.subscriptionBadgeFree]}>
                    <Ionicons name="checkmark-circle" size={13} color="#6B7280" />
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
        {/* {user?.id && (
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
        )} */}

        {/* რადარების ბანერი */}
        {/* <TouchableOpacity
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
        </TouchableOpacity> */}

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
                  
                  <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '800', letterSpacing: -0.2, marginBottom: 8, fontFamily: 'HelveticaMedium', textTransform: 'uppercase' }}>0%-იანი განვადება ყველაფერზე</Text>
                  <Text style={{ color: '#CBD5E1', fontSize: 13, fontFamily: 'HelveticaMedium', textTransform: 'uppercase' }}>გჭირდება ფული ნაწილისთვის ? შეავსე ფორმა და იყიდე ნებისმიერი ნივთი</Text>
                </View>
                <View style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', padding: 12, borderRadius: 12 }}>
                  <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>
       

        {/* კატეგორიების სექცია - 4x2 გრიდი */}
        <View style={styles.categoriesSection}>
          <Text style={styles.sectionTitle}>კატეგორიები</Text>
          <View style={styles.categoriesGrid}>
            {quickActionsList.map((action) => (
              <TouchableOpacity
                key={action.key}
                style={styles.categoryCard}
                activeOpacity={0.7}
                onPress={() => {
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
                <View style={styles.categoryCardInner}>
                  <View style={[styles.categoryIconContainer, { backgroundColor: `${action.colors[0]}15` }]}>
                    <Ionicons name={action.icon as any} size={24} color={action.colors[0]} />
                  </View>
                  {action.key === 'fines' && finesCount > 0 && (
                    <View style={styles.categoryCountBadge}>
                      <Text style={styles.categoryCountBadgeText}>{finesCount > 99 ? '99+' : finesCount}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.categoryTitle} numberOfLines={1}>{action.title}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        
      </View>



        <ReminderSection />
        
      {/* CarFAX Card - გრძელი პატარა ქარდი */}
     
        
      {/* 🚗 Car Rental Section */}
      <View style={styles.rentalContainer}>
        <View style={styles.sectionHeader}>
          <View style={{ display: 'flex',  alignItems: 'center', justifyContent: 'center', }}>
            <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
              <Text style={{ fontSize: 18, fontWeight: '500', color: '#111827', fontFamily: 'HelveticaMedium', textTransform: 'uppercase' }}>მანქანების გაქირავება</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => {
            analyticsService.logButtonClick('ყველა მანქანის ქირავნობა', 'მთავარი', undefined, user?.id);
            router.push('/car-rental-list' as any);
          }}>
            <Text style={styles.sectionAction}>ყველა</Text>
          </TouchableOpacity>
        </View>
        {rentalCarsLoading ? (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <Text
              style={{
                color: colors.secondary,
                fontFamily: 'HelveticaMedium',
                textTransform: 'uppercase',
              }}
            >
              მანქანების ჩატვირთვა...
            </Text>
          </View>
        ) : (
          <FlatList 
            horizontal
            data={rentalCars}
            keyExtractor={(car, index) => String(car.id || car._id || `rental-${index}`)}
            renderItem={({ item: car }) => (
              <CarRentalCard
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
                  analyticsService.logButtonClick(
                    'მანქანის ქირავნობა',
                    'მთავარი',
                    { carId: car.id || car._id },
                    user?.id
                  );
                  router.push(`/car-rental/${car.id || car._id}` as any);
                }}
              />
            )}
            showsHorizontalScrollIndicator={false}
            snapToAlignment="start"
            snapToInterval={RENTAL_CARD_WIDTH + H_GAP}
            decelerationRate="fast"
            contentOffset={{ x: 0, y: 0 }}
            contentContainerStyle={styles.rentalContent}
            initialNumToRender={3}
            maxToRenderPerBatch={4}
            windowSize={5}
            removeClippedSubviews
          />
        )}
      </View>

      {/* Quick filter chips moved to Carwash screen */}
      <View style={styles.popularContainer}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>პოპულარული სერვისები</Text>
          <TouchableOpacity onPress={() => {
            analyticsService.logButtonClick('ყველა სერვისი', 'მთავარი', undefined, user?.id);
            router.push('/services-new' as any);
          }}>
            <Text style={styles.sectionAction}>ყველა</Text>
          </TouchableOpacity>
        </View>
        {loading ? (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <Text
              style={{
                color: colors.secondary,
                fontFamily: 'HelveticaMedium',
                textTransform: 'uppercase',
              }}
            >
              სერვისების ჩატვირთვა...
            </Text>
          </View>
        ) : (
          <FlatList
            horizontal
            data={popularServices}
            keyExtractor={(service, index) => String(service.id || `popular-${index}`)}
            renderItem={({ item: service }) => (
              <ServiceCard
                image={service.image}
                title={service.name}
                category={service.category}
                rating={service.rating}
                location={service.location}
                price={service.price}
                type={service.type}
                onPress={() => {
                  setSelectedService(service);
                  setShowServiceModal(true);
                }}
              />
            )}
            showsHorizontalScrollIndicator={false}
            snapToAlignment="start"
            snapToInterval={POPULAR_CARD_WIDTH + H_GAP}
            decelerationRate="fast"
            contentOffset={{ x: 0, y: 0 }}
            contentContainerStyle={styles.popularContent}
            initialNumToRender={3}
            maxToRenderPerBatch={4}
            windowSize={5}
            removeClippedSubviews
          />
        )}
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
        <View style={feedbackStyles.fabIconWrap}>
          <Ionicons name="chatbubble-ellipses" size={20} color="#FFFFFF" />
        </View>
      </TouchableOpacity>

      {/* Feedback Modal */}
      <Modal
        visible={showFeedbackModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFeedbackModal(false)}
      >
        <View style={feedbackStyles.modalOverlay}>
          <View style={feedbackStyles.modalCard}>
            {/* Header */}
            <View style={feedbackStyles.modalHeader}>
              <View style={feedbackStyles.modalHeaderLeft}>
                <View style={feedbackStyles.modalIconCircle}>
                  <Ionicons name="mail-open" size={22} color="#6366F1" />
                </View>
                <View>
                  <Text style={feedbackStyles.modalTitle}>უკუკავშირი</Text>
                  <Text style={feedbackStyles.modalSubtitle}>გააზიარე აზრი ან დააფიქსირე პრობლემა</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setShowFeedbackModal(false)} style={feedbackStyles.closeButton}>
                <Ionicons name="close" size={22} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {/* Category chips */}
            <Text style={feedbackStyles.categoryLabel}>აირჩიე კატეგორია</Text>
            <View style={feedbackStyles.categoryRow}>
              {feedbackCategories.map((cat) => (
                <TouchableOpacity
                  key={cat.key}
                  style={[
                    feedbackStyles.categoryChip,
                    feedbackCategory === cat.key && { backgroundColor: cat.color, borderColor: cat.color },
                  ]}
                  onPress={() => setFeedbackCategory(cat.key)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={cat.icon as any}
                    size={16}
                    color={feedbackCategory === cat.key ? '#FFFFFF' : cat.color}
                  />
                  <Text style={[
                    feedbackStyles.categoryChipText,
                    feedbackCategory === cat.key && { color: '#FFFFFF' },
                  ]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Text input */}
            <TextInput
              style={feedbackStyles.textArea}
              placeholder={
                feedbackCategory === 'problem' ? 'აღწერე რა პრობლემა შეგხვდა...' :
                feedbackCategory === 'idea' ? 'გაგვიზიარე შენი იდეა...' :
                feedbackCategory === 'question' ? 'დასვი შეკითხვა...' :
                'დაწერე შეტყობინება...'
              }
              placeholderTextColor="#9CA3AF"
              value={feedbackText}
              onChangeText={setFeedbackText}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />

            {/* User info hint */}
            <View style={feedbackStyles.userHint}>
              <Ionicons name="person-circle-outline" size={16} color="#9CA3AF" />
              <Text style={feedbackStyles.userHintText}>
                {user?.name || 'სტუმარი'} • {user?.phone || 'ტელეფონი არ არის'}
              </Text>
            </View>

            {/* Actions */}
            <View style={feedbackStyles.modalActions}>
              <TouchableOpacity
                style={feedbackStyles.secondaryBtn}
                onPress={() => {
                  setFeedbackText('');
                  setFeedbackCategory('problem');
                  setShowFeedbackModal(false);
                }}
                disabled={sendingFeedback}
              >
                <Text style={feedbackStyles.secondaryText}>გაუქმება</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  feedbackStyles.primaryBtn,
                  sendingFeedback && { opacity: 0.6 },
                  !feedbackText.trim() && { opacity: 0.4 },
                ]}
                onPress={handleSendFeedback}
                disabled={sendingFeedback || !feedbackText.trim()}
                activeOpacity={0.8}
              >
                {sendingFeedback ? (
                  <Text style={feedbackStyles.primaryText}>იგზავნება...</Text>
                ) : (
                  <>
                    <Ionicons name="send" size={16} color="#FFFFFF" />
                    <Text style={feedbackStyles.primaryText}>გაგზავნა</Text>
                  </>
                )}
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
    zIndex: 50,
  },
  fabIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  modalIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '800',
    color: '#111827',
  },
  modalSubtitle: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    color: '#6B7280',
    marginTop: 2,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryLabel: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#6B7280',
    marginBottom: 10,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  categoryChipText: {
    fontSize: 13,
    fontFamily: 'HelveticaMedium',
    fontWeight: '600',
    color: '#374151',
  },
  textArea: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    padding: 14,
    minHeight: 120,
    textAlignVertical: 'top',
    fontFamily: 'HelveticaMedium',
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#F9FAFB',
    marginBottom: 12,
  },
  userHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
  },
  userHintText: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    color: '#9CA3AF',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  secondaryText: {
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryText: {
    color: '#FFFFFF',
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontSize: 14,
    fontWeight: '700',
  },
});