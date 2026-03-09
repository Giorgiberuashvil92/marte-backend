import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { useUser } from '@/contexts/UserContext';
import { requestsApi } from '@/services/requestsApi';

type Chat = {
  id: string;
  name: string;
  lastMessage: string;
  timestamp: number;
  unreadCount: number;
  avatar?: string;
  isOnline: boolean;
  service: 'parts' | 'mechanic' | 'tow' | 'rental';
};

export default function ChatsScreen() {
  const { user } = useUser();
  const [chats, setChats] = useState<(Chat & { requestId: string; partnerId: string })[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchChats();
  }, [user?.id]);

  const fetchChats = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const userRequests = await requestsApi.getRequests(user.id);
      const byConversation = new Map<string, Chat & { requestId: string; partnerId: string }>();
      for (const request of userRequests) {
        try {
          const offers = await requestsApi.getOffers(request.id);
          for (const offer of offers) {
            const partnerId = offer.partnerId ?? '';
            const key = `${request.id}-${partnerId}`;
            const existing = byConversation.get(key);
            const item: Chat & { requestId: string; partnerId: string } = {
              id: `chat-${key}`,
              name: offer.providerName || 'მაღაზია',
              lastMessage: `შეთავაზება: ${offer.priceGEL}₾ | ${offer.etaMin} წუთი`,
              timestamp: offer.updatedAt,
              unreadCount: offer.status === 'pending' ? 1 : 0,
              avatar: undefined,
              isOnline: Math.random() > 0.5,
              service: getServiceFromRequest(request) as 'parts' | 'mechanic' | 'tow' | 'rental',
              requestId: request.id,
              partnerId,
            };
            if (!existing || offer.updatedAt > existing.timestamp) {
              byConversation.set(key, item);
            }
          }
        } catch {
          /* skip */
        }
      }
      setChats(Array.from(byConversation.values()));
    } catch {
      setChats([]);
    } finally {
      setLoading(false);
    }
  };

  const getServiceFromRequest = (request: any) => {
    const partName = (request.partName || '').toLowerCase();
    if (/ბრეიკ|ლამპ|ფარ|ძრავ|ჰაერ|ფილტრ/.test(partName)) return 'parts';
    if (/შემოწმებ|რემონტ|დიაგნოსტ/.test(partName)) return 'mechanic';
    if (/ევაკუაცია|ევაკუატორ/.test(partName)) return 'tow';
    if (/ქირაობა|rental/.test(partName)) return 'rental';
    return 'parts';
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchChats();
    setTimeout(() => setRefreshing(false), 800);
  };

  const getServiceIcon = (service: string) => {
    switch (service) {
      case 'parts': return 'construct-outline';
      case 'mechanic': return 'build-outline';
      case 'tow': return 'car-outline';
      case 'rental': return 'car-sport-outline';
      default: return 'chatbubbles-outline';
    }
  };

  const getServiceColor = (service: string) => {
    switch (service) {
      case 'parts': return '#10B981';
      case 'mechanic': return '#3B82F6';
      case 'tow': return '#F59E0B';
      case 'rental': return '#8B5CF6';
      default: return '#111827';
    }
  };

  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    if (diff < 60000) return 'ახლა';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} წუთი`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} სთ`;
    return `${Math.floor(diff / 86400000)} დღე`;
  };

  const handleChatPress = (chat: Chat & { requestId: string; partnerId: string }) => {
    router.push(`/chat/${chat.requestId}/${chat.partnerId}` as any);
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent />

        {/* Top Bar */}
        <View style={styles.topBar}>
          <SafeAreaView edges={['top']}>
            <View style={styles.topBarContent}>
              <TouchableOpacity
                style={styles.topBarButton}
                onPress={() => router.back()}
                activeOpacity={0.7}
              >
                <Ionicons name="arrow-back" size={24} color="#111827" />
              </TouchableOpacity>
              <Text style={styles.topBarTitle}>ჩატები</Text>
              <View style={styles.topBarButton} />
            </View>
          </SafeAreaView>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#111827"
              colors={['#111827']}
            />
          }
        >
          {loading && chats.length === 0 ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color="#111827" />
              <Text style={styles.loadingText}>ჩატების ჩატვირთვა...</Text>
            </View>
          ) : chats.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="chatbubbles-outline" size={56} color="#6B7280" />
              </View>
              <Text style={styles.emptyTitle}>ჩატები ჯერ არ არის</Text>
              <Text style={styles.emptySubtitle}>
                როცა შეთავაზებებს მიიღებთ, ჩატები აქ გამოჩნდება
              </Text>
            </View>
          ) : (
            <View style={styles.listWrap}>
              {chats.map((chat) => {
                const serviceColor = getServiceColor(chat.service);
                const hasUnread = chat.unreadCount > 0;
                const isNow = Date.now() - chat.timestamp < 60000;
                // lastMessage ფორმატი: "შეთავაზება: 50₾ | 30 წუთი" – ფასი ფერად გამოვაჩინოთ
                const msgMatch = chat.lastMessage.match(/^შეთავაზება:\s*([\d.]+)₾\s*\|\s*(.+)$/);
                return (
                  <TouchableOpacity
                    key={chat.id}
                    style={[
                      styles.chatCard,
                      { borderLeftWidth: 4, borderLeftColor: serviceColor },
                      hasUnread && styles.chatCardUnread,
                    ]}
                    onPress={() => handleChatPress(chat)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.avatarWrap, { backgroundColor: `${serviceColor}22` }]}>
                      <Ionicons
                        name={getServiceIcon(chat.service) as any}
                        size={26}
                        color={serviceColor}
                      />
                    </View>
                    <View style={styles.chatInfo}>
                      <View style={styles.chatRow}>
                        <Text style={styles.chatName} numberOfLines={1}>{chat.name}</Text>
                        <Text style={[styles.chatTime, isNow && { color: serviceColor, fontWeight: '700' }]}>
                          {formatTime(chat.timestamp)}
                        </Text>
                      </View>
                      <View style={styles.chatRow}>
                        {msgMatch ? (
                          <Text style={styles.lastMessage} numberOfLines={1}>
                            <Text style={styles.lastMessageLabel}>შეთავაზება: </Text>
                            <Text style={[styles.lastMessagePrice, { color: serviceColor }]}>{msgMatch[1]}₾</Text>
                            <Text style={styles.lastMessageLabel}> | {msgMatch[2]}</Text>
                          </Text>
                        ) : (
                          <Text style={styles.lastMessage} numberOfLines={1}>{chat.lastMessage}</Text>
                        )}
                        {hasUnread && (
                          <View style={styles.unreadBadge}>
                            <Text style={styles.unreadText}>{chat.unreadCount > 99 ? '99+' : chat.unreadCount}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={22} color={serviceColor} />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  listWrap: {
    gap: 12,
  },
  chatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderLeftWidth: 4,
    borderLeftColor: '#E5E7EB',
    gap: 12,
  },
  chatCardUnread: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  avatarWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatInfo: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  chatName: {
    fontSize: 15,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#111827',
    flex: 1,
  },
  chatTime: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: '#6B7280',
    fontWeight: '500',
  },
  lastMessage: {
    fontSize: 13,
    fontFamily: 'HelveticaMedium',
    color: '#6B7280',
    fontWeight: '500',
    flex: 1,
  },
  lastMessageLabel: {
    color: '#6B7280',
    fontWeight: '500',
  },
  lastMessagePrice: {
    fontWeight: '700',
  },
  unreadBadge: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    fontSize: 11,
    fontFamily: 'HelveticaMedium',
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  loadingState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: '#6B7280',
    fontWeight: '500',
  },
});
