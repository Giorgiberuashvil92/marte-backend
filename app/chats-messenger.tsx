import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
  Animated,
  Dimensions,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Stack } from 'expo-router';
import { useUser } from '@/contexts/UserContext';
import { messagesApi, type RecentChat } from '@/services/messagesApi';
import { requestsApi } from '@/services/requestsApi';

const { width } = Dimensions.get('window');

type ConversationItem = RecentChat & {
  partnerName?: string;
  requestTitle?: string;
  lastSenderName?: string;
  vehicleInfo?: string;
};

export default function ChatsMessengerScreen() {
  const { user } = useUser();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));

  useEffect(() => {
    fetchConversations();
    
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, [user?.id]);

  const fetchConversations = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      // Fetch recent chats
      const recentChats = await messagesApi.getRecentChats(user.id);
      
      // Enrich with request and offer data
      const enrichedConversations = await Promise.all(
        recentChats.map(async (chat) => {
          try {
            // Get request details
            const request = await requestsApi.getRequestById(chat.requestId);
            
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
                lastSenderName = user?.name || user?.firstName || 'თქვენ';
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
            return {
              ...chat,
              partnerName: 'მაღაზია',
              requestTitle: 'ნაწილის მოთხოვნა',
              lastSenderName: '',
              vehicleInfo: '',
            } as ConversationItem;
          }
        })
      );
      
      setConversations(enrichedConversations);
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchConversations();
    setTimeout(() => setRefreshing(false), 1000);
  };

  const formatTime = (timestamp?: number) => {
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

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      <LinearGradient
        colors={['rgba(99, 102, 241, 0.1)', 'rgba(59, 130, 246, 0.05)', 'rgba(99, 102, 241, 0.1)']}
        style={styles.backgroundGradient}
      >
        <View style={styles.container}>
          {/* Header */}
          <Animated.View 
            style={[
              styles.header,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </Pressable>
            
            <Text style={styles.headerTitle}>ჩატები</Text>
            
            <Pressable style={styles.searchButton}>
              <Ionicons name="search" size={20} color="#FFFFFF" />
            </Pressable>
          </Animated.View>

          {/* Conversations List */}
          <ScrollView
            style={styles.conversationsContainer}
            contentContainerStyle={styles.conversationsContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#6366F1"
                colors={['#6366F1']}
              />
            }
          >
            {conversations.map((conversation, index) => {
              const unreadCount = getUnreadCount(conversation);
              
              return (
                <Animated.View
                  key={conversation._id || conversation.requestId}
                  style={[
                    styles.conversationWrapper,
                    {
                      opacity: fadeAnim,
                      transform: [
                        { 
                          translateY: slideAnim.interpolate({
                            inputRange: [0, 50],
                            outputRange: [0, 20 + (index * 10)],
                            extrapolate: 'clamp',
                          })
                        }
                      ]
                    }
                  ]}
                >
                  <Pressable
                    style={styles.conversationCard}
                    onPress={() => handleConversationPress(conversation)}
                  >
                    <LinearGradient
                      colors={['rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.05)']}
                      style={styles.conversationGradient}
                    >
                      <View style={styles.conversationContent}>
                        {/* Avatar */}
                        <View style={styles.avatarContainer}>
                          <View style={styles.avatar}>
                            <Ionicons 
                              name="storefront-outline" 
                              size={24} 
                              color="#6366F1" 
                            />
                          </View>
                          {unreadCount > 0 && (
                            <View style={styles.unreadIndicator}>
                              <Text style={styles.unreadIndicatorText}>
                                {unreadCount > 99 ? '99+' : unreadCount}
                              </Text>
                            </View>
                          )}
                        </View>

                        {/* Conversation Info */}
                        <View style={styles.conversationInfo}>
                          <View style={styles.conversationHeader}>
                            <Text style={styles.partnerName} numberOfLines={1}>
                              {conversation.partnerName || 'მაღაზია'}
                            </Text>
                            {conversation.lastMessageAt && (
                              <Text style={styles.conversationTime}>
                                {formatTime(conversation.lastMessageAt)}
                              </Text>
                            )}
                          </View>
                          
                          {/* Vehicle Info */}
                          {conversation.vehicleInfo && (
                            <View style={styles.vehicleInfoContainer}>
                              <Ionicons name="car-outline" size={12} color="rgba(255, 255, 255, 0.5)" />
                              <Text style={styles.vehicleInfoText} numberOfLines={1}>
                                {conversation.vehicleInfo}
                              </Text>
                            </View>
                          )}
                          
                          <View style={styles.conversationFooter}>
                            <View style={styles.lastMessageContainer}>
                              {conversation.lastSenderName && (
                                <Text style={styles.senderName}>
                                  {conversation.lastSenderName}:
                                </Text>
                              )}
                              <Text 
                                style={[
                                  styles.lastMessage,
                                  unreadCount > 0 && styles.lastMessageUnread
                                ]} 
                                numberOfLines={1}
                              >
                                {conversation.lastMessage || 'შეტყობინება არ არის'}
                              </Text>
                            </View>
                          </View>
                          
                          {/* Request Title */}
                          {conversation.requestTitle && (
                            <View style={styles.requestTitleContainer}>
                              <Ionicons name="cube-outline" size={12} color="rgba(255, 255, 255, 0.5)" />
                              <Text style={styles.requestTitle} numberOfLines={1}>
                                {conversation.requestTitle}
                              </Text>
                            </View>
                          )}
                        </View>

                        {/* Arrow */}
                        <View style={styles.arrowContainer}>
                          <Ionicons name="chevron-forward" size={20} color="rgba(255, 255, 255, 0.4)" />
                        </View>
                      </View>
                    </LinearGradient>
                  </Pressable>
                </Animated.View>
              );
            })}
            
            {loading && conversations.length === 0 && (
              <Animated.View 
                style={[
                  styles.loadingState,
                  {
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }]
                  }
                ]}
              >
                <View style={styles.loadingIconContainer}>
                  <Ionicons name="hourglass-outline" size={32} color="#6366F1" />
                </View>
                <Text style={styles.loadingText}>ჩატების ჩატვირთვა...</Text>
              </Animated.View>
            )}
            
            {conversations.length === 0 && !loading && (
              <Animated.View 
                style={[
                  styles.emptyState,
                  {
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }]
                  }
                ]}
              >
                <View style={styles.emptyIconContainer}>
                  <Ionicons name="chatbubbles-outline" size={48} color="#6366F1" />
                </View>
                <Text style={styles.emptyTitle}>ჩატები ჯერ არ არის</Text>
                <Text style={styles.emptySubtitle}>
                  როცა შეთავაზებებს მიიღებთ და დაიწყებთ მიწერ-მოწერას, ჩატები აქ გამოჩნდება
                </Text>
              </Animated.View>
            )}
          </ScrollView>
        </View>
      </LinearGradient>
    </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  backgroundGradient: {
    flex: 1,
  },
  container: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(99, 102, 241, 0.2)',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  searchButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Conversations
  conversationsContainer: {
    flex: 1,
  },
  conversationsContent: {
    paddingVertical: 12,
    gap: 8,
  },
  conversationWrapper: {
    paddingHorizontal: 16,
  },
  conversationCard: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  conversationGradient: {
    padding: 16,
  },
  conversationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  unreadIndicator: {
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
    borderColor: '#0A0A0A',
  },
  unreadIndicatorText: {
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
  partnerName: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '700',
    flex: 1,
  },
  conversationTime: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: '500',
    marginLeft: 8,
  },
  vehicleInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  vehicleInfoText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '500',
    flex: 1,
  },
  conversationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  lastMessageContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  senderName: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '600',
  },
  lastMessage: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '400',
    flex: 1,
  },
  lastMessageUnread: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  requestTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  requestTitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: '500',
    flex: 1,
  },
  arrowContainer: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
    gap: 16,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 20,
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '500',
  },

  // Loading State
  loadingState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  loadingIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6366F1',
    textAlign: 'center',
    fontWeight: '600',
  },
});
