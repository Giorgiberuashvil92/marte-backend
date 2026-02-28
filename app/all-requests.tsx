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
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { requestsApi, type Request } from '@/services/requestsApi';
import { useUser } from '@/contexts/UserContext';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

// Request type is now imported from requestsApi

export default function AllRequestsScreen() {
  const { newRequest, service, requestData } = useLocalSearchParams<{
    newRequest?: string;
    service?: string;
    requestData?: string;
  }>();
  
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [requests, setRequests] = useState<Request[]>([]);
  const [offersCountMap, setOffersCountMap] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<'all' | 'აქტიური' | 'დასრულებული'>('all');
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));
  const [scaleAnim] = useState(new Animated.Value(0.9));


  useEffect(() => {
    fetchRequests();
    
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
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    if (newRequest === 'true' && requestData) {
      try {
        const parsedData = JSON.parse(requestData);
        Alert.alert(
          'მოთხოვნა გაიგზავნა!',
          `თქვენი ${service} მოთხოვნა წარმატებით გაიგზავნა. მაღაზიები გამოგიგზავნით შეთავაზებებს.`,
          [{ text: 'კარგი', onPress: () => router.replace('/all-requests') }]
        );
      } catch (error) {
        console.error('Error parsing request data:', error);
      }
    }
  }, [newRequest, requestData, service]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      // რეალური API-ს გამოძახება
      const [apiRequests, userOffers] = await Promise.all([
        requestsApi.getRequests(user?.id),
        user?.id ? requestsApi.getOffers(undefined, user.id) : Promise.resolve([]),
      ]);

      const counts: Record<string, number> = {};
      (userOffers || []).forEach((offer: any) => {
        const key = offer?.reqId;
        if (key) counts[key] = (counts[key] || 0) + 1;
      });

      setRequests(apiRequests);
      setOffersCountMap(counts);
    } catch (error) {
      console.error('Failed to fetch requests from API:', error);
      // თუ API ვერ მუშაობს, ცარიელ სიას ვაბრუნებთ
      setRequests([]);
      setOffersCountMap({});
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchRequests();
    setTimeout(() => setRefreshing(false), 1000);
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

  const getServiceIcon = (service: string) => {
    switch (service) {
      case 'parts':
        return 'construct-outline';
      case 'mechanic':
        return 'build-outline';
      case 'tow':
        return 'car-outline';
      case 'rental':
        return 'car-sport-outline';
      default:
        return 'help-outline';
    }
  };

  const getServiceColor = (service: string) => {
    switch (service) {
      case 'parts':
        return '#10B981';
      case 'mechanic':
        return '#3B82F6';
      case 'tow':
        return '#F59E0B';
      case 'rental':
        return '#8B5CF6';
      default:
        return '#6366F1';
    }
  };

  const getServiceGradient = (service: string) => {
    switch (service) {
      case 'parts':
        return ['#10B981', '#059669'];
      case 'mechanic':
        return ['#3B82F6', '#1D4ED8'];
      case 'tow':
        return ['#F59E0B', '#D97706'];
      case 'rental':
        return ['#8B5CF6', '#7C3AED'];
      default:
        return ['#6366F1', '#4F46E5'];
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'აქტიური':
        return '#10B981';
      case 'დასრულებული':
        return '#6B7280';
      case 'პენდინგი':
        return '#F59E0B';
      default:
        return '#6366F1';
    }
  };

  // ახალი ფერთა ლოგიკა სტატუსის ჩიფებისთვის (მუშაობს როგორც ქართულ, ისე ინგლისურ სტატუსებზე)
  const getStatusChipColors = (status: string) => {
    const normalized = (status || '').toLowerCase();
    if (normalized === 'active' || status === 'აქტიური') {
      return { bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.35)', text: '#10B981' };
    }
    if (normalized === 'fulfilled' || status === 'დასრულებული' || normalized === 'completed') {
      return { bg: 'rgba(107, 114, 128, 0.15)', border: 'rgba(107, 114, 128, 0.35)', text: '#9CA3AF' };
    }
    if (normalized === 'pending' || status === 'პენდინგი') {
      return { bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.35)', text: '#F59E0B' };
    }
    return { bg: 'rgba(99, 102, 241, 0.15)', border: 'rgba(99, 102, 241, 0.35)', text: '#6366F1' };
  };

  const getAttentionBadgeColors = (count?: number) => {
    const hasNew = !!count && count > 0;
    if (hasNew) {
      // წითელი, რომ უფრო შეიმჩნიოს ახალი შეთავაზება
      return { bg: 'rgba(239, 68, 68, 0.18)', text: '#EF4444', border: 'rgba(239, 68, 68, 0.35)' };
    }
    return { bg: 'rgba(99, 102, 241, 0.2)', text: '#6366F1', border: 'rgba(99, 102, 241, 0.3)' };
  };

  const filteredRequests = requests.filter(request => {
    if (filter === 'active') return request.status === 'active';
    if (filter === 'completed') return request.status === 'fulfilled';
    return true;
  });

  const activeCount = requests.filter(r => r.status === 'active').length;
  const completedCount = requests.filter(r => r.status === 'fulfilled').length;
  const newOffersCount = requests.reduce((sum, r: any) => {
    const offers =
      offersCountMap[r?.id] ??
      r?.offersCount ??
      r?.offers?.length ??
      r?.unreadOffersCount ??
      0;
    return sum + (offers || 0);
  }, 0);

  const handleRequestPress = (request: Request) => {
    // Navigate to offers page first, then to chat
    router.push(`/offers/${request.id}` as any);
  };

  const handleCreateRequest = () => {
    router.push('/service-form');
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
        
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
          <Animated.View 
            style={[
              styles.content,
              {
                opacity: fadeAnim,
                transform: [
                  { translateY: slideAnim },
                  { scale: scaleAnim }
                ]
              }
            ]}
          >
            {/* Header */}
            <View style={styles.headerSection}>
              <View style={styles.headerContainer}>
                <Pressable style={styles.backButton} onPress={() => router.back()}>
                  <Ionicons name="arrow-back" size={20} color="#0B64D4" />
                </Pressable>
                <View style={styles.headerTextWrap}>
                  <Text style={styles.heroTitle}>ჩემი მოთხოვნები</Text>
                  <Text style={styles.heroSubtitle}>
                    {requests.length} მოთხოვნა • {filteredRequests.length} ჩანს
                  </Text>
                </View>
              </View>
              <View style={styles.summaryRow}>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>აქტიური</Text>
                  <Text style={styles.summaryValue}>{activeCount}</Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>შეთავაზებები</Text>
                  <View style={styles.summaryBadge}>
                    <Ionicons name="chatbubbles-outline" size={14} color="#10B981" />
                    <Text style={styles.summaryValueSmall}>{newOffersCount}</Text>
                  </View>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>დასრულებული</Text>
                  <Text style={styles.summaryValue}>{completedCount}</Text>
                </View>
              </View>
            </View>

            {/* Requests List */}
            <View style={styles.requestsSection}>
              <Text style={styles.sectionTitle}>მოთხოვნები</Text>
              <ScrollView 
                style={styles.requestsContainer}
                contentContainerStyle={styles.requestsContent}
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
                {filteredRequests.map((request, index) => {
                  const offersCount =
                    offersCountMap[request.id] ??
                    (request as any)?.offersCount ??
                    (request as any)?.offers?.length ??
                    (request as any)?.unreadOffersCount ??
                    0;
                  const badge = getAttentionBadgeColors(offersCount);
                  const statusChip = getStatusChipColors(request.status as any);
                  const title =
                    request.service === 'parts' ? request.partName :
                    request.service === 'mechanic' ? (request as any).problemName || 'ხელოსანი' :
                    request.service === 'tow' ? 'ევაკუატორი' :
                    request.service === 'rental' ? 'ქირაობა' :
                    request.partName || 'მოთხოვნა';

                  return (
                    <Animated.View
                      key={request.id || index}
                      style={[
                        styles.requestWrapper,
                        {
                          transform: [
                            { 
                              translateY: slideAnim.interpolate({
                                inputRange: [0, 50],
                                outputRange: [0, 50 + (index * 20)],
                                extrapolate: 'clamp',
                              })
                            }
                          ]
                        }
                      ]}
                    >
                      <Pressable
                        style={styles.requestCard}
                        onPress={() => handleRequestPress(request)}
                      >
                        <LinearGradient
                          colors={['#FFFFFF', '#F8FAFC']}
                          style={styles.requestCardGradient}
                        >
                          <View style={styles.requestTopRow}>
                            <View style={[styles.serviceChip, { borderColor: getServiceColor(request.service || 'parts') + '33', backgroundColor: getServiceColor(request.service || 'parts') + '15' }]}>
                              <View style={styles.serviceChipIcon}>
                                <Ionicons name={getServiceIcon(request.service || 'parts') as any} size={16} color={getServiceColor(request.service || 'parts')} />
                              </View>
                              <Text style={[styles.serviceChipText, { color: getServiceColor(request.service || 'parts') }]}>
                                {request.service === 'parts' ? 'ნაწილები' :
                                  request.service === 'mechanic' ? 'ხელოსანი' :
                                  request.service === 'tow' ? 'ევაკუატორი' :
                                  request.service === 'rental' ? 'ქირაობა' : 'სერვისი'}
                              </Text>
                            </View>
                            <View style={[styles.statusBadgeNew, { backgroundColor: statusChip.bg, borderColor: statusChip.border }]}>
                              <Text style={[styles.statusText, { color: statusChip.text }]}>{request.status}</Text>
                            </View>
                          </View>

                          <View style={styles.titleRowNew}>
                            {Boolean((request as any)?.unreadOffersCount) && <View style={styles.unreadDot} />}
                            <Text style={styles.requestTitle}>{title}</Text>
                            {offersCount > 0 && (
                              <View style={styles.hasOffersBadge}>
                                <Ionicons name="checkmark-circle" size={16} color="#EF4444" />
                                <Text style={styles.hasOffersBadgeText}>შეთავაზება აქვს</Text>
                              </View>
                            )}
                          </View>

                          <Text style={styles.requestSubtitle}>
                            {request?.vehicle?.make && request?.vehicle?.model && request?.vehicle?.year
                              ? `${request.vehicle.make} ${request.vehicle.model} (${request.vehicle.year})`
                              : 'მანქანის მონაცემები მიუწვდომელია'}
                          </Text>

                          {request.description ? (
                            <Text style={styles.requestDescription} numberOfLines={2}>
                              {request.description}
                            </Text>
                          ) : null}

                          <View style={styles.requestFooterNew}>
                            <View style={styles.timeContainer}>
                              <Ionicons name="time-outline" size={12} color="#9CA3AF" />
                              <Text style={styles.timeText}>{formatTimeAgo(request.createdAt)}</Text>
                            </View>
                            <View style={styles.offersQuick}>
                              <View style={[styles.offersPill, { backgroundColor: badge.bg, borderColor: badge.border }]}>
                                <Ionicons name="chatbubbles-outline" size={14} color={badge.text} />
                                <Text style={[styles.offersCountText, { color: badge.text }]}>{offersCount}</Text>
                              </View>
                              <Text style={styles.offersLabel}>შეთავაზება{offersCount === 1 ? '' : 'ები'}</Text>
                            </View>
                          </View>

                          <View style={styles.actionRow}>
                            <Text style={styles.actionText}>გახსენი შეთავაზებები</Text>
                            <View style={styles.serviceArrow}>
                              <Ionicons name="arrow-forward" size={16} color="#6366F1" />
                            </View>
                          </View>
                        </LinearGradient>
                      </Pressable>
                    </Animated.View>
                  );
                })}
                
                {filteredRequests.length === 0 && (
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
                      <Ionicons name="document-outline" size={40} color="#6366F1" />
                    </View>
                    <Text style={styles.emptyTitle}>მოთხოვნები ჯერ არ არის</Text>
                    <Text style={styles.emptySubtitle}>
                      შექმენით ახალი მოთხოვნა სერვისების გამოყენებით
                    </Text>
                   
                  </Animated.View>
                )}
              </ScrollView>
            </View>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F6F7FB',
  },
  container: {
    flex: 1,
    backgroundColor: '#F6F7FB',
  },
  content: {
    padding: 20,
    paddingBottom: 20,
    gap: 18,
  },

  // Hero Section
  heroSection: {
    marginTop: 10,
  },
  headerSection: {
    marginTop: 4,
    marginBottom: 8,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
  },
  headerTextWrap: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  heroTitle: {
    fontSize: 24,
    color: '#0F172A',
    textAlign: 'left',
    letterSpacing: -0.5,
    fontWeight: '800',
    marginTop: 0,
  },
  heroSubtitle: {
    fontSize: 12,
    color: '#475569',
    textAlign: 'left',
    lineHeight: 18,
    fontWeight: '500',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
  },
  summaryLabel: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 18,
    color: '#0F172A',
    fontWeight: '800',
  },
  summaryValueSmall: {
    fontSize: 16,
    color: '#10B981',
    fontWeight: '800',
  },
  summaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },

  // Quick Actions
  quickActionsSection: {
    gap: 20,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  quickActionCard: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  quickActionGradient: {
    padding: 16,
  },
  quickActionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quickActionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
    flex: 1,
  },

  // Filter Section
  filterSection: {
    gap: 12,
  },
  filterScroll: {
    gap: 16,
  },
  filterTab: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  filterTabActive: {
    backgroundColor: '#E8F0FF',
    borderColor: '#C7DCFF',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  filterTabGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  filterTabText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '700',
  },
  filterTabTextActive: {
    color: '#0B64D4',
    fontWeight: '700',
  },
  filterBadge: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 24,
    alignItems: 'center',
  },
  filterBadgeActive: {
    backgroundColor: '#E0EAFF',
  },
  filterBadgeText: {
    fontSize: 10,
    color: '#475569',
    fontWeight: '700',
  },
  filterBadgeTextActive: {
    color: '#0B64D4',
  },

  // Requests Section
  requestsSection: {
    gap: 12,
    marginTop: 6,
  },
  sectionTitle: {
    fontSize: 20,
    color: '#0F172A',
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  requestsContainer: {
    maxHeight: 'auto',
  },
  requestsContent: {
    gap: 12,
    paddingBottom: 16,
  },
  requestWrapper: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  requestCard: {
    flex: 1,
  },
  requestCardGradient: {
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    gap: 10,
  },
  requestTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  serviceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  serviceChipIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(99,102,241,0.08)',
  },
  serviceChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusBadgeNew: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  serviceGradient: {
    padding: 14,
    minHeight: 104,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  serviceContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    position: 'relative',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titleRowNew: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  hasOffersBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  hasOffersBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EF4444',
  },
  serviceLeft: {
    width: 56,
    alignItems: 'center',
  },
  serviceIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestInfo: {
    alignItems: 'flex-start',
    gap: 6,
    flex: 1,
  },
  requestTitle: {
    fontSize: 15,
    color: '#0F172A',
    textAlign: 'left',
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  requestSubtitle: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'left',
    fontWeight: '600',
    letterSpacing: 0.2,
    lineHeight: 14,
  },
  requestDescription: {
    fontSize: 12,
    color: '#4B5563',
    textAlign: 'left',
    fontWeight: '400',
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 4,
  },
  // divider removed per design
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  locationText: {
    fontSize: 10,
    color: '#475569',
    fontWeight: '500',
  },
  requestFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginTop: 10,
  },
  requestFooterNew: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  statusContainer: {
    flex: 1,
    alignItems: 'flex-end',
  },
  statusBadge: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#EEF2F6',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  offersQuick: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  offersContainer: {
    position: 'absolute',
    top: 12,
    right: 12,
    alignItems: 'flex-end',
    gap: 8,
  },
  offersPillar: {
    alignItems: 'flex-end',
    gap: 6,
  },
  offersPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  offersCountText: {
    fontSize: 12,
    fontWeight: '800',
  },
  offersLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  actionRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionText: {
    fontSize: 13,
    color: '#0B64D4',
    fontWeight: '700',
  },
  serviceArrow: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 16,
  },
  emptyIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E0EAFF',
    borderWidth: 1,
    borderColor: '#C7DCFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    color: '#0F172A',
    textAlign: 'center',
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 18,
    fontWeight: '500',
  },
  emptyButton: {
    marginTop: 8,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#6366F1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  emptyButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});