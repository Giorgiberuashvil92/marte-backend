import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  StatusBar,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, Stack, useFocusEffect } from 'expo-router';
import { requestsApi, type Request } from '@/services/requestsApi';
import { useUser } from '@/contexts/UserContext';

export default function AllRequestsScreen() {
  const { newRequest, service, requestData } = useLocalSearchParams<{
    newRequest?: string;
    service?: string;
    requestData?: string;
  }>();
  
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [requests, setRequests] = useState<Request[]>([]);
  const [offersCountMap, setOffersCountMap] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(30));

  useEffect(() => {
    fetchRequests();
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      if (!loading) fetchRequests();
    }, [user?.id])
  );

  useEffect(() => {
    if (newRequest === 'true' && requestData) {
      try {
        const parsedData = JSON.parse(requestData);
        Alert.alert(
          'მოთხოვნა გაიგზავნა!',
          `თქვენი ${service} მოთხოვნა წარმატებით გაიგზავნა. მაღაზიები გამოგიგზავნიან შეთავაზებებს.`,
          [{ text: 'კარგი', onPress: () => router.replace('/all-requests') }],
        );
      } catch (error) {
        console.error('Error parsing request data:', error);
      }
    }
  }, [newRequest, requestData, service]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const apiRequests = await requestsApi.getRequests(user?.id);

      // ბექენდი უკვე აბრუნებს offersCount-ს თითოეულ request-ზე
      const counts: Record<string, number> = {};
      (apiRequests || []).forEach((req: any) => {
        const key = req?.id;
        if (key && req?.offersCount) counts[key] = req.offersCount;
      });

      setRequests(apiRequests);
      setOffersCountMap(counts);
    } catch (error) {
      console.error('Failed to fetch requests from API:', error);
      setRequests([]);
      setOffersCountMap({});
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchRequests();
    setRefreshing(false);
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

  const getServiceIcon = (svc: string) => {
    switch (svc) {
      case 'parts': return 'construct-outline';
      case 'mechanic': return 'build-outline';
      case 'tow': return 'car-outline';
      case 'rental': return 'car-sport-outline';
      default: return 'help-outline';
    }
  };

  const getServiceLabel = (svc: string) => {
    switch (svc) {
      case 'parts': return 'ნაწილები';
      case 'mechanic': return 'ხელოსანი';
      case 'tow': return 'ევაკუატორი';
      case 'rental': return 'ქირაობა';
      default: return 'სერვისი';
    }
  };

  const getStatusInfo = (status: string) => {
    const normalized = (status || '').toLowerCase();
    if (normalized === 'active' || status === 'აქტიური') {
      return { label: 'აქტიური', color: '#059669', bg: '#ECFDF5', border: '#D1FAE5' };
    }
    if (normalized === 'fulfilled' || normalized === 'completed' || status === 'დასრულებული') {
      return { label: 'დასრულებული', color: '#6B7280', bg: '#F3F4F6', border: '#E5E7EB' };
    }
    if (normalized === 'pending' || status === 'პენდინგი') {
      return { label: 'მოლოდინში', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' };
    }
    if (normalized === 'cancelled') {
      return { label: 'გაუქმებული', color: '#EF4444', bg: '#FEF2F2', border: '#FECACA' };
    }
    return { label: status, color: '#6B7280', bg: '#F3F4F6', border: '#E5E7EB' };
  };

  const filteredRequests = requests.filter((request) => {
    if (filter === 'active') return request.status === 'active';
    if (filter === 'completed') return request.status === 'fulfilled' || request.status === 'cancelled';
    return true;
  });

  const activeCount = requests.filter((r) => r.status === 'active').length;
  const completedCount = requests.filter((r) => r.status === 'fulfilled' || r.status === 'cancelled').length;

  const handleRequestPress = (request: Request) => {
    router.push(`/offers/${request.id}` as any);
  };

  const filterTabs = [
    { key: 'all' as const, label: 'ყველა', count: requests.length },
    { key: 'active' as const, label: 'აქტიური', count: activeCount },
    { key: 'completed' as const, label: 'დასრულებული', count: completedCount },
  ];

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
          <Text style={styles.headerTitle}>ჩემი მოთხოვნები</Text>
          <View style={{ width: 40 }} />
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

            {/* Stats Row */}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <View style={[styles.statIconCircle, { backgroundColor: '#EEF2FF' }]}>
                  <Ionicons name="document-text-outline" size={18} color="#4F46E5" />
                </View>
                <Text style={styles.statValue}>{requests.length}</Text>
                <Text style={styles.statLabel}>სულ</Text>
              </View>
              <View style={styles.statCard}>
                <View style={[styles.statIconCircle, { backgroundColor: '#ECFDF5' }]}>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#059669" />
                </View>
                <Text style={styles.statValue}>{activeCount}</Text>
                <Text style={styles.statLabel}>აქტიური</Text>
              </View>
              <View style={styles.statCard}>
                <View style={[styles.statIconCircle, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="pricetag-outline" size={18} color="#D97706" />
                </View>
                <Text style={styles.statValue}>
                  {Object.values(offersCountMap).reduce((a, b) => a + b, 0)}
                </Text>
                <Text style={styles.statLabel}>შეთავაზება</Text>
              </View>
            </View>

            {/* Filter Tabs */}
            <View style={styles.filterRow}>
              {filterTabs.map((tab) => (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.filterTab, filter === tab.key && styles.filterTabActive]}
                  onPress={() => setFilter(tab.key)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.filterTabText, filter === tab.key && styles.filterTabTextActive]}>
                    {tab.label}
                  </Text>
                  <View style={[styles.filterBadge, filter === tab.key && styles.filterBadgeActive]}>
                    <Text style={[styles.filterBadgeText, filter === tab.key && styles.filterBadgeTextActive]}>
                      {tab.count}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* Section Title */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>მოთხოვნები</Text>
              <Text style={styles.sectionCount}>{filteredRequests.length} ჩანაწერი</Text>
            </View>

            {/* Requests List */}
            {filteredRequests.length === 0 ? (
              <View style={styles.emptyCard}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="document-text-outline" size={36} color="#9CA3AF" />
                </View>
                <Text style={styles.emptyTitle}>მოთხოვნები არ მოიძებნა</Text>
                <Text style={styles.emptySubtitle}>
                  {filter === 'all'
                    ? 'შექმენით ახალი მოთხოვნა სერვისების გამოყენებით'
                    : 'ამ ფილტრით მოთხოვნები არ არის'}
                </Text>
              </View>
            ) : (
              filteredRequests.map((request, index) => {
                  const offersCount =
                    offersCountMap[request.id] ??
                    (request as any)?.offersCount ??
                    (request as any)?.offers?.length ??
                    0;
                const statusInfo = getStatusInfo(request.status as any);
                  const title =
                  request.service === 'parts'
                    ? request.partName
                    : request.service === 'mechanic'
                      ? (request as any).problemName || 'ხელოსანი'
                      : request.service === 'tow'
                        ? 'ევაკუატორი'
                        : request.service === 'rental'
                          ? 'ქირაობა'
                          : request.partName || 'მოთხოვნა';

                  return (
                  <TouchableOpacity
                      key={request.id || index}
                        style={styles.requestCard}
                        onPress={() => handleRequestPress(request)}
                    activeOpacity={0.7}
                      >
                    {/* Top Row - Service + Status */}
                          <View style={styles.requestTopRow}>
                      <View style={styles.serviceChip}>
                        <Ionicons
                          name={getServiceIcon(request.service || 'parts') as any}
                          size={14}
                          color="#6B7280"
                        />
                        <Text style={styles.serviceChipText}>
                          {getServiceLabel(request.service || 'parts')}
                        </Text>
                              </View>
                      <View
                        style={[
                          styles.statusChip,
                          { backgroundColor: statusInfo.bg, borderColor: statusInfo.border },
                        ]}
                      >
                        <Text style={[styles.statusChipText, { color: statusInfo.color }]}>
                          {statusInfo.label}
                              </Text>
                            </View>
                          </View>

                    {/* Title + Vehicle */}
                    <View style={styles.requestMainInfo}>
                      <View style={styles.requestIconCircle}>
                        <Ionicons name="construct" size={20} color="#111827" />
                              </View>
                      <View style={styles.requestTextCol}>
                        <Text style={styles.requestTitle} numberOfLines={1}>
                          {title}
                        </Text>
                        <Text style={styles.requestVehicle} numberOfLines={1}>
                          {request?.vehicle?.make && request?.vehicle?.model
                              ? `${request.vehicle.make} ${request.vehicle.model} (${request.vehicle.year})`
                              : 'მანქანის მონაცემები მიუწვდომელია'}
                          </Text>
                      </View>
                    </View>

                    {/* Description */}
                          {request.description ? (
                      <View style={styles.requestDescBox}>
                        <Text style={styles.requestDescText} numberOfLines={2}>
                              {request.description}
                            </Text>
                      </View>
                          ) : null}

                    {/* Footer */}
                    <View style={styles.requestFooter}>
                      <View style={styles.requestFooterLeft}>
                        <Ionicons name="time-outline" size={13} color="#9CA3AF" />
                        <Text style={styles.requestTimeText}>
                          {formatTimeAgo(request.createdAt)}
                        </Text>
                            </View>
                      <View style={styles.requestFooterRight}>
                        {offersCount > 0 && (
                          <View style={styles.offersChip}>
                            <Ionicons name="chatbubbles-outline" size={13} color="#059669" />
                            <Text style={styles.offersChipText}>{offersCount} შეთავაზება</Text>
                              </View>
                        )}
                        <View style={styles.viewBtn}>
                          <Ionicons name="eye-outline" size={14} color="#111827" />
                          <Text style={styles.viewBtnText}>ნახვა</Text>
                            </View>
                          </View>
                            </View>
                  </TouchableOpacity>
                );
              })
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
    paddingVertical: 16,
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

  // Scroll
  scrollView: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 60,
    gap: 20,
  },

  // Stats Row
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  statIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 20,
    fontFamily: 'HelveticaMedium',
    color: '#111827',
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 11,
    fontFamily: 'HelveticaMedium',
    color: '#9CA3AF',
    textTransform: 'uppercase',
  },

  // Filter Tabs
  filterRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 5,
    gap: 8,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  filterTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  filterTabActive: {
    backgroundColor: '#111827',
  },
  filterTabText: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  filterTabTextActive: {
    color: '#FFFFFF',
  },
  filterBadge: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 22,
    alignItems: 'center',
  },
  filterBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  filterBadgeText: {
    fontSize: 10,
    fontFamily: 'HelveticaMedium',
    color: '#9CA3AF',
    fontWeight: '700',
  },
  filterBadgeTextActive: {
    color: '#FFFFFF',
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

  // Empty State
  emptyCard: {
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
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: 'HelveticaMedium',
    color: '#111827',
    textTransform: 'uppercase',
  },
  emptySubtitle: {
    fontSize: 13,
    fontFamily: 'HelveticaMedium',
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
  },

  // Request Card
  requestCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  requestTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  serviceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  serviceChipText: {
    fontSize: 11,
    fontFamily: 'HelveticaMedium',
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusChipText: {
    fontSize: 11,
    fontFamily: 'HelveticaMedium',
    fontWeight: '700',
    textTransform: 'uppercase',
  },

  // Request Main Info
  requestMainInfo: {
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
  requestTextCol: {
    flex: 1,
    gap: 3,
  },
  requestTitle: {
    fontSize: 16,
    fontFamily: 'HelveticaMedium',
    color: '#111827',
    fontWeight: '700',
  },
  requestVehicle: {
    fontSize: 13,
    fontFamily: 'HelveticaMedium',
    color: '#6B7280',
  },

  // Request Description
  requestDescBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  requestDescText: {
    fontSize: 13,
    fontFamily: 'HelveticaMedium',
    color: '#374151',
    lineHeight: 20,
  },

  // Request Footer
  requestFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    marginTop: 2,
  },
  requestFooterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  requestTimeText: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    color: '#9CA3AF',
  },
  requestFooterRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  offersChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  offersChipText: {
    fontSize: 11,
    fontFamily: 'HelveticaMedium',
    color: '#059669',
    fontWeight: '700',
  },
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  viewBtnText: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    color: '#111827',
    textTransform: 'uppercase',
  },
});
