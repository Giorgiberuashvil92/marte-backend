import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useUser } from '@/contexts/UserContext';
import { messagesApi, type RecentChat } from '@/services/messagesApi';
import { requestsApi } from '@/services/requestsApi';
import API_BASE_URL from '@/config/api';

type ConversationItem = RecentChat & {
  partnerName?: string;
  requestTitle?: string;
  lastSenderName?: string;
  offerPriceGEL?: number;
  offerEtaMin?: number;
  partnerPhone?: string;
};

export default function ChatsTabScreen() {
  const { user } = useUser();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchConversations = useCallback(async (silent = false) => {
    if (!user?.id) return;
    if (!silent) setLoading(true);
    try {
      const recentChats = await messagesApi.getRecentChats(user.id);
      const enriched = await Promise.all(
        recentChats.map(async (chat) => {
          try {
            const request = await requestsApi.getRequestById(chat.requestId);
            const offers = await requestsApi.getOffers(chat.requestId);
            const partnerOffer = offers.find(o => o.partnerId === chat.partnerId) || offers[0];
            const messages = await messagesApi.getChatHistory(chat.requestId, chat.partnerId);
            const lastMessage = messages[messages.length - 1];
            let lastSenderName = '';
            if (lastMessage) {
              lastSenderName = lastMessage.sender === 'user'
                ? (user?.name || 'თქვენ')
                : (partnerOffer?.providerName || 'მაღაზია');
            }
            let partnerPhone: string | undefined;
            try {
              const res = await fetch(`${API_BASE_URL}/users/${chat.partnerId}`, {
                headers: { 'x-user-id': user.id, 'Content-Type': 'application/json' },
              });
              if (res.ok) {
                const data = await res.json();
                partnerPhone = data?.data?.phone;
              }
            } catch {
              /* ignore */
            }
            let lastMessageAtNorm: number | undefined;
            if (chat.lastMessageAt != null) {
              const t = typeof chat.lastMessageAt === 'number'
                ? chat.lastMessageAt
                : new Date(chat.lastMessageAt as any).getTime();
              if (Number.isFinite(t)) lastMessageAtNorm = t;
            }

            return {
              ...chat,
              lastMessageAt: lastMessageAtNorm,
              partnerName: partnerOffer?.providerName || 'მაღაზია',
              requestTitle: request?.partName || 'ნაწილის მოთხოვნა',
              lastSenderName,
              offerPriceGEL: partnerOffer?.priceGEL,
              offerEtaMin: partnerOffer?.etaMin,
              partnerPhone,
            } as ConversationItem;
          } catch {
            return { ...chat, partnerName: 'მაღაზია', requestTitle: 'ნაწილის მოთხოვნა', lastSenderName: '' } as ConversationItem;
          }
        })
      );
      setConversations(enriched);
    } catch {
      setConversations([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchConversations(false);
  }, [fetchConversations]);

  const isFirstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (isFirstFocus.current) {
        isFirstFocus.current = false;
        return;
      }
      if (user?.id) fetchConversations(true);
    }, [user?.id, fetchConversations]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchConversations();
    setTimeout(() => setRefreshing(false), 800);
  };

  const formatTime = (timestamp?: number | string | Date) => {
    if (timestamp == null) return '';
    const t = typeof timestamp === 'number'
      ? timestamp
      : typeof timestamp === 'string'
        ? new Date(timestamp).getTime()
        : timestamp instanceof Date
          ? timestamp.getTime()
          : NaN;
    if (!Number.isFinite(t)) return '';
    const diff = Date.now() - t;
    if (diff < 60000) return 'ახლა';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} წუთი`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} სთ`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)} დღე`;
    return new Date(t).toLocaleDateString('ka-GE', { day: 'numeric', month: 'short' });
  };

  const handleConversationPress = (c: ConversationItem) => {
    const reqId = String(c.requestId ?? '');
    const partId = String(c.partnerId ?? '');
    if (!reqId || !partId) return;
    router.push(`/chat/${reqId}/${partId}` as any);
  };

  const handleCall = (c: ConversationItem) => {
    const phone = c.partnerPhone?.replace(/\s/g, '') || '';
    const tel = phone.startsWith('+') ? phone : `+995${phone.replace(/^995/, '')}`;
    const url = `tel:${tel}`;
    Linking.canOpenURL(url).then((ok) => {
      if (ok) Linking.openURL(url);
      else Alert.alert('შეცდომა', 'ტელეფონზე დარეკვა ვერ მოხერხდა');
    }).catch(() => Alert.alert('შეცდომა', 'ტელეფონზე დარეკვა ვერ მოხერხდა'));
  };

  const getUnreadCount = (c: ConversationItem) => {
    if (c.userId === user?.id) return c.unreadCounts?.user || 0;
    return c.unreadCounts?.partner || 0;
  };

  const getServiceFromTitle = (title?: string): 'parts' | 'mechanic' | 'tow' | 'rental' => {
    const t = (title || '').toLowerCase();
    if (/ბრეიკ|ლამპ|ფარ|ძრავ|ჰაერ|ფილტრ/.test(t)) return 'parts';
    if (/შემოწმებ|რემონტ|დიაგნოსტ/.test(t)) return 'mechanic';
    if (/ევაკუაცია|ევაკუატორ/.test(t)) return 'tow';
    if (/ქირაობა|rental/.test(t)) return 'rental';
    return 'parts';
  };

  const getServiceColor = (service: string) => {
    switch (service) {
      case 'parts': return '#10B981';
      case 'mechanic': return '#3B82F6';
      case 'tow': return '#F59E0B';
      case 'rental': return '#8B5CF6';
      default: return '#3B82F6';
    }
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

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent />

        <View style={styles.topBar}>
          <SafeAreaView edges={['top']}>
            <View style={styles.topBarContent}>
              <TouchableOpacity
                style={styles.topBarButton}
                onPress={() => router.back()}
                activeOpacity={0.7}
              >
                <FontAwesome name="arrow-left" size={18} color="#111827" />
              </TouchableOpacity>
              <Text style={styles.topBarTitle}>ჩატები</Text>
              <View style={styles.topBarRight}>
                <View style={styles.topBarCountBadge}>
                  <Text style={styles.topBarCountText}>{conversations.length}</Text>
                </View>
              </View>
            </View>
          </SafeAreaView>
        </View>

        <View style={styles.refreshRow}>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={() => onRefresh()}
            disabled={refreshing}
            activeOpacity={0.7}
          >
            <FontAwesome
              name="refresh"
              size={14}
              color={refreshing ? '#9CA3AF' : '#111827'}
            />
            <Text style={[styles.refreshButtonText, refreshing && styles.refreshButtonTextDisabled]}>
              ჩატების განახლება
            </Text>
          </TouchableOpacity>
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
          {loading && conversations.length === 0 ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color="#111827" />
              <Text style={styles.loadingText}>ჩატების ჩატვირთვა...</Text>
            </View>
          ) : conversations.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <FontAwesome name="comments" size={48} color="#6B7280" />
              </View>
              <Text style={styles.emptyTitle}>ჩატები ჯერ არ არის</Text>
              <Text style={styles.emptySubtitle}>
                როცა შეთავაზებებს მიიღებთ და დაიწყებთ მიწერ-მოწერას, ჩატები აქ გამოჩნდება
              </Text>
            </View>
          ) : (
            <View style={styles.listWrap}>
{conversations.map((c) => {
                const unread = getUnreadCount(c);
                const service = getServiceFromTitle(c.requestTitle);
                const accent = getServiceColor(service);
                const timeStr = c.lastMessageAt ? formatTime(c.lastMessageAt) : '';
                const isNow = timeStr === 'ახლა';
                return (
                  <TouchableOpacity
                    key={c._id || `${c.requestId}-${c.partnerId}`}
                    style={[
                      styles.chatCard,
                      { borderLeftWidth: 3, borderLeftColor: accent },
                      unread > 0 && styles.chatCardUnread,
                    ]}
                    onPress={() => handleConversationPress(c)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.avatarWrap, { backgroundColor: `${accent}22` }]}>
                      <Ionicons name={getServiceIcon(service) as any} size={24} color={accent} />
                    </View>
                    <View style={styles.chatInfo}>
                      <View style={styles.chatRow}>
                        <Text style={styles.chatName} numberOfLines={1}>
                          {c.partnerName || 'მაღაზია'}
                        </Text>
                        {timeStr ? (
                          <Text style={[styles.chatTime, isNow && { color: accent, fontWeight: '700' }]}>
                            {timeStr}
                          </Text>
                        ) : null}
                      </View>
                      <View style={styles.chatRow}>
                        <View style={styles.lastMessageRow}>
                          {c.lastSenderName ? (
                            <Text style={styles.senderName} numberOfLines={1}>
                              {c.lastSenderName}:{' '}
                            </Text>
                          ) : null}
                          <Text
                            style={[styles.lastMessage, unread > 0 && styles.lastMessageUnread]}
                            numberOfLines={1}
                          >
                            {c.lastMessage || 'შეტყობინება არ არის'}
                          </Text>
                        </View>
                        {unread > 0 && (
                          <View style={styles.unreadBadge}>
                            <Text style={styles.unreadText}>{unread > 99 ? '99+' : unread}</Text>
                          </View>
                        )}
                      </View>
                      {(c.requestTitle || c.offerPriceGEL != null || c.offerEtaMin != null) && (
                        <View style={styles.requestTitleRow}>
                          {c.requestTitle ? (
                            <>
                              <FontAwesome name="cube" size={12} color="#6B7280" />
                              <Text style={styles.requestTitle} numberOfLines={1}>
                                {c.requestTitle}
                              </Text>
                            </>
                          ) : null}
                          {(c.offerPriceGEL != null || c.offerEtaMin != null) && (
                            <Text style={[styles.priceText, { color: accent }]}>
                              {c.requestTitle ? ' · ' : ''}
                              {c.offerPriceGEL != null ? `${c.offerPriceGEL}₾` : ''}
                              {c.offerPriceGEL != null && c.offerEtaMin != null ? ' · ' : ''}
                              {c.offerEtaMin != null ? `${c.offerEtaMin} წთ` : ''}
                            </Text>
                          )}
                        </View>
                      )}
                    </View>
                    <TouchableOpacity
                      style={[styles.callButton, c.partnerPhone && { backgroundColor: `${accent}20` }]}
                      onPress={(e) => { e.stopPropagation(); handleCall(c); }}
                      disabled={!c.partnerPhone}
                      activeOpacity={0.7}
                    >
                      <FontAwesome
                        name="phone"
                        size={18}
                        color={c.partnerPhone ? accent : '#9CA3AF'}
                      />
                    </TouchableOpacity>
                    <Ionicons name="chevron-forward" size={18} color={accent} />
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
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  topBarCountBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  topBarCountText: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    fontWeight: '700',
    color: '#FFFFFF',
  },
  refreshRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  refreshButtonText: {
    fontSize: 13,
    fontFamily: 'HelveticaMedium',
    color: '#111827',
    fontWeight: '600',
  },
  refreshButtonTextDisabled: {
    color: '#9CA3AF',
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
    gap: 12,
  },
  chatCardUnread: {
    backgroundColor: '#F9FAFB',
  },
  avatarWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#E5E7EB',
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
  lastMessageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  senderName: {
    fontSize: 13,
    fontFamily: 'HelveticaMedium',
    color: '#6B7280',
    fontWeight: '600',
  },
  lastMessage: {
    fontSize: 13,
    fontFamily: 'HelveticaMedium',
    color: '#6B7280',
    fontWeight: '500',
    flex: 1,
  },
  lastMessageUnread: {
    color: '#111827',
    fontWeight: '700',
  },
  requestTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  requestTitle: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: '#9CA3AF',
    fontWeight: '500',
    flex: 1,
  },
  priceText: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    color: '#6B7280',
    fontWeight: '600',
  },
  callButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadge: {
    backgroundColor: '#DC2626',
    borderRadius: 12,
    minWidth: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 2,
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
