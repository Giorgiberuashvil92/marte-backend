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
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { useCars } from '@/contexts/CarContext';
import { useUser } from '@/contexts/UserContext';
import { useToast } from '@/contexts/ToastContext';
import { requestsApi, type Request } from '@/services/requestsApi';
import { aiApi } from '@/services/aiApi';
import AddCarModal from '@/components/garage/AddCarModal';
import { messagesApi, type RecentChat } from '@/services/messagesApi';
import FilterModal, { DismantlerFilters, PartsFilters } from '@/components/ui/FilterModal';
import { carBrandsApi } from '@/services/carBrandsApi';

const YEARS = Array.from({ length: 30 }, (_, i) => (2024 - i).toString());

const { width } = Dimensions.get('window');

interface RequestWithUser extends Request {
  userName?: string;
  userPhone?: string;
  offersCount?: number;
}

export default function PartsRequestsScreen() {
  const { user } = useUser();
  const { selectedCar, cars, selectCar } = useCars();
  const { success, error } = useToast();
  
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
  const [partName, setPartName] = useState('');
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState('');
  const [urgency, setUrgency] = useState<'low' | 'medium' | 'high'>('medium');
  const [selectedMake, setSelectedMake] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [createRequestAvailableModels, setCreateRequestAvailableModels] = useState<string[]>([]);
  const [showCreateMakePicker, setShowCreateMakePicker] = useState(false);
  const [showCreateModelPicker, setShowCreateModelPicker] = useState(false);
  
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
      const res = await aiApi.getSellerStatus({
        userId: user.id,
        phone: user.phone,
      });
      setSellerStatus(res.data);
      const hasStore = !!(res.data?.counts?.stores && res.data.counts.stores > 0) ||
        !!(res.data?.ownedStores && res.data.ownedStores.length > 0);
      const hasDismantlers = !!(res.data?.counts?.dismantlers && res.data.counts.dismantlers > 0) ||
        !!(res.data?.ownedDismantlers && res.data.ownedDismantlers.length > 0);
      setIsSeller(hasStore || hasDismantlers);
      
      const derivedName =
        res.data?.ownedStores?.find((store: any) => store?.title)?.title?.trim() ||
        res.data?.ownedDismantlers?.find((d: any) => d?.brand)?.brand?.trim() ||
        user?.name?.trim() ||
        'მაღაზია';
      setStoreName(derivedName);
    } catch (e) {
      console.log('[PartsRequests] Failed to load seller status:', e);
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
      // Filter only parts requests
      const partsRequests = allRequests.filter(req => req.service === 'parts');
      
      // Enrich with user info and offers count
      const enrichedRequests = await Promise.all(
        partsRequests.map(async (req) => {
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
            
            // Filter only parts requests
            if (request?.service !== 'parts') {
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
      
      // Filter out null values (non-parts requests)
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

    if (!partName.trim()) {
      error('შეცდომა', 'გთხოვთ შეიყვანოთ ნაწილის სახელი');
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
        partName: partName.trim(),
        description: description.trim() || undefined,
        budgetGEL: budget ? parseFloat(budget) : undefined,
        urgency,
        service: 'parts' as const,
      };

      const newRequest = await requestsApi.createRequest(requestData);
      
      // Add to list
      setRequests(prev => [newRequest as RequestWithUser, ...prev]);
      
      // Reset form
      setPartName('');
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
    router.push(`/request-detail/${request.id}` as any);
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
      <TouchableOpacity
        key={request.id}
        style={styles.listItem}
        onPress={() => handleRequestPress(request)}
        activeOpacity={0.7}
      >
        {/* Left Icon */}
        <View style={[styles.listItemIcon, isMyRequest && styles.listItemIconMy]}>
          <Ionicons name="construct" size={22} color={isMyRequest ? "#FFFFFF" : "#111827"} />
        </View>

        {/* Content */}
        <View style={styles.listItemContent}>
          {/* Title & Urgency */}
          <View style={styles.listItemHeader}>
            <Text style={styles.listItemTitle} numberOfLines={1}>
              {request.partName}
            </Text>
            <View style={[styles.urgencyDotContainer, { backgroundColor: `${urgencyColor}20` }]}>
              <View style={[styles.urgencyDotNew, { backgroundColor: urgencyColor }]} />
            </View>
          </View>

          {/* Vehicle */}
          <View style={styles.listItemVehicle}>
            <Ionicons name="car-outline" size={12} color="#6B7280" />
            <Text style={styles.listItemSubtitle}>
              {request.vehicle.make} {request.vehicle.model} • {request.vehicle.year}
            </Text>
          </View>

          {/* Author */}
          {(request.userName || request.userPhone) && (
            <View style={styles.listItemAuthor}>
              <Ionicons name="person-outline" size={12} color="#6B7280" />
              <Text style={styles.listItemAuthorText}>
                {request.userName || request.userPhone || 'უცნობი'}
              </Text>
            </View>
          )}

          {/* Description */}
          {request.description && (
            <Text style={styles.listItemDescription} numberOfLines={1}>
              {request.description}
            </Text>
          )}

          {/* Meta Row */}
          <View style={styles.listItemMeta}>
            <Text style={styles.listItemTime}>
              {formatTimeAgo(request.createdAt)}
            </Text>
            {request.budgetGEL && (
              <View style={styles.budgetChip}>
                <Text style={styles.budgetChipText}>{request.budgetGEL}₾</Text>
              </View>
            )}
            {request.offersCount !== undefined && request.offersCount > 0 && (
              <View style={styles.offersChip}>
                <Ionicons name="chatbubbles" size={10} color="#111827" />
                <Text style={styles.offersChipText}>{request.offersCount}</Text>
              </View>
            )}
            <View style={[styles.statusChip, { backgroundColor: isActive ? '#ECFDF5' : '#F3F4F6' }]}>
              <Text style={[styles.statusChipText, { color: isActive ? '#10B981' : '#6B7280' }]}>
                {isActive ? 'აქტიური' : 'დასრულებული'}
              </Text>
            </View>
            {isMyRequest && (
              <View style={styles.myBadge}>
                <Text style={styles.myBadgeText}>ჩემი</Text>
              </View>
            )}
          </View>

          {/* Action Buttons */}
          <View style={styles.listItemActions}>
            {isMyRequest && (
              <TouchableOpacity
                style={styles.actionBtnSecondary}
                onPress={(e) => handleChatPress(request, e)}
                activeOpacity={0.7}
              >
                <Ionicons name="chatbubbles-outline" size={14} color="#111827" />
                <Text style={styles.actionBtnSecondaryText}>
                  {request.offersCount && request.offersCount > 0 
                    ? `${request.offersCount} შეთავაზება` 
                    : 'შეთავაზებები'}
                </Text>
              </TouchableOpacity>
            )}
            {!isMyRequest && isActive && (
              <TouchableOpacity
                style={styles.actionBtnPrimary}
                onPress={(e) => handleOfferPress(request, e)}
                activeOpacity={0.7}
              >
                <Ionicons name="cash-outline" size={14} color="#FFFFFF" />
                <Text style={styles.actionBtnPrimaryText}>შეთავაზების გაგზავნა</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* View Button */}
        <View style={styles.viewBtn}>
          <Ionicons name="eye-outline" size={14} color="#111827" />
          <Text style={styles.viewBtnText}>ნახვა</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        
        {/* Header */}
        <View style={styles.topBar}>
          <View style={styles.topBarContent}>
            <TouchableOpacity onPress={() => router.back()} style={styles.topBarButton}>
              <Ionicons name="arrow-back" size={20} color="#111827" />
            </TouchableOpacity>
            
            <Text style={styles.topBarTitle}>ნაწილის მოთხოვნა</Text>
            
            <View style={styles.topBarRight}>
              <TouchableOpacity
                style={[styles.topBarButton, hasActiveFilters && styles.topBarButtonActive]}
                onPress={() => setShowFilterModal(true)}
              >
                <Ionicons name="options" size={20} color={hasActiveFilters ? "#FFFFFF" : "#111827"} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.topBarButtonPrimary}
                onPress={() => setShowCreateModal(true)}
              >
                <Ionicons name="add" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Segment Control Tabs */}
        <View style={styles.navSection}>
          <View style={styles.segmentControl}>
            <Pressable
              style={[styles.segmentItem, activeTab === 'all' && styles.segmentItemActive]}
              onPress={() => setActiveTab('all')}
            >
              <Text style={[styles.segmentText, activeTab === 'all' && styles.segmentTextActive]}>
                ყველა
              </Text>
            </Pressable>
            <Pressable
              style={[styles.segmentItem, activeTab === 'my' && styles.segmentItemActive]}
              onPress={() => setActiveTab('my')}
            >
              <View style={styles.segmentContent}>
                <Text style={[styles.segmentText, activeTab === 'my' && styles.segmentTextActive]}>
                  ჩემი
                </Text>
                {myRequestsCount > 0 && (
                  <View style={[styles.segmentBadge, activeTab === 'my' && styles.segmentBadgeActive]}>
                    <Text style={[styles.segmentBadgeText, activeTab === 'my' && styles.segmentBadgeTextActive]}>{myRequestsCount}</Text>
                  </View>
                )}
              </View>
            </Pressable>
            <Pressable
              style={[styles.segmentItem, activeTab === 'chats' && styles.segmentItemActive]}
              onPress={() => setActiveTab('chats')}
            >
              <Text style={[styles.segmentText, activeTab === 'chats' && styles.segmentTextActive]}>
                ჩატები
              </Text>
            </Pressable>
          </View>
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
                  tintColor="#111827"
                  colors={['#111827']}
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
                            color="#111827" 
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
                  <ActivityIndicator size="large" color="#111827" />
                  <Text style={styles.chatsLoadingText}>ჩატების ჩატვირთვა...</Text>
                </View>
              )}
              
              {conversations.length === 0 && !chatsLoading && (
                <View style={styles.chatsEmptyState}>
                  <View style={styles.emptyIconCircle}>
                    <Ionicons name="chatbubbles-outline" size={32} color="#9CA3AF" />
                  </View>
                  <Text style={styles.chatsEmptyTitle}>ჩატები ჯერ არ არის</Text>
                  <Text style={styles.chatsEmptySubtitle}>
                    როცა შეთავაზებებს მიიღებთ და დაიწყებთ მიწერ-მოწერას, ჩატები აქ გამოჩნდება
                  </Text>
                </View>
              )}
            </ScrollView>
          ) : loading && requests.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#111827" />
              <Text style={styles.loadingText}>იტვირთება...</Text>
            </View>
          ) : filteredRequests.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="construct-outline" size={32} color="#9CA3AF" />
              </View>
              <Text style={styles.emptyTitle}>
                {activeTab === 'my' ? 'ჩემი განცხადებები ჯერ არ არის' : 'მოთხოვნები ჯერ არ არის'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {activeTab === 'my' 
                  ? 'გამოაქვეყნე პირველი განცხადება' 
                  : 'იყავი პირველი და გამოაქვეყნე მოთხოვნა'}
              </Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => setShowCreateModal(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="add" size={20} color="#FFFFFF" />
                <Text style={styles.emptyButtonText}>ახალი მოთხოვნა</Text>
              </TouchableOpacity>
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
              {/* Handle */}
              <View style={styles.modalHandle} />

              {/* Header */}
              <View style={styles.modalHeaderNew}>
                <View style={styles.modalHeaderLeft}>
                  <View style={styles.modalHeaderIcon}>
                    <Ionicons name="add-circle" size={20} color="#111827" />
                  </View>
                  <Text style={styles.modalTitleNew}>ახალი მოთხოვნა</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowCreateModal(false)}
                  style={styles.modalCloseBtn}
                >
                  <Ionicons name="close" size={20} color="#111827" />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.modalBodySimple}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.modalScrollContent}
              >
                {/* Step 1: Vehicle */}
                <View style={styles.formStepCard}>
                  <View style={styles.formStepHeader}>
                    <View style={styles.formStepBadge}>
                      <Text style={styles.formStepBadgeText}>1</Text>
                    </View>
                    <Text style={styles.formStepTitle}>აირჩიეთ ავტომობილი</Text>
                  </View>

                  {/* Selected car summary */}
                  {(selectedMake || selectedModel || selectedYear) && (
                    <View style={styles.selectedCarSummary}>
                      <Ionicons name="car-sport" size={16} color="#111827" />
                      <Text style={styles.selectedCarText}>
                        {[selectedMake, selectedModel, selectedYear].filter(Boolean).join(' • ')}
                      </Text>
                      <TouchableOpacity onPress={() => { setSelectedMake(''); setSelectedModel(''); setSelectedYear(''); }}>
                        <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Make - Dropdown */}
                  <View style={styles.formSection}>
                    <View style={styles.formLabelRow}>
                      <Text style={styles.formLabelNew}>მარკა</Text>
                      <Text style={styles.formRequired}>*</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.dropdownButton}
                      onPress={() => setShowCreateMakePicker(true)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="car-sport-outline" size={18} color={selectedMake ? '#111827' : '#9CA3AF'} />
                      <Text style={[styles.dropdownButtonText, selectedMake && styles.dropdownButtonTextSelected]}>
                        {selectedMake || 'აირჩიეთ მარკა'}
                      </Text>
                      <Ionicons name="chevron-down" size={18} color="#9CA3AF" />
                    </TouchableOpacity>
                  </View>

                  {/* Model - Dropdown */}
                  <View style={styles.formSection}>
                    <View style={styles.formLabelRow}>
                      <Text style={styles.formLabelNew}>მოდელი</Text>
                      <Text style={styles.formRequired}>*</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.dropdownButton, !selectedMake && styles.dropdownButtonDisabled]}
                      onPress={() => selectedMake && setShowCreateModelPicker(true)}
                      activeOpacity={selectedMake ? 0.7 : 1}
                    >
                      <Ionicons name="options-outline" size={18} color={selectedModel ? '#111827' : '#9CA3AF'} />
                      <Text style={[styles.dropdownButtonText, selectedModel && styles.dropdownButtonTextSelected]}>
                        {selectedModel || (selectedMake ? 'აირჩიეთ მოდელი' : 'ჯერ აირჩიეთ მარკა')}
                      </Text>
                      <Ionicons name="chevron-down" size={18} color="#9CA3AF" />
                    </TouchableOpacity>
                  </View>

                  {/* Year */}
                  <View style={styles.formSection}>
                    <View style={styles.formLabelRow}>
                      <Ionicons name="calendar-outline" size={14} color="#6B7280" />
                      <Text style={styles.formLabelNew}>წელი</Text>
                      <Text style={styles.formRequired}>*</Text>
                    </View>
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
                </View>

                {/* Step 2: Part Info */}
                <View style={styles.formStepCard}>
                  <View style={styles.formStepHeader}>
                    <View style={styles.formStepBadge}>
                      <Text style={styles.formStepBadgeText}>2</Text>
                    </View>
                    <Text style={styles.formStepTitle}>ნაწილის ინფორმაცია</Text>
                  </View>

                  <View style={styles.formSection}>
                    <View style={styles.formLabelRow}>
                      <Ionicons name="construct-outline" size={14} color="#6B7280" />
                      <Text style={styles.formLabelNew}>ნაწილის სახელი</Text>
                      <Text style={styles.formRequired}>*</Text>
                    </View>
                    <TextInput
                      style={styles.inputSimple}
                      placeholder="მაგ: საჭის კომპიუტერი"
                      placeholderTextColor="#9CA3AF"
                      value={partName}
                      onChangeText={setPartName}
                    />
                  </View>

                  <View style={styles.formSection}>
                    <View style={styles.formLabelRow}>
                      <Ionicons name="document-text-outline" size={14} color="#6B7280" />
                      <Text style={styles.formLabelNew}>აღწერა</Text>
                    </View>
                    <TextInput
                      style={[styles.inputSimple, styles.textAreaSimple]}
                      placeholder="დამატებითი ინფორმაცია, მდგომარეობა..."
                      placeholderTextColor="#9CA3AF"
                      value={description}
                      onChangeText={setDescription}
                      multiline
                      numberOfLines={3}
                    />
                  </View>
                </View>

                {/* Step 3: Budget & Urgency */}
                <View style={styles.formStepCard}>
                  <View style={styles.formStepHeader}>
                    <View style={styles.formStepBadge}>
                      <Text style={styles.formStepBadgeText}>3</Text>
                    </View>
                    <Text style={styles.formStepTitle}>ბიუჯეტი და პრიორიტეტი</Text>
                  </View>

                  <View style={styles.formSection}>
                    <View style={styles.formLabelRow}>
                      <Ionicons name="cash-outline" size={14} color="#6B7280" />
                      <Text style={styles.formLabelNew}>ბიუჯეტი</Text>
                    </View>
                    <View style={styles.budgetInputRow}>
                      <TextInput
                        style={[styles.inputSimple, { flex: 1, marginBottom: 0 }]}
                        placeholder="მაქსიმალური თანხა"
                        placeholderTextColor="#9CA3AF"
                        value={budget}
                        onChangeText={setBudget}
                        keyboardType="numeric"
                      />
                      <View style={styles.budgetSuffix}>
                        <Text style={styles.budgetSuffixText}>₾</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.formSection}>
                    <View style={styles.formLabelRow}>
                      <Ionicons name="flash-outline" size={14} color="#6B7280" />
                      <Text style={styles.formLabelNew}>გადაუდებლობა</Text>
                    </View>
                    <View style={styles.urgencySelector}>
                      {([
                        { key: 'low' as const, label: 'დაბალი', icon: 'leaf-outline' },
                        { key: 'medium' as const, label: 'ნორმალური', icon: 'time-outline' },
                        { key: 'high' as const, label: 'სასწრაფო', icon: 'flash' },
                      ]).map((item) => (
                        <Pressable
                          key={item.key}
                          style={[
                            styles.urgencyOption,
                            urgency === item.key && {
                              backgroundColor: `${getUrgencyColor(item.key)}15`,
                              borderColor: getUrgencyColor(item.key),
                            },
                          ]}
                          onPress={() => setUrgency(item.key)}
                        >
                          <Ionicons
                            name={item.icon as any}
                            size={16}
                            color={urgency === item.key ? getUrgencyColor(item.key) : '#9CA3AF'}
                          />
                          <Text
                            style={[
                              styles.urgencyOptionText,
                              urgency === item.key && { color: getUrgencyColor(item.key) },
                            ]}
                          >
                            {item.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                </View>

                {/* Submit Button */}
                <TouchableOpacity
                  style={[styles.submitButtonSimple, isCreating && styles.submitButtonDisabled]}
                  onPress={handleCreateRequest}
                  disabled={isCreating}
                  activeOpacity={0.7}
                >
                  {isCreating ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="send" size={16} color="#FFFFFF" />
                      <Text style={styles.submitButtonTextSimple}>გამოქვეყნება</Text>
                    </>
                  )}
                </TouchableOpacity>
              </ScrollView>

              {/* Create Request - Make Picker (inline overlay) */}
              {showCreateMakePicker && (
                <View style={styles.inlinePickerOverlay}>
                  <View style={styles.inlinePickerContent}>
                    <View style={styles.modalHeaderNew}>
                      <Text style={styles.modalTitleNew}>აირჩიეთ მარკა</Text>
                      <TouchableOpacity
                        onPress={() => setShowCreateMakePicker(false)}
                        style={styles.modalCloseBtn}
                      >
                        <Ionicons name="close" size={20} color="#6B7280" />
                      </TouchableOpacity>
                    </View>
                    <ScrollView style={styles.pickerModalBody} showsVerticalScrollIndicator={false}>
                      {carBrands.map((brand) => (
                        <Pressable
                          key={brand}
                          style={[styles.pickerOption, selectedMake === brand && styles.pickerOptionSelected]}
                          onPress={() => {
                            setSelectedMake(brand);
                            setSelectedModel('');
                            setShowCreateMakePicker(false);
                          }}
                        >
                          <Text style={[styles.pickerOptionText, selectedMake === brand && styles.pickerOptionTextSelected]}>
                            {brand}
                          </Text>
                          {selectedMake === brand && <Ionicons name="checkmark" size={20} color="#111827" />}
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                </View>
              )}

              {/* Create Request - Model Picker (inline overlay) */}
              {showCreateModelPicker && (
                <View style={styles.inlinePickerOverlay}>
                  <View style={styles.inlinePickerContent}>
                    <View style={styles.modalHeaderNew}>
                      <Text style={styles.modalTitleNew}>აირჩიეთ მოდელი</Text>
                      <TouchableOpacity
                        onPress={() => setShowCreateModelPicker(false)}
                        style={styles.modalCloseBtn}
                      >
                        <Ionicons name="close" size={20} color="#6B7280" />
                      </TouchableOpacity>
                    </View>
                    <ScrollView style={styles.pickerModalBody} showsVerticalScrollIndicator={false}>
                      {createRequestAvailableModels.map((model) => (
                        <Pressable
                          key={model}
                          style={[styles.pickerOption, selectedModel === model && styles.pickerOptionSelected]}
                          onPress={() => {
                            setSelectedModel(model);
                            setShowCreateModelPicker(false);
                          }}
                        >
                          <Text style={[styles.pickerOptionText, selectedModel === model && styles.pickerOptionTextSelected]}>
                            {model}
                          </Text>
                          {selectedModel === model && <Ionicons name="checkmark" size={20} color="#111827" />}
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                </View>
              )}
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Filter Modal */}
        <FilterModal
          visible={showFilterModal}
          activeTab={'დაშლილები'}
          dismantlerFilters={{
            brand: filterMake,
            model: filterModel,
            yearFrom: filterYear,
            yearTo: '',
            location: '',
          }}
          partsFilters={{
            brand: filterMake,
            category: '',
            priceMin: minBudget?.toString() || '',
            priceMax: maxBudget?.toString() || '',
            location: '',
          }}
          onClose={() => setShowFilterModal(false)}
          onApply={(dismantlerF: DismantlerFilters, _partsF: PartsFilters) => {
            handleFilterChange({
              make: dismantlerF.brand,
              model: dismantlerF.model,
              year: dismantlerF.yearFrom,
            });
          }}
          onReset={() => {
            handleFilterChange({
              make: '',
              model: '',
              year: '',
              urgency: '',
              status: '',
              minBudget: undefined,
              maxBudget: undefined,
            });
          }}
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
              <View style={styles.modalHeaderNew}>
                <Text style={styles.modalTitleNew}>შეთავაზების გაგზავნა</Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowOfferModal(false);
                    setOfferPrice('');
                    setSelectedRequestForOffer(null);
                  }}
                  style={styles.modalCloseBtn}
                >
                  <Ionicons name="close" size={20} color="#6B7280" />
                </TouchableOpacity>
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
              <View style={styles.modalHeaderNew}>
                <Text style={styles.modalTitleNew}>აირჩიეთ მარკა</Text>
                <TouchableOpacity
                  onPress={() => setShowMakePicker(false)}
                  style={styles.modalCloseBtn}
                >
                  <Ionicons name="close" size={20} color="#6B7280" />
                </TouchableOpacity>
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
                  {!filterMake && <Ionicons name="checkmark" size={20} color="#111827" />}
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
                    {filterMake === brand && <Ionicons name="checkmark" size={20} color="#111827" />}
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
              <View style={styles.modalHeaderNew}>
                <Text style={styles.modalTitleNew}>აირჩიეთ მოდელი</Text>
                <TouchableOpacity
                  onPress={() => setShowModelPicker(false)}
                  style={styles.modalCloseBtn}
                >
                  <Ionicons name="close" size={20} color="#6B7280" />
                </TouchableOpacity>
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
                  {!filterModel && <Ionicons name="checkmark" size={20} color="#111827" />}
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
                    {filterModel === model && <Ionicons name="checkmark" size={20} color="#111827" />}
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
  // Top Bar - matches parts-new.tsx
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
  topBarButtonActive: {
    backgroundColor: '#111827',
  },
  topBarButtonPrimary: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarRight: {
    flexDirection: 'row',
    gap: 12,
  },
  // Segment Control - matches parts-new.tsx
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
    fontSize: 13,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: '#6B7280',
    fontWeight: '600',
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
  segmentContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  segmentBadge: {
    backgroundColor: '#111827',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  segmentBadgeActive: {
    backgroundColor: '#FFFFFF',
  },
  segmentBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: 'HelveticaMedium',
    fontWeight: '700',
  },
  segmentBadgeTextActive: {
    color: '#111827',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: '#6B7280',
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#111827',
  },
  emptySubtitle: {
    fontSize: 13,
    fontFamily: 'HelveticaMedium',
    color: '#6B7280',
    textAlign: 'center',
    fontWeight: '500',
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 12,
    gap: 8,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    gap: 12,
  },
  // List Item Card - matches parts-new.tsx
  listItem: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  listItemIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  listItemIconMy: {
    backgroundColor: '#111827',
  },
  listItemContent: {
    flex: 1,
    gap: 4,
  },
  listItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  listItemTitle: {
    fontSize: 15,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#111827',
    flex: 1,
  },
  listItemVehicle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  listItemSubtitle: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    color: '#6B7280',
    fontWeight: '500',
  },
  listItemAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    marginBottom: 2,
  },
  listItemAuthorText: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    color: '#6B7280',
    fontWeight: '500',
  },
  listItemDescription: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    color: '#9CA3AF',
    fontWeight: '500',
    marginBottom: 4,
  },
  listItemTime: {
    fontSize: 11,
    fontFamily: 'HelveticaMedium',
    color: '#9CA3AF',
    fontWeight: '500',
  },
  listItemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: 4,
  },
  listItemArrow: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    marginTop: 10,
  },
  viewBtn: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    marginLeft: 8,
    alignSelf: 'center',
  },
  viewBtnText: {
    fontSize: 9,
    fontFamily: 'HelveticaMedium',
    color: '#111827',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  listItemActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  urgencyDotContainer: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  urgencyDotNew: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  budgetChip: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  budgetChipText: {
    fontSize: 11,
    fontFamily: 'HelveticaMedium',
    fontWeight: '700',
    color: '#10B981',
  },
  offersChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 3,
  },
  offersChipText: {
    fontSize: 11,
    fontFamily: 'HelveticaMedium',
    fontWeight: '700',
    color: '#111827',
  },
  statusChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusChipText: {
    fontSize: 11,
    fontFamily: 'HelveticaMedium',
    fontWeight: '600',
  },
  myBadge: {
    backgroundColor: '#111827',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  myBadgeText: {
    fontSize: 10,
    fontFamily: 'HelveticaMedium',
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  actionBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    gap: 6,
  },
  actionBtnSecondaryText: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '600',
    color: '#111827',
  },
  actionBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#111827',
    borderRadius: 8,
    gap: 6,
  },
  actionBtnPrimaryText: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  modalContentSimple: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '92%',
  },
  modalHeaderNew: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitleNew: {
    fontSize: 17,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: '#111827',
    letterSpacing: 0.3,
  },
  modalCloseBtn: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBodySimple: {
    paddingHorizontal: 20,
  },
  modalScrollContent: {
    paddingTop: 16,
    paddingBottom: 44,
    gap: 14,
  },
  // Form Step Card
  formStepCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    gap: 14,
  },
  formStepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 2,
  },
  formStepBadge: {
    width: 26,
    height: 26,
    borderRadius: 9,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formStepBadgeText: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    color: '#FFFFFF',
  },
  formStepTitle: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    color: '#111827',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  // Selected car summary
  selectedCarSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  selectedCarText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'HelveticaMedium',
    color: '#111827',
    textTransform: 'uppercase',
  },
  formSection: {
    gap: 8,
  },
  formLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  formLabelNew: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: '#6B7280',
    letterSpacing: 0.3,
  },
  formRequired: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    color: '#EF4444',
  },
  inputSimple: {
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontFamily: 'HelveticaMedium',
    color: '#111827',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  textAreaSimple: {
    minHeight: 88,
    textAlignVertical: 'top',
    paddingTop: 14,
  },
  // Budget input
  budgetInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
  },
  budgetSuffix: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
    borderWidth: 1,
    borderLeftWidth: 0,
    borderColor: '#F3F4F6',
    marginLeft: -14,
  },
  budgetSuffixText: {
    fontSize: 16,
    fontFamily: 'HelveticaMedium',
    color: '#6B7280',
  },
  // Urgency selector
  urgencySelector: {
    flexDirection: 'row',
    gap: 8,
  },
  urgencyOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#F3F4F6',
  },
  urgencyOptionText: {
    fontSize: 11,
    fontFamily: 'HelveticaMedium',
    color: '#9CA3AF',
    textTransform: 'uppercase',
  },
  submitButtonSimple: {
    flexDirection: 'row',
    backgroundColor: '#111827',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonTextSimple: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
  },
  brandScrollView: {
    marginHorizontal: -18,
    paddingHorizontal: 18,
  },
  brandChipsContainer: {
    flexDirection: 'row',
    gap: 6,
    paddingRight: 18,
  },
  brandChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: '#F3F4F6',
  },
  brandChipActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  brandChipText: {
    fontSize: 13,
    fontFamily: 'HelveticaMedium',
    color: '#6B7280',
  },
  brandChipTextActive: {
    color: '#FFFFFF',
  },
  // Offer Request Info
  offerRequestInfo: {
    backgroundColor: '#F9FAFB',
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  offerRequestTitle: {
    fontSize: 16,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  offerRequestVehicle: {
    fontSize: 13,
    fontFamily: 'HelveticaMedium',
    color: '#6B7280',
    marginBottom: 4,
  },
  offerRequestBudget: {
    fontSize: 13,
    fontFamily: 'HelveticaMedium',
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
    marginHorizontal: 20,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
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
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
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
    fontFamily: 'HelveticaMedium',
    color: '#FFFFFF',
    fontWeight: '700',
  },
  conversationInfo: {
    flex: 1,
    gap: 4,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  conversationPartnerName: {
    fontSize: 15,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: '#111827',
    fontWeight: '700',
    flex: 1,
  },
  conversationTime: {
    fontSize: 11,
    fontFamily: 'HelveticaMedium',
    color: '#9CA3AF',
    fontWeight: '500',
    marginLeft: 8,
  },
  conversationVehicleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  conversationVehicleText: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
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
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    color: '#6B7280',
    fontWeight: '600',
  },
  conversationLastMessage: {
    fontSize: 13,
    fontFamily: 'HelveticaMedium',
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
    gap: 4,
    marginTop: 2,
  },
  conversationRequestTitleText: {
    fontSize: 11,
    fontFamily: 'HelveticaMedium',
    color: '#9CA3AF',
    fontWeight: '500',
    flex: 1,
  },
  conversationArrow: {
    width: 28,
    height: 28,
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
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: '#111827',
    textAlign: 'center',
    fontWeight: '600',
  },
  chatsEmptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
    gap: 12,
  },
  chatsEmptyTitle: {
    fontSize: 16,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: '#111827',
    textAlign: 'center',
    fontWeight: '700',
  },
  chatsEmptySubtitle: {
    fontSize: 13,
    fontFamily: 'HelveticaMedium',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '500',
  },
  // Picker Modal
  pickerModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
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
    backgroundColor: '#F3F4F6',
  },
  pickerOptionText: {
    fontSize: 15,
    fontFamily: 'HelveticaMedium',
    fontWeight: '500',
    color: '#111827',
  },
  pickerOptionTextSelected: {
    color: '#111827',
    fontWeight: '700',
  },
  // Inline Picker Overlay (inside modal)
  inlinePickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
    zIndex: 100,
  },
  inlinePickerContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  // Dropdown Button
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  dropdownButtonDisabled: {
    opacity: 0.5,
  },
  dropdownButtonText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    color: '#9CA3AF',
  },
  dropdownButtonTextSelected: {
    color: '#111827',
    fontWeight: '600',
  },
});
