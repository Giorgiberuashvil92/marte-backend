import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import { useUser } from '@/contexts/UserContext';
import { analyticsService } from '@/services/analytics';
import { aiApi } from '@/services/aiApi';
import API_BASE_URL from '@/config/api';

const { width: screenWidth } = Dimensions.get('window');

export default function EcommerceScreen() {
  const { user } = useUser();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sellerStatus, setSellerStatus] = useState<any>(null);
  const [stats, setStats] = useState({ requests: 0, offers: 0, activeRequests: 0 });

  useFocusEffect(
    React.useCallback(() => {
      analyticsService.logScreenViewWithBackend('მართვა', 'EcommerceScreen', user?.id);
    }, [user?.id])
  );

  useEffect(() => {
    loadData();
  }, [user?.id]);

  const loadData = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      await Promise.all([loadSellerStatus(), loadStats()]);
    } finally {
      setLoading(false);
    }
  };

  const loadSellerStatus = async () => {
    if (!user?.id) return;
    try {
      const res = await aiApi.getSellerStatus({ userId: user.id, phone: user.phone });
      setSellerStatus(res.data);
    } catch (e) {
      console.log('[Ecommerce] seller status error:', e);
    }
  };

  const loadStats = async () => {
    if (!user?.id) return;
    try {
      const [reqRes, offRes] = await Promise.all([
        fetch(`${API_BASE_URL}/requests?userId=${user.id}`).catch(() => null),
        fetch(`${API_BASE_URL}/offers?userId=${user.id}`).catch(() => null),
      ]);
      const requests = reqRes?.ok ? await reqRes.json().catch(() => []) : [];
      const offers = offRes?.ok ? await offRes.json().catch(() => []) : [];
      const reqArr = Array.isArray(requests?.data) ? requests.data : Array.isArray(requests) ? requests : [];
      const offArr = Array.isArray(offers?.data) ? offers.data : Array.isArray(offers) ? offers : [];
      setStats({
        requests: reqArr.length,
        offers: offArr.length,
        activeRequests: reqArr.filter((r: any) => r.status !== 'completed' && r.status !== 'cancelled').length,
      });
    } catch (e) {
      console.log('[Ecommerce] stats error:', e);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const hasStore =
    !!(sellerStatus?.counts?.stores && sellerStatus.counts.stores > 0) ||
    !!(sellerStatus?.ownedStores && sellerStatus.ownedStores.length > 0);
  const hasDismantlers =
    !!(sellerStatus?.counts?.dismantlers && sellerStatus.counts.dismantlers > 0) ||
    !!(sellerStatus?.ownedDismantlers && sellerStatus.ownedDismantlers.length > 0);

  // === Quick Actions ===
  const quickActions = [
    {
      key: 'parts-request',
      title: 'ნაწილის მოთხოვნა',
      icon: 'construct-outline' as const,
      color: '#3B82F6',
      route: '/parts-requests' as any,
    },
    {
      key: 'Chats',
      title: 'ჩატები',
      icon: 'chatbubbles-outline' as const,
      color: '#10B981',
      route: '/chats' as any,
    },
    {
      key: 'car-rental',
      title: 'მანქანის ქირაობა',
      icon: 'car-sport-outline' as const,
      color: '#8B5CF6',
      route: '/car-rental-list' as any,
      comingSoon: true,
    },
    {
      key: 'help-assistant',
      title: 'AI ასისტენტი',
      icon: 'sparkles-outline' as const,
      color: '#6366F1',
      route: '/help-assistant' as any,
    },
  ];

  const hasAnyBusiness = hasStore || hasDismantlers;

  // === Business Section ===
  const businessActions = [
    ...(hasStore
      ? [
          
        ]
      : []),
    ...(hasAnyBusiness
      ? [
          {
            key: 'business-panel',
            title: 'ბიზნესის სამართავი პანელი',
            subtitle: 'განცხადებების განახლება, ვადები და სხვა',
            icon: 'storefront-outline' as const,
            color: '#10B981',
            route: '/business-panel' as any,
          },
        ]
      : []),
    {
      key: 'my-requests',
      title: 'ჩემი მოთხოვნები',
      subtitle: `${stats.activeRequests} აქტიური მოთხოვნა`,
      icon: 'document-text-outline' as const,
      color: '#3B82F6',
      route: '/all-requests' as any,
    },
    {
      key: 'offers',
      title: 'შეთავაზებები',
      subtitle: `${stats.offers} შეთავაზება`,
      icon: 'pricetag-outline' as const,
      color: '#F59E0B',
      route: '/offers' as any,
    },
    // {
    //   key: 'chats',
    //   title: 'ჩატები',
    //   subtitle: 'შეტყობინებები',
    //   icon: 'chatbubbles-outline' as const,
    //   color: '#8B5CF6',
    //   route: '/chats' as any,
    // },
  ];

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#111827" />
          <Text style={styles.loadingText}>იტვირთება...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      <LinearGradient
        colors={['#F8FAFC', '#F1F5F9', '#E2E8F0']}
        style={StyleSheet.absoluteFillObject}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#111827']}
            tintColor="#111827"
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.pageTitle}>მართე</Text>
          <Text style={styles.pageSubtitle}>
            {user?.name ? `გამარჯობა, ${user.name.split(' ')[0]}` : 'გამარჯობა'}
          </Text>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <TouchableOpacity
            style={styles.statCard}
            activeOpacity={0.7}
            onPress={() => router.push('/all-requests' as any)}
          >
            <View style={[styles.statIconWrap, { backgroundColor: '#3B82F615' }]}>
              <Ionicons name="document-text-outline" size={20} color="#3B82F6" />
            </View>
            <Text style={styles.statValue}>{stats.requests}</Text>
            <Text style={styles.statLabel}>მოთხოვნა</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.statCard}
            activeOpacity={0.7}
            onPress={() => router.push('/all-requests' as any)}
          >
            <View style={[styles.statIconWrap, { backgroundColor: '#10B98115' }]}>
              <Ionicons name="checkmark-circle-outline" size={20} color="#10B981" />
            </View>
            <Text style={styles.statValue}>{stats.activeRequests}</Text>
            <Text style={styles.statLabel}>აქტიური</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.statCard}
            activeOpacity={0.7}
            onPress={() => router.push('/offers' as any)}
          >
            <View style={[styles.statIconWrap, { backgroundColor: '#F59E0B15' }]}>
              <Ionicons name="pricetag-outline" size={20} color="#F59E0B" />
            </View>
            <Text style={styles.statValue}>{stats.offers}</Text>
            <Text style={styles.statLabel}>შეთავაზება</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Actions - 2x2 Grid */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>სწრაფი ქმედებები</Text>
          <View style={styles.quickGrid}>
            {quickActions.map((action) => {
              const comingSoon = (action as { comingSoon?: boolean }).comingSoon;
              return (
                <TouchableOpacity
                  key={action.key}
                  style={[styles.quickCard, comingSoon && styles.quickCardComingSoon]}
                  activeOpacity={0.7}
                  onPress={() => {
                    analyticsService.logButtonClick(action.title, 'მართვა', { key: action.key }, user?.id);
                    if (comingSoon) {
                      Alert.alert('მალე', 'მანქანის ქირაობის ფუნქციონალი მალე დაემატება. 🙂');
                      return;
                    }
                    router.push(action.route);
                  }}
                >
                  <View style={[styles.quickIconWrap, { backgroundColor: `${action.color}15` }]}>
                    <Ionicons name={action.icon} size={26} color={action.color} />
                  </View>
                  <Text style={styles.quickTitle}>{action.title}</Text>
                  {comingSoon && (
                    <Text style={styles.quickComingSoon}>მალე დაემატება</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Business & Management */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {hasStore || hasDismantlers ? 'ბიზნესი და მართვა' : 'მართვა'}
          </Text>
          <View style={styles.listContainer}>
            {businessActions.map((action, index) => (
              <React.Fragment key={action.key}>
                {index > 0 && <View style={styles.listDivider} />}
                <TouchableOpacity
                  style={styles.listItem}
                  activeOpacity={0.7}
                  onPress={() => {
                    analyticsService.logButtonClick(action.title, 'მართვა', { key: action.key }, user?.id);
                    router.push(action.route);
                  }}
                >
                  <View style={[styles.listIconWrap, { backgroundColor: `${action.color}15` }]}>
                    <Ionicons name={action.icon} size={22} color={action.color} />
                  </View>
                  <View style={styles.listContent}>
                    <Text style={styles.listTitle}>{action.title}</Text>
                    <Text style={styles.listSubtitle}>{action.subtitle}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
                </TouchableOpacity>
              </React.Fragment>
            ))}
          </View>
        </View>

        {/* Partner Banner */}
       

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    color: '#6B7280',
  },
  scrollContent: {
    paddingBottom: 120,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  pageTitle: {
    fontSize: 26,
    fontFamily: 'HelveticaMedium',
    fontWeight: '800',
    color: '#111827',
    textTransform: 'uppercase',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    color: '#6B7280',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  statIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 22,
    fontFamily: 'HelveticaMedium',
    fontWeight: '800',
    color: '#111827',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: 'HelveticaMedium',
    color: '#6B7280',
    fontWeight: '600',
    textTransform: 'uppercase',
  },

  // Sections
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'HelveticaMedium',
    fontWeight: '700',
    color: '#111827',
    textTransform: 'uppercase',
    letterSpacing: -0.3,
    marginBottom: 14,
  },

  // Quick Actions Grid
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickCard: {
    width: (screenWidth - 50) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  quickIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  quickTitle: {
    fontSize: 13,
    fontFamily: 'HelveticaMedium',
    fontWeight: '700',
    color: '#111827',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  quickCardComingSoon: {
    opacity: 0.92,
  },
  quickComingSoon: {
    fontSize: 10,
    fontFamily: 'HelveticaMedium',
    color: '#8B5CF6',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  // List Items
  listContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  listDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 16,
  },
  listIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    flex: 1,
    gap: 2,
  },
  listTitle: {
    fontSize: 15,
    fontFamily: 'HelveticaMedium',
    fontWeight: '700',
    color: '#111827',
    textTransform: 'uppercase',
  },
  listSubtitle: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    color: '#6B7280',
  },

  // Partner Banner
  partnerBanner: {
    borderRadius: 18,
    padding: 20,
    overflow: 'hidden',
  },
  partnerBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  partnerBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  partnerBannerIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  partnerBannerTitle: {
    fontSize: 16,
    fontFamily: 'HelveticaMedium',
    fontWeight: '800',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  partnerBannerSubtitle: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    color: '#D1D5DB',
    lineHeight: 16,
  },
  partnerBannerArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
});
