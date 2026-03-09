import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  Animated,
  Dimensions,
  StatusBar,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { useCars } from '@/contexts/CarContext';
import { useUser } from '@/contexts/UserContext';
import { useToast } from '@/contexts/ToastContext';
import { requestsApi, type Request } from '@/services/requestsApi';
import { aiApi } from '@/services/aiApi';
import AddCarModal from '@/components/garage/AddCarModal';
import { Car } from '@/types/garage';
import { messagesApi, type RecentChat } from '@/services/messagesApi';
import FilterModal from '@/components/ui/FilterModal';
import { carBrandsApi } from '@/services/carBrandsApi';

const YEARS = Array.from({ length: 30 }, (_, i) => (2024 - i).toString());

const { width } = Dimensions.get('window');

interface RequestWithUser extends Request {
  userName?: string;
  userPhone?: string;
  offersCount?: number;
}

export default function SearchRepairmenScreen() {
  const { user } = useUser();
  const { selectedCar, cars, selectCar } = useCars();
  const { success, error } = useToast();
  const insets = useSafeAreaInsets();
  
  const [requests, setRequests] = useState<RequestWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCarPicker, setShowCarPicker] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'my' | 'chats'>('all');
  
  // Filter states
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filterMake, setFilterMake] = useState<string>('');
  const [filterModel, setFilterModel] = useState<string>('');
  const [filterYear, setFilterYear] = useState<string>('');
  const [filterUrgency, setFilterUrgency] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [minBudget, setMinBudget] = useState<number | undefined>(undefined);
  const [maxBudget, setMaxBudget] = useState<number | undefined>(undefined);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [showMakePicker, setShowMakePicker] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  
  // Car brands and models from API
  const [carBrands, setCarBrands] = useState<string[]>([]);
  const [carModels, setCarModels] = useState<{ [key: string]: string[] }>({});
  
  // Seller status
  const [sellerStatus, setSellerStatus] = useState<any>(null);
  const [isSeller, setIsSeller] = useState(false);
  const [storeName, setStoreName] = useState('');
  
  // Offer creation
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [selectedRequestForOffer, setSelectedRequestForOffer] = useState<RequestWithUser | null>(null);
  const [offerPrice, setOfferPrice] = useState('');
  const [isSubmittingOffer, setIsSubmittingOffer] = useState(false);
  
  // Chats/conversations
  type ConversationItem = RecentChat & {
    partnerName?: string;
    requestTitle?: string;
    lastSenderName?: string;
    vehicleInfo?: string;
  };
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [chatsLoading, setChatsLoading] = useState(false);
  const [chatsRefreshing, setChatsRefreshing] = useState(false);
  
  // Create request form state
  const [problemTitle, setProblemTitle] = useState('');
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState('');
  const [urgency, setUrgency] = useState<'low' | 'medium' | 'high'>('medium');
  const [selectedMake, setSelectedMake] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [createRequestAvailableModels, setCreateRequestAvailableModels] = useState<string[]>([]);
  
  const scrollViewRef = useRef<ScrollView>(null);
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(50))[0];

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
    
    loadRequests();
    loadSellerStatus();
    loadCarBrands();
  }, []);

  const loadCarBrands = async () => {
    try {
      const brandsList = await carBrandsApi.getBrandsList();
      const brands = brandsList.map(b => b.name);
      const modelsMap: { [key: string]: string[] } = {};
      brandsList.forEach(brand => {
        modelsMap[brand.name] = brand.models || [];
      });
      setCarBrands(brands);
      setCarModels(modelsMap);
    } catch (err) {
      console.error('Error loading car brands:', err);
    }
  };

  const loadSellerStatus = async () => {
    if (!user?.id) return;
    try {
      // For mechanics, we can use mechanic name or user name
      const derivedName = user?.name?.trim() || 'ხელოსანი';
      setStoreName(derivedName);
      setIsSeller(true); // Assume user can create offers as mechanic
    } catch (e) {
      console.log('[SearchRepairmen] Failed to load seller status:', e);
    }
  };

  // Update available models when make changes (for filters)
  useEffect(() => {
    if (filterMake && carModels[filterMake]) {
      setAvailableModels(carModels[filterMake]);
    } else {
      setAvailableModels([]);
      if (filterModel) {
        setFilterModel('');
      }
    }
  }, [filterMake, carModels]);

  // Update available models when make changes (for create request)
  useEffect(() => {
    if (selectedMake && carModels[selectedMake]) {
      setCreateRequestAvailableModels(carModels[selectedMake]);
    } else {
      setCreateRequestAvailableModels([]);
      if (selectedModel) {
        setSelectedModel('');
      }
    }
  }, [selectedMake, carModels]);

  const handleFilterChange = (filters: { 
    make: string; 
    model: string; 
    year: string;
    urgency?: string;
    status?: string;
    minBudget?: number;
    maxBudget?: number;
  }) => {
    setFilterMake(filters.make);
    setFilterModel(filters.model);
    setFilterYear(filters.year);
    if (filters.urgency !== undefined) setFilterUrgency(filters.urgency);
    if (filters.status !== undefined) setFilterStatus(filters.status);
    if (filters.minBudget !== undefined) setMinBudget(filters.minBudget);
    if (filters.maxBudget !== undefined) setMaxBudget(filters.maxBudget);
  };

  const loadRequests = async () => {
    try {
      setLoading(true);
      const allRequests = await requestsApi.getRequests();
      // Filter only mechanic requests
      const mechanicRequests = allRequests.filter(req => req.service === 'mechanic');
      
      // Enrich with user info and offers count
      const enrichedRequests = await Promise.all(
        mechanicRequests.map(async (req) => {
          try {
            const offers = await requestsApi.getOffers(req.id);
            return {
              ...req,
              offersCount: offers.length || 0,
            };
          } catch {
            return { ...req, offersCount: 0 };
          }
        })
      );
      
      setRequests(enrichedRequests);
    } catch (err) {
      console.error('Error loading requests:', err);
      error('შეცდომა', 'მოთხოვნების ჩატვირთვა ვერ მოხერხდა');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRequests();
    setRefreshing(false);
  };

  // Chats functions
  const fetchConversations = async () => {
    if (!user?.id) return;
    
    setChatsLoading(true);
    try {
      // Fetch recent chats
      const recentChats = await messagesApi.getRecentChats(user.id);
      
      // Enrich with request and offer data
      const enrichedConversations = await Promise.all(
        recentChats.map(async (chat) => {
          try {
            // Get request details
            const request = await requestsApi.getRequestById(chat.requestId);
            
            // Filter only mechanic requests
            if (request?.service !== 'mechanic') {
              return null;
            }
            
            // Get offers to find partner name
            const offers = await requestsApi.getOffers(chat.requestId);
            const partnerOffer = offers.find(o => o.partnerId === chat.partnerId) || offers[0];
            
            // Get last message to determine sender
            const messages = await messagesApi.getChatHistory(chat.requestId);
            const lastMessage = messages[messages.length - 1];
            
            // Determine sender name
            let lastSenderName = '';
            if (lastMessage) {
              if (lastMessage.sender === 'user') {
                // User sent - show user name
                lastSenderName = user?.name || 'თქვენ';
              } else {
                // Partner sent - show partner name
                lastSenderName = partnerOffer?.providerName || 'მაღაზია';
              }
            }
            
            // Vehicle info
            const vehicleInfo = request?.vehicle 
              ? `${request.vehicle.make} ${request.vehicle.model} • ${request.vehicle.year}`
              : '';
            
            return {
              ...chat,
              partnerName: partnerOffer?.providerName || 'მაღაზია',
              requestTitle: request?.partName || 'ნაწილის მოთხოვნა',
              lastSenderName,
              vehicleInfo,
            } as ConversationItem;
          } catch (error) {
            console.error('Error enriching conversation:', error);
            return null;
          }
        })
      );
      
      // Filter out null values (non-mechanic requests)
      const filteredConversations = enrichedConversations.filter(
        (conv): conv is ConversationItem => conv !== null
      );
      
      setConversations(filteredConversations);
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
      setConversations([]);
    } finally {
      setChatsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'chats' && user?.id) {
      fetchConversations();
    }
  }, [activeTab, user?.id]);

  const onChatsRefresh = () => {
    setChatsRefreshing(true);
    fetchConversations();
    setTimeout(() => setChatsRefreshing(false), 1000);
  };

  const formatChatTime = (timestamp?: number) => {
    if (!timestamp) return '';
    
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return 'ახლა';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} წუთი`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} სთ`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)} დღე`;
    
    const date = new Date(timestamp);
    return date.toLocaleDateString('ka-GE', { day: 'numeric', month: 'short' });
  };

  const handleConversationPress = (conversation: ConversationItem) => {
    router.push(`/chat/${conversation.requestId}/${conversation.partnerId}`);
  };

  const getUnreadCount = (conversation: ConversationItem) => {
    // If current user is the request owner, show user unread count
    // Otherwise show partner unread count
    if (conversation.userId === user?.id) {
      return conversation.unreadCounts?.user || 0;
    }
    return conversation.unreadCounts?.partner || 0;
  };

  const formatTimeAgo = (dateInput: number | string): string => {
    const now = new Date();
    const date = new Date(dateInput);
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInMinutes < 1) return 'ახლა';
    if (diffInMinutes < 60) return `${diffInMinutes} წთ წინ`;
    if (diffInHours < 24) return `${diffInHours} სთ წინ`;
    if (diffInDays < 7) return `${diffInDays} დღე წინ`;
    return `${Math.floor(diffInDays / 7)} კვირა წინ`;
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'high':
        return '#EF4444';
      case 'medium':
        return '#F59E0B';
      case 'low':
        return '#10B981';
      default:
        return '#6B7280';
    }
  };

  const getUrgencyText = (urgency: string) => {
    switch (urgency) {
      case 'high':
        return 'სასწრაფო';
      case 'medium':
        return 'ნორმალური';
      case 'low':
        return 'დაბალი';
      default:
        return 'ნორმალური';
    }
  };

  const handleCreateRequest = async () => {
    if (!user?.id) {
      error('შეცდომა', 'გთხოვთ შეხვიდეთ სისტემაში');
      return;
    }

    if (!selectedMake) {
      error('შეცდომა', 'გთხოვთ აირჩიოთ მარკა');
      return;
    }

    if (!selectedModel) {
      error('შეცდომა', 'გთხოვთ აირჩიოთ მოდელი');
      return;
    }

    if (!selectedYear) {
      error('შეცდომა', 'გთხოვთ აირჩიოთ წელი');
      return;
    }

    if (!problemTitle.trim()) {
      error('შეცდომა', 'გთხოვთ შეიყვანოთ პრობლემის სახელი');
      return;
    }

    try {
      setIsCreating(true);
      
      const requestData = {
        userId: user.id,
        vehicle: {
          make: selectedMake,
          model: selectedModel,
          year: selectedYear,
        },
        partName: problemTitle.trim(),
        description: description.trim() || undefined,
        budgetGEL: budget ? parseFloat(budget) : undefined,
        urgency,
        service: 'mechanic' as const,
      };

      const newRequest = await requestsApi.createRequest(requestData);
      
      // Add to list
      setRequests(prev => [newRequest as RequestWithUser, ...prev]);
      
      // Reset form
      setProblemTitle('');
      setDescription('');
      setBudget('');
      setUrgency('medium');
      setSelectedMake('');
      setSelectedModel('');
      setSelectedYear('');
      setShowCreateModal(false);
      
      success('წარმატება!', 'მოთხოვნა გამოქვეყნდა');
    } catch (err) {
      console.error('Error creating request:', err);
      error('შეცდომა', 'მოთხოვნის შექმნა ვერ მოხერხდა');
    } finally {
      setIsCreating(false);
    }
  };

  const handleRequestPress = (request: RequestWithUser) => {
    router.push(`/offers/${request.id}` as any);
  };

  const handleChatPress = (request: RequestWithUser, e: any) => {
    e.stopPropagation();
    router.push(`/offers/${request.id}` as any);
  };

  const handleOfferPress = (request: RequestWithUser, e: any) => {
    e.stopPropagation();
    setSelectedRequestForOffer(request);
    setShowOfferModal(true);
  };

  const handleCreateOffer = async () => {
    if (!selectedRequestForOffer || !offerPrice || !user?.id) {
      error('შეცდომა', 'გთხოვთ შეავსოთ ფასი');
      return;
    }

    try {
      setIsSubmittingOffer(true);
      await requestsApi.createOffer({
        reqId: selectedRequestForOffer.id,
        providerName: storeName || 'მაღაზია',
        priceGEL: parseFloat(offerPrice),
        etaMin: 30,
        partnerId: user.id,
        userId: selectedRequestForOffer.userId,
      });

      success('წარმატება', 'შეთავაზება გაიგზავნა!');
      setShowOfferModal(false);
      setOfferPrice('');
      setSelectedRequestForOffer(null);
      await loadRequests();
    } catch (err) {
      console.error('Error creating offer:', err);
      error('შეცდომა', 'შეთავაზების გაგზავნა ვერ მოხერხდა');
    } finally {
      setIsSubmittingOffer(false);
    }
  };

  // Apply filters
  const filteredRequests = (activeTab === 'my' 
    ? requests.filter(req => req.userId === user?.id)
    : requests
  ).filter(req => {
    if (filterMake && req.vehicle.make !== filterMake) return false;
    if (filterModel && req.vehicle.model !== filterModel) return false;
    if (filterYear && req.vehicle.year !== filterYear) return false;
    if (filterUrgency && req.urgency !== filterUrgency) return false;
    if (filterStatus && req.status !== filterStatus) return false;
    if (minBudget !== undefined && (!req.budgetGEL || req.budgetGEL < minBudget)) return false;
    if (maxBudget !== undefined && (!req.budgetGEL || req.budgetGEL > maxBudget)) return false;
    return true;
  });
  
  const hasActiveFilters = filterMake || filterModel || filterYear || filterUrgency || filterStatus || minBudget !== undefined || maxBudget !== undefined;

  const myRequestsCount = requests.filter(req => req.userId === user?.id).length;

  const renderRequestCard = (request: RequestWithUser) => {
    const isActive = request.status === 'active';
    const urgencyColor = getUrgencyColor(request.urgency);
    const isMyRequest = request.userId === user?.id;
    
    return (
      <Pressable
        key={request.id}
        style={styles.requestCardSimple}
        onPress={isMyRequest ? () => handleRequestPress(request) : undefined}
        disabled={!isMyRequest}
      >
        <View style={styles.cardContentSimple}>
          {/* Top Row - User & Urgency */}
          <View style={styles.cardTopRow}>
            <View style={styles.userInfoSimple}>
              <View style={[styles.avatarSimple, isMyRequest && styles.myRequestAvatarSimple]}>
                <Ionicons name="person" size={16} color={isMyRequest ? "#FFFFFF" : "#6366F1"} />
              </View>
              <View style={styles.userDetailsSimple}>
                <Text style={styles.userNameSimple}>
                  {request.userName || 'მომხმარებელი'}
                </Text>
                <Text style={styles.timeAgoSimple}>
                  {formatTimeAgo(request.createdAt)}
                </Text>
              </View>
              {isMyRequest && (
                <View style={styles.myRequestBadgeSimple}>
                  <Ionicons name="checkmark-circle" size={10} color="#6366F1" />
                  <Text style={styles.myRequestTextSimple}>ჩემი</Text>
                </View>
              )}
            </View>
            <View style={[styles.urgencyBadgeSimple, { backgroundColor: `${urgencyColor}20` }]}>
              <View style={[styles.urgencyDotSimple, { backgroundColor: urgencyColor }]} />
            </View>
          </View>

          {/* Vehicle & Part */}
          <View style={styles.cardMainContent}>
            <View style={styles.vehicleRowSimple}>
              <Ionicons name="car-outline" size={14} color="#6B7280" />
              <Text style={styles.vehicleTextSimple}>
                {request.vehicle.make} {request.vehicle.model} • {request.vehicle.year}
              </Text>
            </View>
            <Text style={styles.partNameSimple}>{request.partName}</Text>
            {request.description && (
              <Text style={styles.descriptionSimple} numberOfLines={2}>
                {request.description}
              </Text>
            )}
          </View>

          {/* Bottom Row - Budget, Offers, Status */}
          <View style={styles.cardBottomRow}>
            <View style={styles.cardBottomLeft}>
              {request.budgetGEL && (
                <View style={styles.budgetBadgeSimple}>
                  <Text style={styles.budgetTextSimple}>{request.budgetGEL}₾</Text>
                </View>
              )}
              {request.offersCount !== undefined && request.offersCount > 0 && (
                <View style={styles.offersBadgeSimple}>
                  <Ionicons name="chatbubbles" size={12} color="#6366F1" />
                  <Text style={styles.offersTextSimple}>{request.offersCount}</Text>
                </View>
              )}
            </View>
            <View style={[styles.statusBadgeSimple, { backgroundColor: isActive ? '#ECFDF5' : '#F3F4F6' }]}>
              <Text style={[styles.statusTextSimple, { color: isActive ? '#10B981' : '#6B7280' }]}>
                {isActive ? 'აქტიური' : 'დასრულებული'}
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.cardActionsRow}>
            {/* შეთავაზებების ღილაკი - მხოლოდ request owner-ისთვის */}
            {isMyRequest && (
              <Pressable
                style={styles.chatButton}
                onPress={(e) => handleChatPress(request, e)}
              >
                <Ionicons name="chatbubbles-outline" size={16} color="#6366F1" />
                <Text style={styles.chatButtonText}>
                  {request.offersCount && request.offersCount > 0 
                    ? `${request.offersCount} შეთავაზება` 
                    : 'შეთავაზებები'}
                </Text>
              </Pressable>
            )}
            {!isMyRequest && isActive && (
              <Pressable
                style={[styles.offerButton, !isMyRequest && styles.offerButtonFull]}
                onPress={(e) => handleOfferPress(request, e)}
              >
                <Ionicons name="cash-outline" size={16} color="#FFFFFF" />
                <Text style={styles.offerButtonText}>შეთავაზების გაგზავნა</Text>
              </Pressable>
            )}
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        
        {/* Header */}
        <LinearGradient
          colors={['#F8FAFC', '#FFFFFF']}
          style={[styles.header, { paddingTop: Math.max(insets.top - 20, 4) }]}
        >
          <View style={styles.headerContent}>
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={20} color="#111827" />
            </Pressable>
            
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>ხელოსნის მოთხოვნა</Text>
              <Text style={styles.headerSubtitle}>
                {activeTab === 'all' ? requests.length : myRequestsCount} მოთხოვნა
              </Text>
            </View>
            
            <View style={styles.headerRight}>
              <Pressable
                style={styles.createButton}
                onPress={() => setShowCreateModal(true)}
              >
                <Ionicons name="add" size={20} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
        </LinearGradient>

        {/* Filter Button - Above Tabs */}
        <View style={styles.filterButtonContainer}>
          <Pressable
            style={[styles.filterButtonTop, hasActiveFilters && styles.filterButtonTopActive]}
            onPress={() => setShowFilterModal(true)}
          >
            <Ionicons name="filter" size={18} color={hasActiveFilters ? "#FFFFFF" : "#6366F1"} />
            <Text style={[styles.filterButtonTopText, hasActiveFilters && styles.filterButtonTopTextActive]}>
              ფილტრი
            </Text>
            {hasActiveFilters && (
              <View style={styles.filterBadgeTop}>
                <Text style={styles.filterBadgeTopText}>
                  {(filterMake ? 1 : 0) + (filterModel ? 1 : 0) + (filterYear ? 1 : 0)}
                </Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <Pressable
            style={[styles.tab, activeTab === 'all' && styles.tabActive]}
            onPress={() => setActiveTab('all')}
          >
            <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>
              ყველა
            </Text>
            {activeTab === 'all' && <View style={styles.tabIndicator} />}
          </Pressable>
          <Pressable
            style={[styles.tab, activeTab === 'my' && styles.tabActive]}
            onPress={() => setActiveTab('my')}
          >
            <View style={styles.tabContent}>
              <Text style={[styles.tabText, activeTab === 'my' && styles.tabTextActive, myRequestsCount > 0 && styles.tabTextWithBadge]}>
                ჩემი განცხადებები
              </Text>
              {myRequestsCount > 0 && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>{myRequestsCount}</Text>
                </View>
              )}
            </View>
            {activeTab === 'my' && <View style={styles.tabIndicator} />}
          </Pressable>
          <Pressable
            style={[styles.tab, activeTab === 'chats' && styles.tabActive]}
            onPress={() => setActiveTab('chats')}
          >
            <Text style={[styles.tabText, activeTab === 'chats' && styles.tabTextActive]}>
              ჩატები
            </Text>
            {activeTab === 'chats' && <View style={styles.tabIndicator} />}
          </Pressable>
        </View>

        {/* Content */}
        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {activeTab === 'chats' ? (
            <ScrollView
              style={styles.chatsContainer}
              contentContainerStyle={styles.chatsContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={chatsRefreshing}
                  onRefresh={onChatsRefresh}
                  tintColor="#6366F1"
                  colors={['#6366F1']}
                />
              }
            >
              {conversations.map((conversation, index) => {
                const unreadCount = getUnreadCount(conversation);
                
                return (
                  <Pressable
                    key={conversation._id || conversation.requestId}
                    style={styles.conversationCard}
                    onPress={() => handleConversationPress(conversation)}
                  >
                    <View style={styles.conversationContent}>
                      {/* Avatar */}
                      <View style={styles.conversationAvatarContainer}>
                        <View style={styles.conversationAvatar}>
                          <Ionicons 
                            name="storefront-outline" 
                            size={24} 
                            color="#6366F1" 
                          />
                        </View>
                        {unreadCount > 0 && (
                          <View style={styles.conversationUnreadBadge}>
                            <Text style={styles.conversationUnreadText}>
                              {unreadCount > 99 ? '99+' : unreadCount}
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Conversation Info */}
                      <View style={styles.conversationInfo}>
                        <View style={styles.conversationHeader}>
                          <Text style={styles.conversationPartnerName} numberOfLines={1}>
                            {conversation.partnerName || 'მაღაზია'}
                          </Text>
                          {conversation.lastMessageAt && (
                            <Text style={styles.conversationTime}>
                              {formatChatTime(conversation.lastMessageAt)}
                            </Text>
                          )}
                        </View>
                        
                        {/* Vehicle Info */}
                        {conversation.vehicleInfo && (
                          <View style={styles.conversationVehicleInfo}>
                            <Ionicons name="car-outline" size={12} color="#6B7280" />
                            <Text style={styles.conversationVehicleText} numberOfLines={1}>
                              {conversation.vehicleInfo}
                            </Text>
                          </View>
                        )}
                        
                        <View style={styles.conversationFooter}>
                          <View style={styles.conversationLastMessageContainer}>
                            {conversation.lastSenderName && (
                              <Text style={styles.conversationSenderName}>
                                {conversation.lastSenderName}:
                              </Text>
                            )}
                            <Text 
                              style={[
                                styles.conversationLastMessage,
                                unreadCount > 0 && styles.conversationLastMessageUnread
                              ]} 
                              numberOfLines={1}
                            >
                              {conversation.lastMessage || 'შეტყობინება არ არის'}
                            </Text>
                          </View>
                        </View>
                        
                        {/* Request Title */}
                        {conversation.requestTitle && (
                          <View style={styles.conversationRequestTitle}>
                            <Ionicons name="cube-outline" size={12} color="#9CA3AF" />
                            <Text style={styles.conversationRequestTitleText} numberOfLines={1}>
                              {conversation.requestTitle}
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Arrow */}
                      <View style={styles.conversationArrow}>
                        <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
                      </View>
                    </View>
                  </Pressable>
                );
              })}
              
              {chatsLoading && conversations.length === 0 && (
                <View style={styles.chatsLoadingState}>
                  <ActivityIndicator size="large" color="#6366F1" />
                  <Text style={styles.chatsLoadingText}>ჩატების ჩატვირთვა...</Text>
                </View>
              )}
              
              {conversations.length === 0 && !chatsLoading && (
                <View style={styles.chatsEmptyState}>
                  <Ionicons name="chatbubbles-outline" size={48} color="#D1D5DB" />
                  <Text style={styles.chatsEmptyTitle}>ჩატები ჯერ არ არის</Text>
                  <Text style={styles.chatsEmptySubtitle}>
                    როცა შეთავაზებებს მიიღებთ და დაიწყებთ მიწერ-მოწერას, ჩატები აქ გამოჩნდება
                  </Text>
                </View>
              )}
            </ScrollView>
          ) : loading && requests.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#6366F1" />
              <Text style={styles.loadingText}>იტვირთება...</Text>
            </View>
          ) : filteredRequests.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="build-outline" size={64} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>
                {activeTab === 'my' ? 'ჩემი განცხადებები ჯერ არ არის' : 'მოთხოვნები ჯერ არ არის'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {activeTab === 'my' 
                  ? 'გამოაქვეყნე პირველი განცხადება ხელოსნისთვის' 
                  : 'იყავი პირველი და გამოაქვეყნე მოთხოვნა ხელოსნისთვის'}
              </Text>
              <Pressable
                style={styles.emptyButton}
                onPress={() => setShowCreateModal(true)}
              >
                <Ionicons name="add" size={20} color="#FFFFFF" />
                <Text style={styles.emptyButtonText}>ახალი მოთხოვნა</Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView
              ref={scrollViewRef}
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
            >
              {filteredRequests.map(renderRequestCard)}
            </ScrollView>
          )}
        </Animated.View>

        <Modal
          visible={showCreateModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowCreateModal(false)}
        >
          <KeyboardAvoidingView
            style={styles.modalOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          >
            <View style={styles.modalContentSimple}>
              {/* Simple Header */}
              <View style={styles.modalHeaderSimple}>
                <Text style={styles.modalTitleSimple}>ახალი მოთხოვნა ხელოსნისთვის</Text>
                <Pressable
                  onPress={() => setShowCreateModal(false)}
                  style={styles.modalCloseButtonSimple}
                >
                  <Ionicons name="close" size={22} color="#6B7280" />
                </Pressable>
              </View>

              <ScrollView
                style={styles.modalBodySimple}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.modalScrollContent}
              >
                {/* Make Selection */}
                <View style={styles.formSection}>
                  <Text style={styles.formLabel}>მარკა *</Text>
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    style={styles.brandScrollView}
                    contentContainerStyle={styles.brandChipsContainer}
                  >
                    {carBrands.slice(0, 30).map((brand) => (
                      <Pressable
                        key={brand}
                        style={[styles.brandChip, selectedMake === brand && styles.brandChipActive]}
                        onPress={() => setSelectedMake(brand)}
                      >
                        <Text style={[styles.brandChipText, selectedMake === brand && styles.brandChipTextActive]}>
                          {brand}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>

                {/* Model Selection */}
                {selectedMake && createRequestAvailableModels.length > 0 && (
                  <View style={styles.formSection}>
                    <Text style={styles.formLabel}>მოდელი *</Text>
                    <ScrollView 
                      horizontal 
                      showsHorizontalScrollIndicator={false}
                      style={styles.brandScrollView}
                      contentContainerStyle={styles.brandChipsContainer}
                    >
                      {createRequestAvailableModels.slice(0, 40).map((model) => (
                        <Pressable
                          key={model}
                          style={[styles.brandChip, selectedModel === model && styles.brandChipActive]}
                          onPress={() => setSelectedModel(model)}
                        >
                          <Text style={[styles.brandChipText, selectedModel === model && styles.brandChipTextActive]}>
                            {model}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {/* Year Selection */}
                <View style={styles.formSection}>
                  <Text style={styles.formLabel}>წელი *</Text>
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    style={styles.brandScrollView}
                    contentContainerStyle={styles.brandChipsContainer}
                  >
                    {YEARS.map((year) => (
                      <Pressable
                        key={year}
                        style={[styles.brandChip, selectedYear === year && styles.brandChipActive]}
                        onPress={() => setSelectedYear(year)}
                      >
                        <Text style={[styles.brandChipText, selectedYear === year && styles.brandChipTextActive]}>
                          {year}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>

                {/* Problem Title */}
                <TextInput
                  style={styles.inputSimple}
                  placeholder="პრობლემის სახელი * (მაგ: ძრავის პრობლემა, ბრეიკების შეკეთება)"
                  placeholderTextColor="#9CA3AF"
                  value={problemTitle}
                  onChangeText={setProblemTitle}
                />

                {/* Description */}
                <TextInput
                  style={[styles.inputSimple, styles.textAreaSimple]}
                  placeholder="აღწერა (არასავალდებულო)"
                  placeholderTextColor="#9CA3AF"
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={3}
                />

                <View style={styles.rowInputs}>
                  <TextInput
                    style={[styles.inputSimple, styles.halfInput]}
                    placeholder="ბიუჯეტი (₾)"
                    placeholderTextColor="#9CA3AF"
                    value={budget}
                    onChangeText={setBudget}
                    keyboardType="numeric"
                  />
                  <View style={[styles.urgencySelectorSimple]}>
                    {(['low', 'medium', 'high'] as const).map((level) => (
                      <Pressable
                        key={level}
                        style={[
                          styles.urgencyOptionSimple,
                          urgency === level && styles.urgencyOptionSimpleActive,
                        ]}
                        onPress={() => setUrgency(level)}
                      >
                        <View
                          style={[
                            styles.urgencyOptionDotSimple,
                            { backgroundColor: getUrgencyColor(level) },
                          ]}
                        />
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* Submit Button */}
                <Pressable
                  style={[styles.submitButtonSimple, isCreating && styles.submitButtonDisabled]}
                  onPress={handleCreateRequest}
                  disabled={isCreating}
                >
                  {isCreating ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.submitButtonTextSimple}>გამოქვეყნება</Text>
                  )}
                </Pressable>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Filter Modal */}
        <FilterModal
          visible={showFilterModal}
          onClose={() => setShowFilterModal(false)}
          filterMake={filterMake}
          filterModel={filterModel}
          filterYear={filterYear}
          onFilterChange={handleFilterChange}
        />

        {/* Offer Modal */}
        <Modal
          visible={showOfferModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowOfferModal(false)}
        >
          <KeyboardAvoidingView
            style={styles.modalOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          >
            <View style={styles.modalContentSimple}>
              <View style={styles.modalHeaderSimple}>
                <Text style={styles.modalTitleSimple}>შეთავაზების გაგზავნა</Text>
                <Pressable
                  onPress={() => {
                    setShowOfferModal(false);
                    setOfferPrice('');
                    setSelectedRequestForOffer(null);
                  }}
                  style={styles.modalCloseButtonSimple}
                >
                  <Ionicons name="close" size={22} color="#6B7280" />
                </Pressable>
              </View>

              <ScrollView
                style={styles.modalBodySimple}
                contentContainerStyle={styles.modalScrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {selectedRequestForOffer && (
                  <>
                    <View style={styles.offerRequestInfo}>
                      <Text style={styles.offerRequestTitle}>
                        {selectedRequestForOffer.partName}
                      </Text>
                      <Text style={styles.offerRequestVehicle}>
                        {selectedRequestForOffer.vehicle.make} {selectedRequestForOffer.vehicle.model} ({selectedRequestForOffer.vehicle.year})
                      </Text>
                      {selectedRequestForOffer.budgetGEL && (
                        <Text style={styles.offerRequestBudget}>
                          ბიუჯეტი: {selectedRequestForOffer.budgetGEL}₾
                        </Text>
                      )}
                    </View>

                    <TextInput
                      style={styles.inputSimple}
                      placeholder="ფასი (₾) *"
                      placeholderTextColor="#9CA3AF"
                      value={offerPrice}
                      onChangeText={setOfferPrice}
                      keyboardType="numeric"
                    />

                    <Pressable
                      style={[styles.submitButtonSimple, isSubmittingOffer && styles.submitButtonDisabled]}
                      onPress={handleCreateOffer}
                      disabled={isSubmittingOffer}
                    >
                      {isSubmittingOffer ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text style={styles.submitButtonTextSimple}>გაგზავნა</Text>
                      )}
                    </Pressable>
                  </>
                )}
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Car Picker Modal */}
        <AddCarModal
          visible={showCarPicker}
          onClose={() => setShowCarPicker(false)}
          onAddCar={async (car) => {
            // Convert to Car type if needed
            const carToSelect: any = {
              id: car.plateNumber || Date.now().toString(),
              make: car.make,
              model: car.model,
              year: car.year,
              plateNumber: car.plateNumber,
              imageUri: car.imageUri,
            };
            selectCar(carToSelect);
            setShowCarPicker(false);
          }}
        />

        {/* Make Picker Modal */}
        <Modal
          visible={showMakePicker}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowMakePicker(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.pickerModalContent}>
              <View style={styles.pickerModalHeader}>
                <Text style={styles.pickerModalTitle}>აირჩიეთ მარკა</Text>
                <Pressable
                  onPress={() => setShowMakePicker(false)}
                  style={styles.modalCloseButtonSimple}
                >
                  <Ionicons name="close" size={22} color="#6B7280" />
                </Pressable>
              </View>
              <ScrollView style={styles.pickerModalBody} showsVerticalScrollIndicator={false}>
                <Pressable
                  style={[styles.pickerOption, !filterMake && styles.pickerOptionSelected]}
                  onPress={() => {
                    setFilterMake('');
                    setFilterModel('');
                    setShowMakePicker(false);
                  }}
                >
                  <Text style={[styles.pickerOptionText, !filterMake && styles.pickerOptionTextSelected]}>
                    ყველა
                  </Text>
                  {!filterMake && <Ionicons name="checkmark" size={20} color="#6366F1" />}
                </Pressable>
                {carBrands.map((brand) => (
                  <Pressable
                    key={brand}
                    style={[styles.pickerOption, filterMake === brand && styles.pickerOptionSelected]}
                    onPress={() => {
                      setFilterMake(brand);
                      setFilterModel('');
                      setShowMakePicker(false);
                    }}
                  >
                    <Text style={[styles.pickerOptionText, filterMake === brand && styles.pickerOptionTextSelected]}>
                      {brand}
                    </Text>
                    {filterMake === brand && <Ionicons name="checkmark" size={20} color="#6366F1" />}
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Model Picker Modal */}
        <Modal
          visible={showModelPicker}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowModelPicker(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.pickerModalContent}>
              <View style={styles.pickerModalHeader}>
                <Text style={styles.pickerModalTitle}>აირჩიეთ მოდელი</Text>
                <Pressable
                  onPress={() => setShowModelPicker(false)}
                  style={styles.modalCloseButtonSimple}
                >
                  <Ionicons name="close" size={22} color="#6B7280" />
                </Pressable>
              </View>
              <ScrollView style={styles.pickerModalBody} showsVerticalScrollIndicator={false}>
                <Pressable
                  style={[styles.pickerOption, !filterModel && styles.pickerOptionSelected]}
                  onPress={() => {
                    setFilterModel('');
                    setShowModelPicker(false);
                  }}
                >
                  <Text style={[styles.pickerOptionText, !filterModel && styles.pickerOptionTextSelected]}>
                    ყველა
                  </Text>
                  {!filterModel && <Ionicons name="checkmark" size={20} color="#6366F1" />}
                </Pressable>
                {availableModels.map((model) => (
                  <Pressable
                    key={model}
                    style={[styles.pickerOption, filterModel === model && styles.pickerOptionSelected]}
                    onPress={() => {
                      setFilterModel(model);
                      setShowModelPicker(false);
                    }}
                  >
                    <Text style={[styles.pickerOptionText, filterModel === model && styles.pickerOptionTextSelected]}>
                      {model}
                    </Text>
                    {filterModel === model && <Ionicons name="checkmark" size={20} color="#6366F1" />}
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  filterButtonActive: {
    backgroundColor: '#6366F1',
  },
  filterBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#EF4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  filterBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  createButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterButtonContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filterButtonTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#EEF2FF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E7FF',
    position: 'relative',
  },
  filterButtonTopActive: {
    backgroundColor: '#6366F1',
    borderColor: '#4F46E5',
  },
  filterButtonTopText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366F1',
  },
  filterButtonTopTextActive: {
    color: '#FFFFFF',
  },
  filterBadgeTop: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  filterBadgeTopText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingHorizontal: 14,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tabActive: {
    // Active state handled by indicator
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    position: 'relative',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#6366F1',
    fontWeight: '600',
  },
  tabTextWithBadge: {
    paddingRight: 0,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#6366F1',
    borderRadius: 1,
  },
  tabBadge: {
    backgroundColor: '#6366F1',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    marginLeft: 2,
  },
  tabBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366F1',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 24,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 14,
  },
  requestCard: {
    marginBottom: 12,
    borderRadius: 14,
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  cardGradient: {
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  userDetails: {
    flex: 1,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  myRequestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 4,
  },
  myRequestText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6366F1',
  },
  myRequestAvatar: {
    backgroundColor: '#6366F1',
  },
  timeAgo: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  urgencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
  },
  urgencyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  urgencyText: {
    fontSize: 11,
    fontWeight: '600',
  },
  vehicleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingVertical: 7,
    paddingHorizontal: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  vehicleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginLeft: 8,
  },
  partSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  partName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginLeft: 8,
    flex: 1,
  },
  description: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  budgetBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  budgetText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#10B981',
    marginLeft: 4,
  },
  offersBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  offersText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6366F1',
    marginLeft: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    padding: 18,
  },
  formSection: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  carSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  selectedCar: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  selectedCarText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 8,
  },
  noCarSelected: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  noCarText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginLeft: 8,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  urgencySelector: {
    flexDirection: 'row',
    gap: 10,
  },
  urgencyOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  urgencyOptionActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#6366F1',
  },
  urgencyOptionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  urgencyOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  urgencyOptionTextActive: {
    color: '#6366F1',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366F1',
    padding: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  modalHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  clearFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  clearFilterText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  filterScrollView: {
    marginHorizontal: -18,
    paddingHorizontal: 18,
  },
  filterChips: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterChipActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  // Simplified Modal Styles
  modalContentSimple: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  modalHeaderSimple: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitleSimple: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  modalCloseButtonSimple: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBodySimple: {
    padding: 16,
  },
  modalScrollContent: {
    paddingBottom: 40,
  },
  carSelectorSimple: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  selectedCarSimple: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  selectedCarTextSimple: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    marginLeft: 8,
  },
  noCarSelectedSimple: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  noCarTextSimple: {
    fontSize: 14,
    color: '#9CA3AF',
    marginLeft: 8,
  },
  inputSimple: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  textAreaSimple: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  halfInput: {
    flex: 1,
  },
  urgencySelectorSimple: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  urgencyOptionSimple: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  urgencyOptionSimpleActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#6366F1',
  },
  urgencyOptionDotSimple: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  submitButtonSimple: {
    backgroundColor: '#6366F1',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitButtonTextSimple: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  // Simplified Card Styles
  requestCardSimple: {
    marginBottom: 10,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  cardContentSimple: {
    padding: 12,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  userInfoSimple: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarSimple: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  myRequestAvatarSimple: {
    backgroundColor: '#6366F1',
  },
  userDetailsSimple: {
    flex: 1,
  },
  userNameSimple: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  timeAgoSimple: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 1,
  },
  myRequestBadgeSimple: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 6,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  myRequestTextSimple: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6366F1',
  },
  urgencyBadgeSimple: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  urgencyDotSimple: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cardMainContent: {
    marginBottom: 10,
  },
  vehicleRowSimple: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  vehicleTextSimple: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 6,
  },
  partNameSimple: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  descriptionSimple: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '600',
    lineHeight: 20,
    marginTop: 6,
    backgroundColor: '#F9FAFB',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  cardBottomLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  budgetBadgeSimple: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  budgetTextSimple: {
    fontSize: 11,
    fontWeight: '600',
    color: '#10B981',
  },
  offersBadgeSimple: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  offersTextSimple: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6366F1',
  },
  statusBadgeSimple: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusTextSimple: {
    fontSize: 11,
    fontWeight: '600',
  },
  cardActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  chatButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    gap: 6,
  },
  chatButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6366F1',
  },
  offerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#10B981',
    borderRadius: 8,
    gap: 6,
  },
  offerButtonFull: {
    width: '100%',
  },
  offerButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  offerRequestInfo: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  chatsTabContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  chatScreenButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  chatScreenButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    gap: 12,
  },
  chatScreenButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  offerRequestTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  offerRequestVehicle: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
  },
  offerRequestBudget: {
    fontSize: 13,
    color: '#10B981',
    fontWeight: '600',
  },
  // Chats styles
  chatsContainer: {
    flex: 1,
  },
  chatsContent: {
    paddingVertical: 12,
    gap: 8,
  },
  conversationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  conversationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  conversationAvatarContainer: {
    position: 'relative',
  },
  conversationAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#E0E7FF',
  },
  conversationUnreadBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  conversationUnreadText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  conversationInfo: {
    flex: 1,
    gap: 6,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  conversationPartnerName: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '700',
    flex: 1,
  },
  conversationTime: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    marginLeft: 8,
  },
  conversationVehicleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  conversationVehicleText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    flex: 1,
  },
  conversationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  conversationLastMessageContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  conversationSenderName: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
  },
  conversationLastMessage: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '400',
    flex: 1,
  },
  conversationLastMessageUnread: {
    color: '#111827',
    fontWeight: '600',
  },
  conversationRequestTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  conversationRequestTitleText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
    flex: 1,
  },
  conversationArrow: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatsLoadingState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  chatsLoadingText: {
    fontSize: 16,
    color: '#6366F1',
    textAlign: 'center',
    fontWeight: '600',
  },
  chatsEmptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
    gap: 16,
  },
  chatsEmptyTitle: {
    fontSize: 20,
    color: '#111827',
    textAlign: 'center',
    fontWeight: '700',
  },
  chatsEmptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '500',
  },
  // Filter Modal Simple Styles
  modalHeaderRightSimple: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  clearFilterButtonSimple: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  clearFilterTextSimple: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  filterSectionSimple: {
    marginBottom: 20,
  },
  filterLabelSimple: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 10,
  },
  filterScrollViewSimple: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  filterChipsContainerSimple: {
    gap: 8,
    paddingRight: 16,
  },
  filterChipSimple: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginRight: 8,
  },
  filterChipSimpleActive: {
    backgroundColor: '#6366F1',
    borderColor: '#4F46E5',
  },
  filterChipTextSimple: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  filterChipTextSimpleActive: {
    color: '#FFFFFF',
  },
  brandScrollView: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  brandChipsContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 16,
  },
  brandChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    marginRight: 8,
  },
  brandChipActive: {
    backgroundColor: '#6366F1',
    borderColor: '#4F46E5',
  },
  brandChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  brandChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  filterSelectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterSelectText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  filterSelectTextPlaceholder: {
    color: '#9CA3AF',
    fontWeight: '400',
  },
  pickerModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  pickerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  pickerModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  pickerModalBody: {
    maxHeight: 500,
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  pickerOptionSelected: {
    backgroundColor: '#F0F9FF',
  },
  pickerOptionText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
  },
  pickerOptionTextSelected: {
    color: '#6366F1',
    fontWeight: '600',
  },
});
