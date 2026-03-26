import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import API_BASE_URL from '../../config/api';
import { useUser } from '../../contexts/UserContext';
import { triggerSubscriptionRefresh } from '../../services/subscriptionRefresh';
import {
  type NotificationType,
  type NotificationItem,
  type AnyObject,
  mapNotificationFromApi,
  getNotificationIcon as getIconName,
  getIconPalette,
} from '../../utils/notificationTypes';
import {
  shouldNavigateToPartsRequests,
  shouldNavigateToExclusiveFuelOffer,
} from '../../utils/pushNavigation';

const { width, height } = Dimensions.get('window');

export type { NotificationType, NotificationItem };

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function NotificationsModal({ visible, onClose }: Props) {
  const router = useRouter();
  const { user, setShouldOpenPremiumModal } = useUser();
  
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [activeTab, setActiveTab] = useState<'business' | 'user'>('user');
  const [showTesting, setShowTesting] = useState(false);
  const [testingLoading, setTestingLoading] = useState<string | null>(null);

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

  const load = async () => {
    try {
      if (!user?.id) return;
      const res = await fetch(`${API_BASE_URL}/notifications/user/${user.id}`);
      if (!res.ok) return;
      const json = await res.json();
      // რესპონსის სტრუქტურა – მაგის მიხედვით მოვარგებთ ტიპებს და როუტინგს
      console.log('🔔 [NOTIFICATIONS] API response:', JSON.stringify(json, null, 2));
      const list: AnyObject[] = Array.isArray(json?.data) ? json.data : [];
      const mapped: NotificationItem[] = list.map((n: AnyObject) => mapNotificationFromApi(n));
      mapped.sort((a, b) => b.createdAt - a.createdAt);
      setNotifications(mapped);
    } catch {}
  };

  useEffect(() => {
    if (visible) load();
  }, [visible, user?.id]);

  const markAsRead = async (id: string) => {
    try { await fetch(`${API_BASE_URL}/notifications/${id}/read`, { method: 'PATCH' }); } catch {}
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

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
    
    // დალოგე notification-ის მონაცემები
    console.log('🔔 [NOTIFICATIONS] Navigation clicked:', {
      notificationId: notification.id,
      notificationType: notification.type,
      notificationTitle: notification.title,
      screen,
      requestId,
      offerId,
      chatId,
      carwashId,
      target,
      fullData: d,
    });
    
    // ვალიდაცია: თუ requestId/offerId არ არის, ვერ გადავიდეთ offers/partner-chat გვერდებზე
    const isValidId = (id: string | undefined): boolean => {
      if (!id) return false;
      const str = String(id).trim();
      return str !== '' && str !== 'undefined' && str !== 'null' && str !== '1' && str.length > 0;
    };
    
    const hasValidRequestId = isValidId(requestId);
    const hasValidOfferId = isValidId(offerId);
    
    console.log('🔔 [NOTIFICATIONS] Validation:', {
      hasValidRequestId,
      hasValidOfferId,
      requestIdValue: requestId,
      offerIdValue: offerId,
    });
    
    const isBusiness = target.partnerId || target.storeId || target.dismantlerId || 
                       target.role === 'partner' || target.role === 'store' || target.role === 'dismantler';
    
    // notification type-ის მიხედვითაც შევამოწმოთ
    const isBusinessType = notification.type === 'offer' && isBusiness;
    const isUserType = notification.type === 'request' || (notification.type === 'offer' && !isBusiness);
    
    console.log('🔔 [NOTIFICATIONS] Navigation logic:', {
      isBusiness,
      isBusinessType,
      isUserType,
      notificationType: notification.type,
    });
    
    if (screen === 'Subscription' || notification.type === 'subscription_activated' || screen === "subscription_activated" || d.type === 'subscription_activated') {
      onClose();
      console.log('🔔 [NOTIFICATIONS] Navigating to home with premium modal');
      router.push('/' as any);
      setShouldOpenPremiumModal(true);
      return;
    }

    if (type === 'subscription_updated' || notification.type === 'subscription_updated' || d.type === 'subscription_updated') {
      onClose();
      console.log('🔔 [NOTIFICATIONS] subscription_updated – refreshing subscription');
      triggerSubscriptionRefresh();
      router.push('/' as any);
      return;
    }
    
    const title = notification.title || '';
    const titleLower = title.toLowerCase();
    if (titleLower.includes('carfax') || type === 'carfax' || d.type === 'carfax' || screen === 'Carfax') {
      onClose();
      console.log('🔔 [NOTIFICATIONS] Navigating to Carfax');
      router.push('/carfax' as any);
      return;
    }
    
    // Review notification
    if (type === 'review' || d.type === 'review' || d.type === 'review_us' || screen === 'Review' || screen === 'ReviewUs' || titleLower.includes('review') || titleLower.includes('შეფასება')) {
      onClose();
      console.log('🔔 [NOTIFICATIONS] Navigating to Review');
      router.push('/review' as any);
      return;
    }
    
    if (screen === 'Garage' || notification.type === 'garage_reminder') {
      onClose();
      console.log('🔔 [NOTIFICATIONS] Navigating to Garage');
      router.push('/(tabs)/garage' as any);
      return;
    }

    if (notification.type === 'fines' || screen === 'Fines') {
      onClose();
      console.log('🔔 [NOTIFICATIONS] Navigating to Fines');
      router.push('/garage/fines' as any);
      return;
    }

    if (
      shouldNavigateToExclusiveFuelOffer(type, screen) ||
      shouldNavigateToExclusiveFuelOffer(notification.type, screen)
    ) {
      onClose();
      console.log('🔔 [NOTIFICATIONS] Navigating to Exclusive Fuel Offer');
      router.push('/exclusive-fuel-offer' as any);
      return;
    }

    if (shouldNavigateToPartsRequests(type, screen) || shouldNavigateToPartsRequests(notification.type, screen)) {
      onClose();
      console.log('🔔 [NOTIFICATIONS] Navigating to Parts Requests');
      router.push('/parts-requests' as any);
      return;
    }
    
    if (notification.type === 'new_offer' || (notification.type === 'offer' && !isBusiness)) {
      onClose();
      const offersRoute = hasValidRequestId ? `/offers/${requestId}` : '/offers';
      console.log('🔔 [NOTIFICATIONS] Navigating to Offers:', offersRoute);
      router.push(offersRoute as any);
      return;
    }
    
    onClose();
    
    if (isBusiness || isBusinessType) {
      let route = '';
      if (screen === 'RequestDetails' && hasValidRequestId) {
        route = `/partner-chat/${requestId}`;
      } else if (screen === 'OfferDetails' && (hasValidOfferId || hasValidRequestId)) {
        route = `/partner-chat/${hasValidOfferId ? offerId : requestId}`;
      } else if (screen === 'Chat' && (chatId || hasValidOfferId || hasValidRequestId)) {
        route = `/partner-chat/${chatId || offerId || requestId}`;
      } else if (target.storeId || target.dismantlerId) {
        route = '/partner-dashboard';
      } else if (hasValidRequestId || hasValidOfferId) {
        route = `/partner-chat/${requestId || offerId}`;
      } else {
        route = '/partner-chats';
      }
      console.log('🔔 [NOTIFICATIONS] Navigating to BUSINESS route:', route);
      router.push(route as any);
    } 
    else if (isUserType || !isBusiness) {
      let route = '';
      if (shouldNavigateToExclusiveFuelOffer(undefined, screen)) {
        route = '/exclusive-fuel-offer';
      } else if (shouldNavigateToPartsRequests(undefined, screen)) {
        route = '/parts-requests';
      } else if (screen === 'AIRecommendations' || screen === 'PartDetails') {
        route = '/all-requests';
      } else if (screen === 'RequestDetails' && hasValidRequestId) {
        route = `/offers/${requestId}`;
      } else if (screen === 'OfferDetails' && hasValidRequestId) {
        // OfferDetails-ისთვის ყოველთვის requestId-ს ვიყენებთ, რადგან /offers/[requestId] გვერდი ელის requestId-ს
        route = `/offers/${requestId}`;
      } else if (screen === 'Bookings' && carwashId) {
        route = `/bookings/${carwashId}`;
      } else if (screen === 'Chat') {
        route = (requestId && partnerId) ? `/chat/${requestId}/${partnerId}` : '/chats';
      } else if (hasValidRequestId) {
        // ყოველთვის requestId-ს ვიყენებთ /offers გვერდისთვის
        route = `/offers/${requestId}`;
      } else {
        // თუ requestId არ არის, უბრალოდ all-requests-ზე გადავიდეთ
        route = '/all-requests';
      }
      console.log('🔔 [NOTIFICATIONS] Navigating to USER route:', route);
      router.push(route as any);
    } 
    // სისტემური და სხვა ნოტიფიკაციები
    else {
      // თუ სპეციფიკური route არ არის, უბრალოდ მოდალს ვხურავთ
      // რათა არ მოხდეს უსასრულო მარყუჟი
      console.log('🔔 [NOTIFICATIONS] No specific route, closing modal');
      return;
    }
  };

  const handleViewAll = () => {
    onClose();
    router.push('/notifications');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} />
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerStrip} />
            <View style={styles.headerContent}>
              <View style={styles.titleRow}>
                <Text style={styles.title}>შეტყობინებები</Text>
                {unreadCount > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeButton} activeOpacity={0.7}>
                <Ionicons name="close" size={20} color="#111827" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Content */}
          <View style={styles.content}>
            <ScrollView showsVerticalScrollIndicator={false} style={styles.notificationsList} contentContainerStyle={styles.listContent}>
              {notifications.slice(0, 5).map((notification) => {
                const p = getIconPalette(notification.type);
                return (
                  <TouchableOpacity
                    key={notification.id}
                    style={[styles.notificationCard, !notification.isRead && styles.unreadCard]}
                    onPress={() => {
                      markAsRead(notification.id);
                      handleNavigation(notification);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.iconWrap, { backgroundColor: p.bg }]}>
                      <Ionicons name={getIconName(notification.type) as any} size={18} color={p.color} />
                    </View>
                    <View style={styles.notificationText}>
                      <View style={styles.cardTitleRow}>
                        <Text style={[styles.notificationTitle, !notification.isRead && styles.unreadTitle]} numberOfLines={1}>
                          {notification.title}
                        </Text>
                        {!notification.isRead && <View style={styles.unreadDot} />}
                      </View>
                      <Text style={styles.notificationMessage} numberOfLines={2}>{notification.message}</Text>
                      <Text style={styles.timestamp}>{formatTimeAgo(notification.createdAt)}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.viewAllButton} onPress={handleViewAll} activeOpacity={0.7}>
              <Text style={styles.viewAllButtonText}>ყველა შეტყობინება</Text>
              <Ionicons name="arrow-forward" size={16} color="#111827" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    height: '60%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderBottomWidth: 0,
  },
  header: {
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerStrip: {
    width: 36,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 15,
    fontFamily: 'HelveticaMedium',
    color: '#111827',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '700',
  },
  unreadBadge: {
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeText: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    fontWeight: '700',
    color: '#FFFFFF',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
  },
  notificationsList: {
    flex: 1,
  },
  listContent: {
    paddingTop: 12,
    paddingBottom: 16,
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 10,
  },
  unreadCard: {
    backgroundColor: '#F9FAFB',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationText: {
    flex: 1,
    minWidth: 0,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    color: '#111827',
    fontWeight: '600',
    flex: 1,
  },
  unreadTitle: {
    fontWeight: '700',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#111827',
    marginLeft: 6,
  },
  notificationMessage: {
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
  footer: {
    padding: 16,
    paddingBottom: 24,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  viewAllButtonText: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    fontWeight: '600',
    color: '#111827',
  },
});

export default NotificationsModal;
