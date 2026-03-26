import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { useUser } from '../../contexts/UserContext';
import API_BASE_URL from '../../config/api';
import { triggerSubscriptionRefresh } from '../../services/subscriptionRefresh';
import {
  type NotificationType,
  type NotificationItem,
  type AnyObject,
  mapNotificationFromApi,
  getNotificationIcon,
  getIconPalette,
} from '../../utils/notificationTypes';
import {
  shouldNavigateToPartsRequests,
  shouldNavigateToExclusiveFuelOffer,
} from '../../utils/pushNavigation';

export default function NotificationsScreen() {
  const router = useRouter();
  const { user, setShouldOpenPremiumModal } = useUser();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread' | 'chat' | 'offer' | 'booking' | 'system'>('all');
  const [displayCount, setDisplayCount] = useState(20);

  const [refreshing, setRefreshing] = useState(false);

  const formatTimeAgo = (ts: number) => {
    const now = Date.now();
    const diff = Math.max(0, now - ts);
    const m = Math.floor(diff / (1000 * 60));
    const h = Math.floor(diff / (1000 * 60 * 60));
    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (m < 1) return 'ახლა';
    if (m < 60) return `${m} წთ წინ`;
    if (h < 24) return `${h} სთ წინ`;
    if (d < 7) return `${d} დღე წინ`;
    if (d < 30) return `${Math.floor(d / 7)} კვირა წინ`;
    if (d < 365) return `${Math.floor(d / 30)} თვე წინ`;
    return `${Math.floor(d / 365)} წელი წინ`;
  };

  const loadNotifications = async () => {
    try {
      if (!user?.id) return;
      const res = await fetch(`${API_BASE_URL}/notifications/user/${user.id}`);
      if (!res.ok) return;
      const json = await res.json();
      const list: AnyObject[] = Array.isArray(json?.data) ? json.data : [];
      const mapped: NotificationItem[] = list.map((n: AnyObject) => mapNotificationFromApi(n));
      mapped.sort((a, b) => b.createdAt - a.createdAt);
      setNotifications(mapped);
    } catch {}
  };

  useEffect(() => {
    loadNotifications();
  }, [user?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  };

  const markAsRead = async (id: string) => {
    try { await fetch(`${API_BASE_URL}/notifications/${id}/read`, { method: 'PATCH' }); } catch {}
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  };

  const markAllAsRead = async () => {
    const ids = notifications.filter(n => !n.isRead).map(n => n.id);
    await Promise.all(ids.map(id => fetch(`${API_BASE_URL}/notifications/${id}/read`, { method: 'PATCH' })));
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const unreadCount = useMemo(() => notifications.filter(n => !n.isRead).length, [notifications]);

  const filtered = useMemo(() => {
    if (filter === 'all') return notifications;
    if (filter === 'unread') return notifications.filter(n => !n.isRead);
    if (filter === 'chat') return notifications.filter(n => n.type === 'chat_message');
    if (filter === 'offer') return notifications.filter(n => (
      n.type === 'offer_status' || n.type === 'new_offer' || n.type === 'offer'
    ));
    if (filter === 'booking') return notifications.filter(n => (
      n.type === 'carwash_booking' || n.type === 'carwash_booking_confirmed' || n.type === 'carwash_booking_reminder'
    ));
    return notifications.filter(n => (
      n.type !== 'chat_message' && n.type !== 'offer_status' && n.type !== 'new_offer' && n.type !== 'offer' &&
      n.type !== 'carwash_booking' && n.type !== 'carwash_booking_confirmed' && n.type !== 'carwash_booking_reminder'
    ));
  }, [notifications, filter]);

  const limited = useMemo(() => filtered.slice(0, displayCount), [filtered, displayCount]);

  const groupLabel = (ts: number) => {
    const d = new Date(ts);
    const today = new Date();
    const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diffDays = Math.floor((startOfDay(today) - startOfDay(d)) / (1000*60*60*24));
    if (diffDays === 0) return 'დღეს';
    if (diffDays === 1) return 'გუშინ';
    if (diffDays < 7) return 'ბოლო 7 დღე';
    return d.toLocaleDateString('ka-GE', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const grouped = useMemo(() => {
    const map = new Map<string, NotificationItem[]>();
    for (const n of limited) {
      const label = groupLabel(n.createdAt);
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(n);
    }
    return Array.from(map.entries()).map(([title, items]) => ({ title, items }));
  }, [limited]);

  const isValidId = (id: string | undefined): boolean => {
    if (!id) return false;
    const str = String(id).trim();
    return str !== '' && str !== 'undefined' && str !== 'null' && str !== '1' && str.length > 0;
  };

  const handleNavigation = (notification: NotificationItem) => {
    const d = notification.data || {};
    const screen = d.screen as string | undefined;
    const type = (d.type as string | undefined) || notification.type;
    const requestId = d.requestId as string | undefined;
    const offerId = d.offerId as string | undefined;
    const carwashId = d.carwashId as string | undefined;
    const chatId = d.chatId as string | undefined;
    const partnerId = d.partnerId as string | undefined;
    const target = d.target || {};
    const hasValidRequestId = isValidId(requestId);
    const hasValidOfferId = isValidId(offerId);
    const isBusiness = target.partnerId || target.storeId || target.dismantlerId ||
      target.role === 'partner' || target.role === 'store' || target.role === 'dismantler';
    const isBusinessType = notification.type === 'offer' && isBusiness;
    const isUserType = notification.type === 'request' || (notification.type === 'offer' && !isBusiness);
    const title = notification.title || '';
    const titleLower = title.toLowerCase();

    if (screen === 'Subscription' || notification.type === 'subscription_activated' || d.type === 'subscription_activated') {
      router.push('/' as any);
      setShouldOpenPremiumModal?.(true);
      return;
    }
    if (type === 'subscription_updated' || notification.type === 'subscription_updated') {
      triggerSubscriptionRefresh();
      router.push('/' as any);
      return;
    }
    if (titleLower.includes('carfax') || type === 'carfax' || screen === 'Carfax') {
      router.push('/carfax' as any);
      return;
    }
    if (type === 'review' || d.type === 'review_us' || screen === 'Review' || screen === 'ReviewUs' || titleLower.includes('შეფასება') || titleLower.includes('review')) {
      router.push('/review' as any);
      return;
    }
    if (screen === 'Garage' || notification.type === 'garage_reminder') {
      router.push('/(tabs)/garage' as any);
      return;
    }
    if (notification.type === 'fines' || screen === 'Fines') {
      router.push('/garage/fines' as any);
      return;
    }
    if (
      shouldNavigateToExclusiveFuelOffer(type, screen) ||
      shouldNavigateToExclusiveFuelOffer(notification.type, screen)
    ) {
      router.push('/exclusive-fuel-offer' as any);
      return;
    }
    if (shouldNavigateToPartsRequests(type, screen) || shouldNavigateToPartsRequests(notification.type, screen)) {
      router.push('/parts-requests' as any);
      return;
    }
    if (notification.type === 'new_offer' || (notification.type === 'offer' && !isBusiness)) {
      router.push((hasValidRequestId ? `/offers/${requestId}` : '/offers') as any);
      return;
    }

    if (isBusiness || isBusinessType) {
      let route = '';
      if (screen === 'RequestDetails' && hasValidRequestId) route = `/partner-chat/${requestId}`;
      else if (screen === 'OfferDetails' && (hasValidOfferId || hasValidRequestId)) route = `/partner-chat/${hasValidOfferId ? offerId : requestId}`;
      else if (screen === 'Chat' && (chatId || hasValidOfferId || hasValidRequestId)) route = `/partner-chat/${chatId || offerId || requestId}`;
      else if (target.storeId || target.dismantlerId) route = '/partner-dashboard';
      else if (hasValidRequestId || hasValidOfferId) route = `/partner-chat/${requestId || offerId}`;
      else route = '/partner-chats';
      router.push(route as any);
      return;
    }
    if (isUserType || !isBusiness) {
      let route = '';
      if (shouldNavigateToExclusiveFuelOffer(undefined, screen)) route = '/exclusive-fuel-offer';
      else if (shouldNavigateToPartsRequests(undefined, screen)) route = '/parts-requests';
      else if (screen === 'AIRecommendations' || screen === 'PartDetails') route = '/all-requests';
      else if (screen === 'RequestDetails' && hasValidRequestId) route = `/offers/${requestId}`;
      else if (screen === 'OfferDetails' && hasValidRequestId) route = `/offers/${requestId}`;
      else if (screen === 'Bookings' && carwashId) route = `/bookings/${carwashId}`;
      else if (screen === 'Chat') route = (requestId && partnerId) ? `/chat/${requestId}/${partnerId}` : '/chats';
      else if (hasValidRequestId) route = `/offers/${requestId}`;
      else route = '/all-requests';
      router.push(route as any);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()} activeOpacity={0.7}>
              <Ionicons name="arrow-back" size={22} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>შეტყობინებები</Text>
            <View style={styles.headerRight}>
              {unreadCount > 0 ? (
                <>
                  <TouchableOpacity style={styles.markAllBtn} onPress={markAllAsRead} activeOpacity={0.7}>
                    <Text style={styles.markAllBtnText}>ყველა წაკითხული</Text>
                  </TouchableOpacity>
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
                  </View>
                </>
              ) : (
                <View style={styles.headerBtn} />
              )}
            </View>
          </View>

          {/* Filters */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filtersScroll}
            contentContainerStyle={styles.filtersContent}
          >
            {([
              { key: 'all', label: 'ყველა' },
              { key: 'unread', label: 'წაუკითხავი' },
              { key: 'system', label: 'ჩათი' },
              { key: 'offer', label: 'შეთავაზება' },

            ] as const).map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={[styles.filterChip, filter === tab.key && styles.filterChipActive]}
                onPress={() => { setFilter(tab.key); setDisplayCount(20); }}
                activeOpacity={0.8}
              >
                <Text style={[styles.filterChipText, filter === tab.key && styles.filterChipTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* List */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#111827" colors={['#111827']} />
            }
          >
            {grouped.map((section) => (
              <View key={section.title} style={styles.sectionBlock}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                {section.items.map((notification) => {
                  const p = getIconPalette(notification.type);
                  return (
                    <TouchableOpacity
                      key={notification.id}
                      style={[styles.card, !notification.isRead && styles.cardUnread]}
                      onPress={() => {
                        markAsRead(notification.id);
                        handleNavigation(notification);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.iconWrap, { backgroundColor: p.bg }]}>
                        <Ionicons name={getNotificationIcon(notification.type) as any} size={20} color={p.color} />
                      </View>
                      <View style={styles.cardBody}>
                        <View style={styles.titleRow}>
                          <Text style={[styles.cardTitle, !notification.isRead && styles.cardTitleUnread]} numberOfLines={1}>
                            {notification.title}
                          </Text>
                          {!notification.isRead && <View style={styles.unreadDot} />}
                        </View>
                        <Text style={styles.cardMessage} numberOfLines={2}>{notification.message}</Text>
                        <Text style={styles.timestamp}>{formatTimeAgo(notification.createdAt)}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}

            {filtered.length > displayCount && (
              <TouchableOpacity style={styles.loadMore} onPress={() => setDisplayCount((c) => c + 20)} activeOpacity={0.8}>
                <Text style={styles.loadMoreText}>მეტის ჩატვირთვა</Text>
              </TouchableOpacity>
            )}

            {notifications.length === 0 && (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconWrap}>
                  <Ionicons name="notifications-outline" size={40} color="#9CA3AF" />
                </View>
                <Text style={styles.emptyTitle}>შეტყობინებები არ არის</Text>
                <Text style={styles.emptySubtitle}>ახალი შეტყობინებები აქ გამოჩნდება</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
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
    fontWeight: '700',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  markAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
  },
  markAllBtnText: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    color: '#111827',
    fontWeight: '600',
  },
  unreadBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  unreadBadgeText: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    fontWeight: '700',
    color: '#FFFFFF',
  },
  filtersScroll: {
    maxHeight: 48,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filtersContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: 34,
    justifyContent: 'center',
    flexShrink: 0,
  },
  filterChipActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  filterChipText: {
    fontSize: 13,
    fontFamily: 'HelveticaMedium',
    color: '#111827',
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  sectionBlock: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  cardUnread: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontFamily: 'HelveticaMedium',
    color: '#111827',
    fontWeight: '600',
    flex: 1,
  },
  cardTitleUnread: {
    fontWeight: '700',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#111827',
    marginLeft: 6,
  },
  cardMessage: {
    fontSize: 13,
    fontFamily: 'HelveticaMedium',
    color: '#6B7280',
    lineHeight: 18,
    marginBottom: 4,
  },
  timestamp: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    color: '#9CA3AF',
  },
  loadMore: {
    alignSelf: 'center',
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  loadMoreText: {
    fontSize: 13,
    fontFamily: 'HelveticaMedium',
    color: '#111827',
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    color: '#6B7280',
    textAlign: 'center',
  },
});


