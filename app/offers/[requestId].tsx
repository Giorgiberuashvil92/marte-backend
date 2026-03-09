import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Animated,
  Dimensions,
  StatusBar,
  RefreshControl,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { requestsApi, type Request, type Offer } from '@/services/requestsApi';
import { useUser } from '@/contexts/UserContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { messagesApi, type ChatMessage } from '@/services/messagesApi';
import { socketService } from '@/services/socketService';

const { width } = Dimensions.get('window');

export default function OffersScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [request, setRequest] = useState<Request | null>(null);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(30));
  const [expandedChatOfferId, setExpandedChatOfferId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<Record<string, ChatMessage[]>>({});
  const [newChatMessage, setNewChatMessage] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchData();
    
    // Setup socket for chat
    if (user?.id && requestId) {
      socketService.connect(user.id);
      socketService.joinChat(requestId, user.id);
      
      // Listen for new messages
      socketService.onMessage((message: ChatMessage) => {
        setChatMessages(prev => {
          const offerId = message.partnerId || message.userId;
          const existing = prev[offerId] || [];
          return {
            ...prev,
            [offerId]: [...existing, message],
          };
        });
      });
      
      // Load chat history for each offer
      const loadChatHistory = async () => {
        try {
          const history = await messagesApi.getChatHistory(requestId);
          const grouped: Record<string, ChatMessage[]> = {};
          history.forEach((msg: ChatMessage) => {
            const offerId = msg.partnerId || msg.userId;
            if (!grouped[offerId]) grouped[offerId] = [];
            grouped[offerId].push(msg);
          });
          setChatMessages(grouped);
        } catch (error) {
          console.error('Failed to load chat history:', error);
        }
      };
      loadChatHistory();
    }
    
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
    
    return () => {
      socketService.disconnect();
    };
  }, [requestId, user?.id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [requestData, offersData] = await Promise.all([
        requestsApi.getRequestById(requestId || '1'),
        requestsApi.getOffers(requestId || '1')
      ]);
      setRequest(requestData);
      
      const isRequestOwner = user?.id && requestData.userId === user.id;
      if (isRequestOwner) {
        setOffers(offersData);
      } else {
        setOffers([]);
      }
    } catch (error) {
      console.error('Failed to fetch from API:', error);
      setRequest(null);
      setOffers([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const handleOfferPress = (offer: Offer) => {
    if (expandedChatOfferId === offer.id) {
      setExpandedChatOfferId(null);
    } else {
      setExpandedChatOfferId(offer.id);
    }
  };

  /** ჩატის ეკრანზე გადასვლა ამ შეთავაზების პარტნიორთან */
  const handleOpenChat = (offer: Offer) => {
    if (!requestId) return;
    const partnerId = offer.partnerId || offer.userId;
    if (!partnerId) return;
    router.push(`/chat/${requestId}/${partnerId}`);
  };
  
  const handleSendChatMessage = async (offer: Offer) => {
    const messageText = newChatMessage[offer.id]?.trim();
    if (!messageText || !requestId || !user?.id) return;
    
    const partnerId = offer.partnerId || offer.userId;
    const sender: 'user' | 'partner' = request?.userId === user.id ? 'user' : 'partner';
    
    try {
      await messagesApi.createMessage({
        requestId,
        userId: request?.userId || user.id,
        partnerId: partnerId || '',
        sender,
        message: messageText,
      });
      
      setNewChatMessage(prev => ({ ...prev, [offer.id]: '' }));
      socketService.sendMessage(requestId, messageText);
    } catch (error) {
      console.error('Error sending chat message:', error);
    }
  };

  const getTimeAgo = (dateStr: string | number) => {
    const now = Date.now();
    const date = new Date(dateStr).getTime();
    const diff = now - date;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'ახლახანს';
    if (mins < 60) return `${mins} წთ წინ`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} სთ წინ`;
    const days = Math.floor(hrs / 24);
    return `${days} დღის წინ`;
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#111827" />
            <Text style={styles.loadingText}>იტვირთება...</Text>
          </View>
        </SafeAreaView>
      </>
    );
  }

  if (!request) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
          <View style={styles.header}>
            <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={22} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>შეთავაზებები</Text>
            <TouchableOpacity
              style={styles.headerChatsBtn}
              onPress={() => router.push('/chats')}
              activeOpacity={0.7}
            >
              <Ionicons name="chatbubbles-outline" size={18} color="#111827" />
              <Text style={styles.headerChatsBtnText}>ჩატები</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="document-text-outline" size={40} color="#9CA3AF" />
            </View>
            <Text style={styles.emptyTitle}>განცხადება ვერ მოიძებნა</Text>
            <Text style={styles.emptySubtitle}>
              შესაძლოა განცხადება წაშლილია ან არ არსებობს
            </Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => router.back()}>
              <Text style={styles.emptyBtnText}>უკან დაბრუნება</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </>
    );
  }

  const isMyRequest = user?.id && request.userId === user.id;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>შეთავაზებები</Text>
          <View style={styles.headerRight}>
            <View style={styles.headerCountBadge}>
              <Text style={styles.headerCountText}>{offers.length}</Text>
            </View>
            <TouchableOpacity
              style={styles.headerChatsBtn}
              onPress={() => router.push('/chats')}
              activeOpacity={0.7}
            >
              <Ionicons name="chatbubbles-outline" size={18} color="#111827" />
              <Text style={styles.headerChatsBtnText}>ჩატები</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView 
          style={styles.scrollView} 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#111827"
              colors={['#111827']}
            />
          }
        >
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

            {/* Request Summary Card */}
            <View style={styles.requestCard}>
              <View style={styles.requestCardHeader}>
                <View style={styles.requestIconCircle}>
                  <Ionicons name="construct" size={22} color="#111827" />
                </View>
                <View style={styles.requestCardInfo}>
                  <Text style={styles.requestCardTitle} numberOfLines={1}>{request.partName}</Text>
                  <View style={styles.requestCardMeta}>
                    <Ionicons name="car-sport-outline" size={13} color="#6B7280" />
                    <Text style={styles.requestCardMetaText}>
                      {request.vehicle.make} {request.vehicle.model} ({request.vehicle.year})
                    </Text>
                  </View>
                </View>
              </View>

              {request.description && (
                <View style={styles.requestDescBox}>
                  <Text style={styles.requestDescText} numberOfLines={2}>{request.description}</Text>
                </View>
              )}

              <View style={styles.requestChipsRow}>
                {request.location && (
                  <View style={styles.requestChip}>
                    <Ionicons name="location-outline" size={12} color="#6B7280" />
                    <Text style={styles.requestChipText}>{request.location}</Text>
                  </View>
                )}
                {request.budgetGEL && (
                  <View style={[styles.requestChip, { backgroundColor: '#ECFDF5', borderColor: '#D1FAE5' }]}>
                    <Ionicons name="cash-outline" size={12} color="#059669" />
                    <Text style={[styles.requestChipText, { color: '#059669' }]}>
                      {request.budgetGEL} ₾
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Restricted View (not owner) */}
            {user?.id && request && request.userId !== user.id ? (
              <View style={styles.restrictedCard}>
                <View style={styles.restrictedIconCircle}>
                  <Ionicons name="lock-closed" size={32} color="#9CA3AF" />
                </View>
                <Text style={styles.restrictedTitle}>შეთავაზებები დაფარულია</Text>
                <Text style={styles.restrictedSubtitle}>
                  შეთავაზებების ნახვა მხოლოდ მოთხოვნის მფლობელს შეუძლია
                </Text>
              </View>
            ) : (
              <>
                {/* Section Title */}
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>მიღებული შეთავაზებები</Text>
                  <Text style={styles.sectionCount}>{offers.length} შეთავაზება</Text>
                </View>

                {/* Offers List */}
                {offers.length === 0 ? (
                  <View style={styles.emptyOffersCard}>
                    <View style={styles.emptyOffersIcon}>
                      <Ionicons name="chatbubbles-outline" size={36} color="#9CA3AF" />
                    </View>
                    <Text style={styles.emptyOffersTitle}>ჯერ არ არის შეთავაზებები</Text>
                    <Text style={styles.emptyOffersSubtitle}>
                      მაღაზიები მალე გამოგიგზავნიან შეთავაზებებს
                    </Text>
                  </View>
                ) : (
                  offers.map((offer, index) => {
                    const price = (offer as any)?.price ?? (offer as any)?.priceGEL;
                    const description = (offer as any)?.description ?? '';
                    const estimatedTime = offer.etaMin ? `${offer.etaMin} წთ` : undefined;
                    const location = (offer as any)?.location ?? request.location;
                    const warranty = (offer as any)?.warranty;
                    const isMyOffer = user?.id && (
                      offer.userId === user.id || 
                      offer.partnerId === user.id ||
                      String(offer.userId) === String(user.id) ||
                      String(offer.partnerId) === String(user.id)
                    );
                    const isChatOpen = expandedChatOfferId === offer.id;

                    return (
                      <View key={offer.id} style={styles.offerCard}>
                        <Pressable onPress={() => handleOfferPress(offer)}>
                          {/* Offer Header */}
                          <View style={styles.offerHeader}>
                            <View style={styles.offerAvatarCircle}>
                              <Ionicons name="storefront-outline" size={20} color="#111827" />
                            </View>
                            <View style={styles.offerHeaderInfo}>
                              <View style={styles.offerNameRow}>
                                <Text style={styles.offerProviderName} numberOfLines={1}>
                                  {offer.providerName}
                                </Text>
                                {isMyOffer && (
                                  <View style={styles.myBadge}>
                                    <Ionicons name="checkmark-circle" size={12} color="#059669" />
                                    <Text style={styles.myBadgeText}>ჩემგან</Text>
                                  </View>
                                )}
                              </View>
                              <Text style={styles.offerTimeAgo}>
                                {offer.createdAt ? getTimeAgo(offer.createdAt) : ''}
                              </Text>
                            </View>
                            <View style={styles.offerPriceBadge}>
                              <Text style={styles.offerPriceText}>{price ?? '—'} ₾</Text>
                            </View>
                          </View>

                          {/* Offer Description */}
                          {description ? (
                            <View style={styles.offerDescBox}>
                              <Text style={styles.offerDescText} numberOfLines={3}>
                                {description}
                              </Text>
                            </View>
                          ) : null}

                          {/* Offer Meta */}
                          <View style={styles.offerMetaRow}>
                            {estimatedTime && (
                              <View style={styles.offerMetaChip}>
                                <Ionicons name="time-outline" size={13} color="#6B7280" />
                                <Text style={styles.offerMetaText}>{estimatedTime}</Text>
                              </View>
                            )}
                            {location && (
                              <View style={styles.offerMetaChip}>
                                <Ionicons name="location-outline" size={13} color="#6B7280" />
                                <Text style={styles.offerMetaText}>{location}</Text>
                              </View>
                            )}
                            {warranty && (
                              <View style={styles.offerMetaChip}>
                                <Ionicons name="shield-checkmark-outline" size={13} color="#6B7280" />
                                <Text style={styles.offerMetaText}>{warranty} გარანტია</Text>
                              </View>
                            )}
                          </View>

                          {/* მიწერა → ჩატის ეკრანზე გადასვლა */}
                          <TouchableOpacity 
                            style={styles.chatToggleBtn}
                            onPress={() => handleOpenChat(offer)}
                            activeOpacity={0.7}
                          >
                            <Ionicons 
                              name="chatbubbles-outline" 
                              size={16} 
                              color="#111827" 
                            />
                            <Text style={styles.chatToggleBtnText}>მიწერა</Text>
                          </TouchableOpacity>
                        </Pressable>

                        {/* Chat Section */}
                        {isChatOpen && (
                          <View style={styles.chatSection}>
                            <View style={styles.chatDivider} />
                            
                            <ScrollView 
                              style={styles.chatMessagesContainer}
                              contentContainerStyle={styles.chatMessagesContent}
                              showsVerticalScrollIndicator={false}
                            >
                              {(chatMessages[offer.id] || []).length === 0 && (
                                <View style={styles.chatEmpty}>
                                  <Ionicons name="chatbubble-ellipses-outline" size={24} color="#D1D5DB" />
                                  <Text style={styles.chatEmptyText}>ჯერ არ არის შეტყობინებები</Text>
                                </View>
                              )}
                              {(chatMessages[offer.id] || []).map((msg) => {
                                const isMyMessage = (request?.userId === user?.id && msg.sender === 'user') ||
                                  (offer.partnerId === user?.id && msg.sender === 'partner');
                                
                                return (
                                  <View
                                    key={msg.id}
                                    style={[
                                      styles.chatBubble,
                                      isMyMessage ? styles.chatBubbleMy : styles.chatBubbleOther,
                                    ]}
                                  >
                                    <Text style={[
                                      styles.chatBubbleText,
                                      isMyMessage ? styles.chatBubbleTextMy : styles.chatBubbleTextOther,
                                    ]}>
                                      {msg.message}
                                    </Text>
                                    <Text style={[
                                      styles.chatBubbleTime,
                                      isMyMessage ? styles.chatBubbleTimeMy : styles.chatBubbleTimeOther,
                                    ]}>
                                      {new Date(msg.timestamp).toLocaleTimeString('ka-GE', { 
                                        hour: '2-digit', 
                                        minute: '2-digit' 
                                      })}
                                    </Text>
                                  </View>
                                );
                              })}
                            </ScrollView>
                            
                            <KeyboardAvoidingView
                              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                              style={styles.chatInputRow}
                            >
                              <TextInput
                                style={styles.chatInput}
                                placeholder="დაწერე შეტყობინება..."
                                placeholderTextColor="#9CA3AF"
                                value={newChatMessage[offer.id] || ''}
                                onChangeText={(text) => setNewChatMessage(prev => ({ ...prev, [offer.id]: text }))}
                                multiline
                              />
                              <TouchableOpacity
                                style={styles.chatSendBtn}
                                onPress={() => handleSendChatMessage(offer)}
                                activeOpacity={0.7}
                              >
                                <Ionicons name="send" size={18} color="#FFFFFF" />
                              </TouchableOpacity>
                            </KeyboardAvoidingView>
                          </View>
                        )}
                      </View>
                    );
                  })
                )}
              </>
            )}
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    color: '#6B7280',
    textTransform: 'uppercase',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontFamily: 'HelveticaMedium',
    color: '#111827',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerCountBadge: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerChatsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
  },
  headerChatsBtnText: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    color: '#111827',
  },
  headerCountText: {
    fontSize: 16,
    fontFamily: 'HelveticaMedium',
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'HelveticaMedium',
    color: '#111827',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyBtn: {
    marginTop: 20,
    backgroundColor: '#111827',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
  },
  emptyBtnText: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },

  // Scroll
  scrollView: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    gap: 16,
  },

  // Request Summary Card
  requestCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  requestCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  requestIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestCardInfo: {
    flex: 1,
    gap: 4,
  },
  requestCardTitle: {
    fontSize: 17,
    fontFamily: 'HelveticaMedium',
    color: '#111827',
    fontWeight: '700',
  },
  requestCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  requestCardMetaText: {
    fontSize: 13,
    fontFamily: 'HelveticaMedium',
    color: '#6B7280',
  },
  requestDescBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  requestDescText: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    color: '#374151',
    lineHeight: 22,
  },
  requestChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  requestChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  requestChipText: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    color: '#6B7280',
  },

  // Restricted
  restrictedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  restrictedIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  restrictedTitle: {
    fontSize: 16,
    fontFamily: 'HelveticaMedium',
    color: '#111827',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  restrictedSubtitle: {
    fontSize: 13,
    fontFamily: 'HelveticaMedium',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },

  // Section Header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    color: '#111827',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionCount: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    color: '#9CA3AF',
    textTransform: 'uppercase',
  },

  // Empty Offers
  emptyOffersCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  emptyOffersIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyOffersTitle: {
    fontSize: 16,
    fontFamily: 'HelveticaMedium',
    color: '#111827',
    textTransform: 'uppercase',
  },
  emptyOffersSubtitle: {
    fontSize: 13,
    fontFamily: 'HelveticaMedium',
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
  },

  // Offer Card
  offerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  offerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  offerAvatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  offerHeaderInfo: {
    flex: 1,
    gap: 2,
  },
  offerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  offerProviderName: {
    fontSize: 15,
    fontFamily: 'HelveticaMedium',
    color: '#111827',
    fontWeight: '700',
    flex: 1,
  },
  myBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  myBadgeText: {
    fontSize: 10,
    fontFamily: 'HelveticaMedium',
    color: '#059669',
    textTransform: 'uppercase',
  },
  offerTimeAgo: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    color: '#9CA3AF',
  },
  offerPriceBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  offerPriceText: {
    fontSize: 16,
    fontFamily: 'HelveticaMedium',
    color: '#059669',
    fontWeight: '700',
  },

  // Offer Description
  offerDescBox: {
    marginTop: 14,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  offerDescText: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    color: '#374151',
    lineHeight: 22,
  },

  // Offer Meta
  offerMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  offerMetaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  offerMetaText: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    color: '#6B7280',
  },

  // Chat Toggle
  chatToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    paddingVertical: 12,
  },
  chatToggleBtnText: {
    fontSize: 13,
    fontFamily: 'HelveticaMedium',
    color: '#111827',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  // Chat Section
  chatSection: {
    marginTop: 0,
  },
  chatDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginTop: 16,
    marginBottom: 12,
  },
  chatMessagesContainer: {
    maxHeight: 250,
  },
  chatMessagesContent: {
    gap: 8,
    paddingVertical: 4,
  },
  chatEmpty: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  chatEmptyText: {
    fontSize: 13,
    fontFamily: 'HelveticaMedium',
    color: '#9CA3AF',
  },
  chatBubble: {
    padding: 12,
    borderRadius: 16,
    maxWidth: '80%',
  },
  chatBubbleMy: {
    alignSelf: 'flex-end',
    backgroundColor: '#111827',
    borderBottomRightRadius: 4,
  },
  chatBubbleOther: {
    alignSelf: 'flex-start',
    backgroundColor: '#F3F4F6',
    borderBottomLeftRadius: 4,
  },
  chatBubbleText: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    lineHeight: 20,
  },
  chatBubbleTextMy: {
    color: '#FFFFFF',
  },
  chatBubbleTextOther: {
    color: '#111827',
  },
  chatBubbleTime: {
    fontSize: 10,
    fontFamily: 'HelveticaMedium',
    marginTop: 4,
  },
  chatBubbleTimeMy: {
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'right',
  },
  chatBubbleTimeOther: {
    color: '#9CA3AF',
  },

  // Chat Input
  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  chatInput: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    color: '#111827',
    maxHeight: 100,
  },
  chatSendBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
