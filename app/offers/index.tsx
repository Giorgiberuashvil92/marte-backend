import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { useUser } from '@/contexts/UserContext';
import { requestsApi, type Request, type Offer } from '@/services/requestsApi';

type RequestWithOffers = {
  request: Request;
  offers: Offer[];
};

export default function OffersHubScreen() {
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [groups, setGroups] = useState<RequestWithOffers[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    try {
      const requests = await requestsApi.getRequests(user.id);
      const reqList = Array.isArray(requests) ? requests : [];
      const withOffers: RequestWithOffers[] = [];
      await Promise.all(
        reqList.map(async (r: Request) => {
          const offers = await requestsApi.getOffers(r.id).catch(() => []);
          const list = Array.isArray(offers) ? offers : [];
          if (list.length > 0) withOffers.push({ request: r, offers: list });
        })
      );
      withOffers.sort((a, b) => (b.request.updatedAt || 0) - (a.request.updatedAt || 0));
      setGroups(withOffers);
      setExpandedId((prev) => (prev && withOffers.some((g) => g.request.id === prev)) ? prev : withOffers[0]?.request.id ?? null);
    } catch (e) {
      console.error('[OffersHub] load error:', e);
      setGroups([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const toggleExpand = (requestId: string) => {
    setExpandedId((prev) => (prev === requestId ? null : requestId));
  };

  const getTimeAgo = (ts: number | string | undefined): string => {
    if (ts == null) return '';
    const t = typeof ts === 'number' ? ts : typeof ts === 'string' ? new Date(ts).getTime() : NaN;
    if (!Number.isFinite(t)) return '';
    const d = Math.max(0, Date.now() - t);
    if (d < 60000) return 'ახლა';
    if (d < 3600000) return `${Math.floor(d / 60000)} წთ`;
    if (d < 86400000) return `${Math.floor(d / 3600000)} სთ`;
    return `${Math.floor(d / 86400000)} დღე`;
  };

  const requestTitle = (r: Request) =>
    r.service === 'parts'
      ? r.partName
      : r.service === 'mechanic'
        ? (r as any).problemName || 'ხელოსანი'
        : r.service === 'tow'
          ? 'ევაკუატორი'
          : r.service === 'rental'
            ? 'ქირაობა'
            : r.partName || 'მოთხოვნა';

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
          <View style={styles.loadingWrap}>
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
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>შეთავაზებები</Text>
          <View style={styles.headerBtn}>
            <Text style={styles.headerCountText}>
              {groups.reduce((sum, g) => sum + g.offers.length, 0)}
            </Text>
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#111827" colors={['#111827']} />
          }
        >
          {groups.length === 0 ? (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="pricetag-outline" size={40} color="#9CA3AF" />
              </View>
              <Text style={styles.emptyTitle}>შეთავაზებები არ არის</Text>
              <Text style={styles.emptySubtitle}>
                მოთხოვნებზე მიღებული შეთავაზებები აქ გამოჩნდება
              </Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/all-requests' as any)} activeOpacity={0.7}>
                <Text style={styles.primaryBtnText}>ჩემი მოთხოვნები</Text>
              </TouchableOpacity>
            </View>
          ) : (
            groups.map(({ request, offers }) => {
              const isExpanded = expandedId === request.id;
              const vehicle = request.vehicle;
              const vehicleStr =
                vehicle?.make && vehicle?.model
                  ? `${vehicle.make} ${vehicle.model}${vehicle.year ? ` (${vehicle.year})` : ''}`
                  : '';

              return (
                <View key={request.id} style={styles.parentCard}>
                  <TouchableOpacity
                    style={styles.parentHeader}
                    onPress={() => toggleExpand(request.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.parentIconWrap}>
                      <Ionicons name="document-text-outline" size={22} color="#2563EB" />
                    </View>
                    <View style={styles.parentBody}>
                      <Text style={styles.parentTitle} numberOfLines={1}>
                        {requestTitle(request)}
                      </Text>
                      {vehicleStr ? (
                        <Text style={styles.parentSubtitle} numberOfLines={1}>
                          {vehicleStr}
                        </Text>
                      ) : null}
                      <Text style={styles.parentMeta}>
                        {offers.length} შეთავაზება
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.openDetailBtn}
                      onPress={(e) => {
                        e.stopPropagation();
                        router.push(`/offers/${request.id}` as any);
                      }}
                    >
                      <Text style={styles.openDetailBtnText}>ნახვა</Text>
                    </TouchableOpacity>
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={22}
                      color="#2563EB"
                    />
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={styles.childrenWrap}>
                      {offers.map((offer) => {
                        const price = (offer as any)?.price ?? offer.priceGEL;
                        const etaStr = typeof offer.etaMin === 'number' && Number.isFinite(offer.etaMin) ? `${offer.etaMin} წთ` : '';
                        const timeStr = getTimeAgo(offer.createdAt);
                        const metaParts = [etaStr, timeStr].filter(Boolean);
                        return (
                          <View key={offer.id} style={styles.childCard}>
                            <View style={styles.childRow}>
                              <View style={styles.childIconWrap}>
                                <Ionicons name="storefront-outline" size={18} color="#2563EB" />
                              </View>
                              <View style={styles.childBody}>
                                <Text style={styles.childTitle} numberOfLines={1}>
                                  {offer.providerName || 'მაღაზია'}
                                </Text>
                                {metaParts.length > 0 && (
                                  <Text style={styles.childMeta}>{metaParts.join(' · ')}</Text>
                                )}
                              </View>
                              <Text style={styles.childPrice}>
                                {typeof price === 'number' && Number.isFinite(price) ? `${price} ₾` : '—'}
                              </Text>
                            </View>
                            <View style={styles.childActionsRow}>
                              <TouchableOpacity
                                style={styles.childViewBtn}
                                onPress={() => router.push(`/offers/${request.id}` as any)}
                                activeOpacity={0.7}
                              >
                                <Ionicons name="eye-outline" size={14} color="#FFFFFF" />
                                <Text style={styles.childViewBtnText}>ნახვა</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.childChatBtn}
                                onPress={() =>
                                  router.push(`/chat/${request.id}/${offer.partnerId || offer.userId}` as any)
                                }
                                activeOpacity={0.7}
                              >
                                <Ionicons name="chatbubbles-outline" size={14} color="#111827" />
                                <Text style={styles.childChatBtnText}>მიწერა</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })
          )}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
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
  headerCountText: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    fontWeight: '600',
    color: '#111827',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    color: '#6B7280',
  },
  emptyWrap: {
    alignItems: 'center',
    paddingTop: 48,
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
    marginBottom: 24,
  },
  primaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 14,
    backgroundColor: '#111827',
  },
  primaryBtnText: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    fontWeight: '600',
    color: '#FFFFFF',
  },
  parentCard: {
    marginBottom: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  parentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  parentIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  parentBody: {
    flex: 1,
    minWidth: 0,
  },
  parentTitle: {
    fontSize: 15,
    fontFamily: 'HelveticaMedium',
    fontWeight: '700',
    color: '#111827',
  },
  parentSubtitle: {
    fontSize: 13,
    fontFamily: 'HelveticaMedium',
    color: '#6B7280',
    marginTop: 2,
  },
  parentMeta: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    color: '#9CA3AF',
    marginTop: 4,
  },
  openDetailBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#111827',
  },
  openDetailBtnText: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    fontWeight: '600',
    color: '#FFFFFF',
  },
  childrenWrap: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 4,
    gap: 10,
  },
  childCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginLeft: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2563EB',
  },
  childRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  childIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  childBody: {
    flex: 1,
    minWidth: 0,
  },
  childTitle: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    fontWeight: '600',
    color: '#111827',
  },
  childMeta: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    color: '#6B7280',
    marginTop: 2,
  },
  childPrice: {
    fontSize: 15,
    fontFamily: 'HelveticaMedium',
    fontWeight: '700',
    color: '#2563EB',
  },
  childActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  childViewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#111827',
  },
  childViewBtnText: {
    fontSize: 13,
    fontFamily: 'HelveticaMedium',
    fontWeight: '600',
    color: '#FFFFFF',
  },
  childChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  childChatBtnText: {
    fontSize: 13,
    fontFamily: 'HelveticaMedium',
    fontWeight: '600',
    color: '#111827',
  },
});
