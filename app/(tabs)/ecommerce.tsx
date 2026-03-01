import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
  Dimensions,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import { useUser } from '@/contexts/UserContext';
import { analyticsService } from '@/services/analytics';
import { aiApi } from '@/services/aiApi';
import API_BASE_URL from '@/config/api';

const { width } = Dimensions.get('window');

export default function ManagementScreen() {
  const { user } = useUser();
  const router = useRouter();
  const [sellerStatus, setSellerStatus] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  // Load data
  useEffect(() => {
    loadData();
  }, [user?.id]);

  useEffect(() => {
    if (!loading) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [loading]);

  const loadData = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      await Promise.all([
        loadSellerStatus(),
        loadUserStats(),
      ]);
    } finally {
      setLoading(false);
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
    } catch (e) {
      console.log('[ManagementScreen] Failed to load seller status:', e);
    }
  };

  const loadUserStats = async () => {
    if (!user?.id) return;
    try {
      const [requestsRes, offersRes] = await Promise.all([
        fetch(`${API_BASE_URL}/requests?userId=${user.id}`).catch(() => null),
        fetch(`${API_BASE_URL}/offers?userId=${user.id}`).catch(() => null),
      ]);

      const requests = requestsRes?.ok ? await requestsRes.json().catch(() => []) : [];
      const offers = offersRes?.ok ? await offersRes.json().catch(() => []) : [];

      setStats({
        requests: Array.isArray(requests?.data) ? requests.data.length : Array.isArray(requests) ? requests.length : 0,
        offers: Array.isArray(offers?.data) ? offers.data.length : Array.isArray(offers) ? offers.length : 0,
        activeRequests: Array.isArray(requests?.data) 
          ? requests.data.filter((r: any) => r.status !== 'completed' && r.status !== 'cancelled').length 
          : 0,
      });
    } catch (e) {
      console.log('[ManagementScreen] Failed to load stats:', e);
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

  // Track screen view when focused
  useFocusEffect(
    React.useCallback(() => {
      analyticsService.logScreenViewWithBackend('მართვა', 'ManagementScreen', user?.id);
    }, [user?.id])
  );

  const quickActions = [
    {
      id: 'parts-request',
      title: 'ნაწილის მოთხოვნა',
      subtitle: 'გამოაქვეყნე მოთხოვნა',
      icon: 'construct-outline',
      color: '#3B82F6',
      gradient: ['#3B82F6', '#2563EB'],
      bgColor: '#EFF6FF',
      route: '/parts-requests' as any,
    },
    {
      id: 'repairmen',
      title: 'ხელოსნის მოძიება',
      subtitle: 'იპოვე ხელოსანი',
      icon: 'build-outline',
      color: '#10B981',
      gradient: ['#10B981', '#059669'],
      bgColor: '#F0FDF4',
      route: '/search-repairmen' as any,
    },
    {
      id: 'car-rental',
      title: 'მანქანის გაქირავება',
      subtitle: 'იქირავე მანქანა',
      icon: 'car-sport-outline',
      color: '#8B5CF6',
      gradient: ['#8B5CF6', '#7C3AED'],
      bgColor: '#F5F3FF',
      route: '/car-rental-list' as any,
    },
    {
      id: 'requests',
      title: 'ჩემი მოთხოვნები',
      subtitle: `${stats?.requests || 0} მოთხოვნა`,
      icon: 'document-text-outline',
      color: '#F59E0B',
      gradient: ['#F59E0B', '#D97706'],
      bgColor: '#FFFBEB',
      route: '/all-requests' as any,
    },
  ];

  if (hasStore || hasDismantlers) {
    quickActions.push({
      id: 'business',
      title: 'ბიზნესის მართვა',
      subtitle: hasDismantlers ? 'დაშლილების მართვა' : 'მაღაზიის მართვა',
      icon: 'business-outline',
      color: '#10B981',
      gradient: ['#10B981', '#059669'],
      bgColor: '#F0FDF4',
      route: hasDismantlers ? '/dismantler-dashboard' as any : '/partner-dashboard-store' as any,
    });
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>იტვირთება...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header with Gradient */}
      <LinearGradient
        colors={['#F8FAFC', '#FFFFFF']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerCenter}>
            <View style={styles.headerIconContainer}>
              <LinearGradient
                colors={['#3B82F6', '#2563EB']}
                style={styles.headerIcon}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="settings" size={20} color="#FFFFFF" />
              </LinearGradient>
            </View>
            <Text style={styles.headerTitle}>მართვა</Text>
            <View style={styles.titleUnderline} />
          </View>
        </View>
      </LinearGradient>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={['#3B82F6']}
            tintColor="#3B82F6"
          />
        }
      >
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
          }}
        >
          {/* Stats Cards with Gradients */}
          {stats && (
            <View style={styles.statsContainer}>
              <View style={styles.statsRow}>
                <TouchableOpacity
                  style={styles.statCard}
                  activeOpacity={0.9}
                  onPress={() => {
                    analyticsService.logButtonClick('მოთხოვნები სტატისტიკა', 'მართვა', undefined, user?.id);
                    router.push('/all-requests' as any);
                  }}
                >
                  <LinearGradient
                    colors={['#EFF6FF', '#DBEAFE']}
                    style={styles.statCardGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <View style={[styles.statIcon, { backgroundColor: '#3B82F6' }]}>
                      <Ionicons name="document-text" size={22} color="#FFFFFF" />
                    </View>
                    <Text style={styles.statValue}>{stats.requests || 0}</Text>
                    <Text style={styles.statLabel}>მოთხოვნა</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.statCard}
                  activeOpacity={0.9}
                  onPress={() => {
                    analyticsService.logButtonClick('აქტიური მოთხოვნები', 'მართვა', undefined, user?.id);
                    router.push('/all-requests' as any);
                  }}
                >
                  <LinearGradient
                    colors={['#F0FDF4', '#D1FAE5']}
                    style={styles.statCardGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <View style={[styles.statIcon, { backgroundColor: '#10B981' }]}>
                      <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" />
                    </View>
                    <Text style={styles.statValue}>{stats.activeRequests || 0}</Text>
                    <Text style={styles.statLabel}>აქტიური</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.statCard}
                  activeOpacity={0.9}
                  onPress={() => {
                    analyticsService.logButtonClick('შეთავაზებები სტატისტიკა', 'მართვა', undefined, user?.id);
                    router.push('/offers' as any);
                  }}
                >
                  <LinearGradient
                    colors={['#FFFBEB', '#FEF3C7']}
                    style={styles.statCardGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <View style={[styles.statIcon, { backgroundColor: '#F59E0B' }]}>
                      <Ionicons name="pricetag" size={22} color="#FFFFFF" />
                    </View>
                    <Text style={styles.statValue}>{stats.offers || 0}</Text>
                    <Text style={styles.statLabel}>შეთავაზება</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Welcome Section with Enhanced Design */}
          <View style={styles.welcomeSection}>
            <LinearGradient
              colors={['#EFF6FF', '#DBEAFE']}
              style={styles.welcomeIconContainer}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="settings" size={36} color="#3B82F6" />
            </LinearGradient>
            <Text style={styles.welcomeTitle}>
              {user?.name ? `გამარჯობა, ${user.name.split(' ')[0]}` : 'გამარჯობა'}
            </Text>
            <Text style={styles.welcomeSubtitle}>
              რას გსურთ გააკეთოთ დღეს?
            </Text>
          </View>

          {/* Quick Actions Grid with Enhanced Cards */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>სწრაფი ქმედებები</Text>
              <View style={styles.sectionTitleLine} />
            </View>
            <View style={styles.quickActionsGrid}>
              {quickActions.map((action, index) => (
                <TouchableOpacity
                  key={action.id}
                  style={styles.quickActionCard}
                  onPress={() => {
                    analyticsService.logButtonClick(action.title, 'მართვა', { actionId: action.id }, user?.id);
                    router.push(action.route);
                  }}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={action.gradient as [string, string]}
                    style={styles.quickActionIcon}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Ionicons name={action.icon as any} size={26} color="#FFFFFF" />
                  </LinearGradient>
                  <Text style={[styles.quickActionTitle, { color: action.color }]}>
                    {action.title}
                  </Text>
                  <Text style={styles.quickActionSubtitle}>
                    {action.subtitle}
                  </Text>
                  <View style={[styles.quickActionArrow, { backgroundColor: `${action.color}15` }]}>
                    <Ionicons name="arrow-forward" size={14} color={action.color} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Main Actions with Enhanced Design */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>ძირითადი ოფციები</Text>
              <View style={styles.sectionTitleLine} />
            </View>
            <View style={styles.mainActionsContainer}>
              {/* Parts Request */}
              <TouchableOpacity
                style={styles.mainActionCard}
                onPress={() => {
                  analyticsService.logButtonClick('ნაწილის მოთხოვნა', 'მართვა', undefined, user?.id);
                  router.push('/parts-requests' as any);
                }}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['#EFF6FF', '#DBEAFE']}
                  style={styles.mainActionIconBg}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="construct" size={28} color="#3B82F6" />
                </LinearGradient>
                <View style={styles.mainActionContent}>
                  <Text style={styles.mainActionTitle}>ნაწილის მოთხოვნა</Text>
                  <Text style={styles.mainActionDescription}>
                    გამოაქვეყნე მოთხოვნა და მიიღე შეთავაზებები გამყიდველებისგან
                  </Text>
                </View>
                <View style={styles.mainActionArrow}>
                  <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                </View>
              </TouchableOpacity>

              {/* Repairmen Search */}
              <TouchableOpacity
                style={styles.mainActionCard}
                onPress={() => {
                  analyticsService.logButtonClick('ხელოსნის მოძიება', 'მართვა', undefined, user?.id);
                  router.push('/search-repairmen' as any);
                }}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['#F0FDF4', '#D1FAE5']}
                  style={styles.mainActionIconBg}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="build" size={28} color="#10B981" />
                </LinearGradient>
                <View style={styles.mainActionContent}>
                  <Text style={styles.mainActionTitle}>ხელოსნის მოძიება</Text>
                  <Text style={styles.mainActionDescription}>
                    გამოაქვეყნე მოთხოვნა და მიიღე შეთავაზებები ხელოსნებისგან
                  </Text>
                </View>
                <View style={styles.mainActionArrow}>
                  <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                </View>
              </TouchableOpacity>

              {/* Business Management */}
              {(hasStore || hasDismantlers) && (
                <TouchableOpacity
                  style={styles.mainActionCard}
                  onPress={() => {
                    analyticsService.logButtonClick('ბიზნესის მართვა', 'მართვა', undefined, user?.id);
                    if (hasDismantlers) {
                      router.push('/dismantler-dashboard' as any);
                    } else {
                      router.push('/partner-dashboard-store' as any);
                    }
                  }}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={['#F0FDF4', '#D1FAE5']}
                    style={styles.mainActionIconBg}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Ionicons name="business" size={28} color="#10B981" />
                  </LinearGradient>
                  <View style={styles.mainActionContent}>
                    <Text style={styles.mainActionTitle}>ბიზნესის მართვა</Text>
                    <Text style={styles.mainActionDescription}>
                      {hasDismantlers ? 'დაშლილების' : 'მაღაზიის'} მოთხოვნები, ჩატები და ანალიტიკა
                    </Text>
                  </View>
                  <View style={styles.mainActionArrow}>
                    <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                  </View>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Additional Options with Enhanced Design */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>დამატებითი ოფციები</Text>
              <View style={styles.sectionTitleLine} />
            </View>
            <View style={styles.additionalOptionsContainer}>
              <TouchableOpacity
                style={styles.additionalOption}
                onPress={() => {
                  analyticsService.logButtonClick('ჩემი მოთხოვნები', 'მართვა', undefined, user?.id);
                  router.push('/all-requests' as any);
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.additionalOptionIcon, { backgroundColor: '#EFF6FF' }]}>
                  <Ionicons name="list" size={20} color="#3B82F6" />
                </View>
                <Text style={styles.additionalOptionText}>ჩემი მოთხოვნები</Text>
                {stats?.requests > 0 && (
                  <View style={[styles.badge, { backgroundColor: '#3B82F6' }]}>
                    <Text style={styles.badgeText}>{stats.requests}</Text>
                  </View>
                )}
                <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
              </TouchableOpacity>

              <View style={styles.additionalOptionDivider} />

              <TouchableOpacity
                style={styles.additionalOption}
                onPress={() => {
                  analyticsService.logButtonClick('შეთავაზებები', 'მართვა', undefined, user?.id);
                  router.push('/offers' as any);
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.additionalOptionIcon, { backgroundColor: '#FFFBEB' }]}>
                  <Ionicons name="pricetag" size={20} color="#F59E0B" />
                </View>
                <Text style={styles.additionalOptionText}>შეთავაზებები</Text>
                {stats?.offers > 0 && (
                  <View style={[styles.badge, { backgroundColor: '#F59E0B' }]}>
                    <Text style={styles.badgeText}>{stats.offers}</Text>
                  </View>
                )}
                <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
              </TouchableOpacity>

              <View style={styles.additionalOptionDivider} />

              <TouchableOpacity
                style={styles.additionalOption}
                onPress={() => {
                  analyticsService.logButtonClick('ჩატები', 'მართვა', undefined, user?.id);
                  router.push('/chats' as any);
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.additionalOptionIcon, { backgroundColor: '#F0FDF4' }]}>
                  <Ionicons name="chatbubbles" size={20} color="#10B981" />
                </View>
                <Text style={styles.additionalOptionText}>ჩატები</Text>
                <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'Outfit',
    color: '#6B7280',
    fontWeight: '500',
  },
  header: {
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  headerCenter: {
    alignItems: 'center',
    gap: 8,
  },
  headerIconContainer: {
    marginBottom: 4,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: 'Outfit',
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  titleUnderline: {
    width: 50,
    height: 4,
    backgroundColor: '#3B82F6',
    borderRadius: 2,
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  statsContainer: {
    marginBottom: 28,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  statCardGradient: {
    padding: 18,
    alignItems: 'center',
    borderRadius: 20,
  },
  statIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  statValue: {
    fontSize: 28,
    fontFamily: 'Outfit',
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
    letterSpacing: -1,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'Outfit',
    color: '#6B7280',
    fontWeight: '600',
  },
  welcomeSection: {
    alignItems: 'center',
    marginBottom: 36,
    marginTop: 12,
  },
  welcomeIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  welcomeTitle: {
    fontSize: 24,
    fontFamily: 'Outfit',
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  welcomeSubtitle: {
    fontSize: 15,
    fontFamily: 'Outfit',
    color: '#6B7280',
    textAlign: 'center',
    fontWeight: '500',
  },
  section: {
    marginBottom: 36,
  },
  sectionHeader: {
    marginBottom: 18,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: 'Outfit',
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.5,
  },
  sectionTitleLine: {
    width: 40,
    height: 3,
    backgroundColor: '#3B82F6',
    borderRadius: 2,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickActionCard: {
    width: (width - 52) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    position: 'relative',
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  quickActionTitle: {
    fontSize: 15,
    fontFamily: 'Outfit',
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  quickActionSubtitle: {
    fontSize: 12,
    fontFamily: 'Outfit',
    color: '#6B7280',
    textAlign: 'center',
    fontWeight: '500',
    marginBottom: 8,
  },
  quickActionArrow: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainActionsContainer: {
    gap: 14,
  },
  mainActionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  mainActionIconBg: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  mainActionContent: {
    flex: 1,
    gap: 6,
  },
  mainActionTitle: {
    fontSize: 17,
    fontFamily: 'Outfit',
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.3,
  },
  mainActionDescription: {
    fontSize: 13,
    fontFamily: 'Outfit',
    color: '#6B7280',
    lineHeight: 20,
    fontWeight: '500',
  },
  mainActionArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  additionalOptionsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  additionalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    gap: 14,
  },
  additionalOptionDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginLeft: 18,
    marginRight: 18,
  },
  additionalOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  additionalOptionText: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Outfit',
    fontWeight: '600',
    color: '#111827',
  },
  badge: {
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    minWidth: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Outfit',
    fontWeight: '700',
  },
});
