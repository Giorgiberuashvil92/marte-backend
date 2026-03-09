import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Animated,
  TextInput,
  Modal,
  Pressable,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { requestsApi, type Request, type Offer } from '@/services/requestsApi';
import { useUser } from '@/contexts/UserContext';
import { useToast } from '@/contexts/ToastContext';
import { aiApi } from '@/services/aiApi';

const { width } = Dimensions.get('window');

export default function RequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useUser();
  const { success, error: showError } = useToast();

  const [request, setRequest] = useState<Request | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(30));

  // Offer modal
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offerPrice, setOfferPrice] = useState('');
  const [offerDescription, setOfferDescription] = useState('');
  const [isSubmittingOffer, setIsSubmittingOffer] = useState(false);

  // Seller status
  const [isSeller, setIsSeller] = useState(false);
  const [storeName, setStoreName] = useState('');

  useEffect(() => {
    fetchData();
    loadSellerStatus();

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, [id]);

  const loadSellerStatus = async () => {
    if (!user?.id) return;
    try {
      const res = await aiApi.getSellerStatus({
        userId: user.id,
        phone: user.phone,
      });
      const hasStore =
        !!(res.data?.counts?.stores && res.data.counts.stores > 0) ||
        !!(res.data?.ownedStores && res.data.ownedStores.length > 0);
      const hasDismantlers =
        !!(res.data?.counts?.dismantlers && res.data.counts.dismantlers > 0) ||
        !!(res.data?.ownedDismantlers && res.data.ownedDismantlers.length > 0);
      setIsSeller(hasStore || hasDismantlers);
      const derivedName =
        res.data?.ownedStores?.find((store: any) => store?.title)?.title?.trim() ||
        res.data?.ownedDismantlers?.find((d: any) => d?.brand)?.brand?.trim() ||
        user?.name?.trim() ||
        'მაღაზია';
      setStoreName(derivedName);
    } catch (e) {
      console.log('[RequestDetail] Failed to load seller status:', e);
    }
  };

  const fetchData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [requestData, offersData] = await Promise.all([
        requestsApi.getRequestById(id),
        requestsApi.getOffers(id),
      ]);
      setRequest(requestData);
      setOffers(offersData);
    } catch (err) {
      console.error('Failed to fetch request details:', err);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const isMyRequest = user?.id && request?.userId === user.id;
  const isActive = request?.status === 'active';

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

  const formatDate = (dateInput: number | string): string => {
    const date = new Date(dateInput);
    return date.toLocaleDateString('ka-GE', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'high':
        return '#EF4444';
      case 'medium':
        return '#F59E0B';
      case 'low':
        return '#10B981';
      default:
        return '#6B7280';
    }
  };

  const getUrgencyText = (urgency: string) => {
    switch (urgency) {
      case 'high':
        return 'სასწრაფო';
      case 'medium':
        return 'ნორმალური';
      case 'low':
        return 'დაბალი';
      default:
        return 'ნორმალური';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return 'აქტიური';
      case 'fulfilled':
        return 'შესრულებული';
      case 'cancelled':
        return 'გაუქმებული';
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return '#10B981';
      case 'fulfilled':
        return '#3B82F6';
      case 'cancelled':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  const handleDeleteRequest = () => {
    Alert.alert(
      'განცხადების წაშლა',
      'ნამდვილად გსურთ ამ განცხადების წაშლა?',
      [
        { text: 'გაუქმება', style: 'cancel' },
        {
          text: 'წაშლა',
          style: 'destructive',
          onPress: async () => {
            try {
              await requestsApi.deleteRequest(id || '');
              success('წარმატება', 'განცხადება წაიშალა');
              router.back();
            } catch (err) {
              showError('შეცდომა', 'წაშლა ვერ მოხერხდა');
            }
          },
        },
      ],
    );
  };

  const handleCreateOffer = async () => {
    if (!request || !offerPrice || !user?.id) {
      showError('შეცდომა', 'გთხოვთ შეავსოთ ფასი');
      return;
    }

    try {
      setIsSubmittingOffer(true);
      await requestsApi.createOffer({
        reqId: request.id,
        providerName: storeName || 'მაღაზია',
        priceGEL: parseFloat(offerPrice),
        etaMin: 30,
        partnerId: user.id,
        userId: request.userId,
      });

      setShowOfferModal(false);
      setOfferPrice('');
      setOfferDescription('');
      success('წარმატება!', 'შეთავაზება გაიგზავნა');
      await fetchData();
    } catch (err) {
      console.error('Error creating offer:', err);
      showError('შეცდომა', 'შეთავაზების გაგზავნა ვერ მოხერხდა');
    } finally {
      setIsSubmittingOffer(false);
    }
  };

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

  if (!request) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
          <View style={styles.header}>
            <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={22} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>განცხადება</Text>
            <View style={{ width: 40 }} />
          </View>
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="document-text-outline" size={40} color="#9CA3AF" />
            </View>
            <Text style={styles.emptyTitle}>განცხადება ვერ მოიძებნა</Text>
            <Text style={styles.emptySubtitle}>
              შესაძლოა განცხადება წაშლილია ან არ არსებობს
            </Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => router.back()}>
              <Text style={styles.emptyBtnText}>უკან დაბრუნება</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </>
    );
  }

  const urgencyColor = getUrgencyColor(request.urgency);
  const statusColor = getStatusColor(request.status);
  const myOfferExists = offers.some(
    (o) => o.userId === user?.id || o.partnerId === user?.id,
  );

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
          <Text style={styles.headerTitle}>განცხადების დეტალები</Text>
          {isMyRequest ? (
            <TouchableOpacity style={[styles.headerBtn, styles.headerBtnDanger]} onPress={handleDeleteRequest}>
              <Ionicons name="trash-outline" size={18} color="#EF4444" />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 40 }} />
          )}
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
          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
              gap: 16,
            }}
          >
            {/* Hero Card — Part Name + Status */}
            <View style={styles.heroCard}>
              <View style={styles.heroTop}>
                <View style={styles.heroIconCircle}>
                  <Ionicons name="construct" size={28} color="#111827" />
                </View>
                <View style={styles.heroChips}>
                  <View style={[styles.statusChip, { backgroundColor: `${statusColor}15` }]}>
                    <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                    <Text style={[styles.statusChipText, { color: statusColor }]}>
                      {getStatusText(request.status)}
                    </Text>
                  </View>
                  <View style={[styles.urgencyChip, { backgroundColor: `${urgencyColor}15` }]}>
                    <Ionicons name="flash" size={11} color={urgencyColor} />
                    <Text style={[styles.urgencyChipText, { color: urgencyColor }]}>
                      {getUrgencyText(request.urgency)}
                    </Text>
                  </View>
                </View>
              </View>

              <Text style={styles.heroPartName}>{request.partName}</Text>
              {request.brand && (
                <Text style={styles.heroBrand}>ბრენდი: {request.brand}</Text>
              )}

              {/* Date info */}
              <View style={styles.heroDateRow}>
                <Ionicons name="time-outline" size={14} color="#9CA3AF" />
                <Text style={styles.heroDateText}>
                  {formatDate(request.createdAt)}
                </Text>
                <Text style={styles.heroTimeAgo}>({formatTimeAgo(request.createdAt)})</Text>
              </View>

              {isMyRequest && (
                <View style={styles.myBadge}>
                  <Ionicons name="person" size={12} color="#111827" />
                  <Text style={styles.myBadgeText}>ჩემი განცხადება</Text>
                </View>
              )}
            </View>

            {/* Vehicle Card */}
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>ავტომობილი</Text>
              <View style={styles.vehicleRow}>
                <View style={styles.vehicleIconCircle}>
                  <Ionicons name="car-sport" size={24} color="#111827" />
                </View>
                <View style={styles.vehicleInfo}>
                  <Text style={styles.vehicleName}>
                    {request.vehicle.make} {request.vehicle.model}
                  </Text>
                  <View style={styles.vehicleMetaRow}>
                    <View style={styles.vehicleMetaChip}>
                      <Ionicons name="calendar-outline" size={12} color="#6B7280" />
                      <Text style={styles.vehicleMetaText}>{request.vehicle.year}</Text>
                    </View>
                    {request.vehicle.submodel && (
                      <View style={styles.vehicleMetaChip}>
                        <Ionicons name="cog-outline" size={12} color="#6B7280" />
                        <Text style={styles.vehicleMetaText}>{request.vehicle.submodel}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            </View>

            {/* Description Card */}
            {request.description && (
              <View style={styles.card}>
                <Text style={styles.sectionLabel}>აღწერა</Text>
                <View style={styles.descriptionBox}>
                  <Text style={styles.descriptionText}>{request.description}</Text>
                </View>
              </View>
            )}

            {/* Details Grid */}
            <View style={styles.detailsRow}>
              {request.budgetGEL ? (
                <View style={styles.detailCard}>
                  <View style={[styles.detailIconCircle, { backgroundColor: '#ECFDF5' }]}>
                    <Ionicons name="cash-outline" size={20} color="#10B981" />
                  </View>
                  <Text style={styles.detailValue}>{request.budgetGEL} ₾</Text>
                  <Text style={styles.detailLabel}>ბიუჯეტი</Text>
                </View>
              ) : null}
              <View style={styles.detailCard}>
                <View style={[styles.detailIconCircle, { backgroundColor: '#EEF2FF' }]}>
                  <Ionicons name="chatbubbles-outline" size={20} color="#6366F1" />
                </View>
                <Text style={styles.detailValue}>{offers.length}</Text>
                <Text style={styles.detailLabel}>შეთავაზება</Text>
              </View>
              {request.location ? (
                <View style={styles.detailCard}>
                  <View style={[styles.detailIconCircle, { backgroundColor: '#FEF3C7' }]}>
                    <Ionicons name="location-outline" size={20} color="#D97706" />
                  </View>
                  <Text style={styles.detailValue} numberOfLines={1}>
                    {request.location}
                  </Text>
                  <Text style={styles.detailLabel}>ლოკაცია</Text>
                </View>
              ) : null}
              {request.distanceKm ? (
                <View style={styles.detailCard}>
                  <View style={[styles.detailIconCircle, { backgroundColor: '#F0F9FF' }]}>
                    <Ionicons name="navigate-outline" size={20} color="#0EA5E9" />
                  </View>
                  <Text style={styles.detailValue}>{request.distanceKm} კმ</Text>
                  <Text style={styles.detailLabel}>მანძილი</Text>
                </View>
              ) : null}
            </View>

            {/* Offers Section (for request owner) */}
            {isMyRequest && offers.length > 0 && (
              <View style={styles.card}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionLabel}>შეთავაზებები</Text>
                  <TouchableOpacity
                    style={styles.seeAllBtn}
                    onPress={() => router.push(`/offers/${request.id}` as any)}
                  >
                    <Text style={styles.seeAllText}>ყველას ნახვა</Text>
                    <Ionicons name="arrow-forward" size={14} color="#111827" />
                  </TouchableOpacity>
                </View>

                {offers.slice(0, 3).map((offer, index) => (
                  <TouchableOpacity
                    key={offer.id}
                    style={[
                      styles.offerItem,
                      index === Math.min(2, offers.length - 1) && styles.offerItemLast,
                    ]}
                    onPress={() => router.push(`/offers/${request.id}` as any)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.offerAvatar}>
                      <Ionicons name="storefront-outline" size={18} color="#111827" />
                    </View>
                    <View style={styles.offerContent}>
                      <Text style={styles.offerName} numberOfLines={1}>
                        {offer.providerName}
                      </Text>
                      <Text style={styles.offerMeta}>
                        მიწოდება: {offer.etaMin} წთ
                      </Text>
                    </View>
                    <View style={styles.offerPriceChip}>
                      <Text style={styles.offerPriceText}>{offer.priceGEL} ₾</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Owner: empty offers */}
            {isMyRequest && offers.length === 0 && (
              <View style={styles.card}>
                <View style={styles.emptyOffersContainer}>
                  <View style={styles.emptyOffersIcon}>
                    <Ionicons name="hourglass-outline" size={32} color="#9CA3AF" />
                  </View>
                  <Text style={styles.emptyOffersTitle}>შეთავაზებები ჯერ არ არის</Text>
                  <Text style={styles.emptyOffersSubtitle}>
                    მაღაზიები მალე გამოგიგზავნიან შეთავაზებებს. თქვენ მიიღებთ შეტყობინებას.
                  </Text>
                </View>
              </View>
            )}

            {/* Spacer for bottom bar */}
            <View style={styles.bottomSpacer} />
          </Animated.View>
        </ScrollView>

        {/* Bottom Action Bar */}
        <View style={styles.bottomBar}>
          {isMyRequest ? (
            <View style={styles.bottomActions}>
              <TouchableOpacity
                style={styles.secondaryActionBtn}
                onPress={() => router.push(`/offers/${request.id}` as any)}
                activeOpacity={0.7}
              >
                <Ionicons name="chatbubbles-outline" size={18} color="#111827" />
                <Text style={styles.secondaryActionText}>
                  შეთავაზებები ({offers.length})
                </Text>
              </TouchableOpacity>
              {isActive && (
                <TouchableOpacity
                  style={styles.cancelActionBtn}
                  onPress={() => {
                    Alert.alert('გაუქმება', 'გსურთ განცხადების გაუქმება?', [
                      { text: 'არა', style: 'cancel' },
                      {
                        text: 'დიახ',
                        onPress: async () => {
                          try {
                            await requestsApi.updateRequest(request.id, {
                              status: 'cancelled',
                            });
                            success('წარმატება', 'განცხადება გაუქმდა');
                            await fetchData();
                          } catch {
                            showError('შეცდომა', 'გაუქმება ვერ მოხერხდა');
                          }
                        },
                      },
                    ]);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close-circle-outline" size={18} color="#EF4444" />
                  <Text style={styles.cancelActionText}>გაუქმება</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.bottomActions}>
              {isActive && !myOfferExists ? (
                <TouchableOpacity
                  style={styles.primaryActionBtn}
                  onPress={() => setShowOfferModal(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="cash-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.primaryActionText}>შეთავაზების გაგზავნა</Text>
                </TouchableOpacity>
              ) : myOfferExists ? (
                <View style={styles.sentBanner}>
                  <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                  <Text style={styles.sentBannerText}>
                    შეთავაზება უკვე გაგზავნილია
                  </Text>
                </View>
              ) : (
                <View style={styles.sentBanner}>
                  <Ionicons name="lock-closed-outline" size={20} color="#9CA3AF" />
                  <Text style={styles.sentBannerText}>განცხადება აღარ არის აქტიური</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </SafeAreaView>

      {/* Offer Modal */}
      <Modal
        visible={showOfferModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowOfferModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowOfferModal(false)}
        >
          <Pressable
            style={styles.modalContent}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHandle} />

            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>შეთავაზების გაგზავნა</Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setShowOfferModal(false)}
              >
                <Ionicons name="close" size={20} color="#111827" />
              </TouchableOpacity>
            </View>

            {/* Request Summary */}
            <View style={styles.modalSummary}>
              <View style={styles.modalSummaryRow}>
                <View style={styles.modalSummaryIcon}>
                  <Ionicons name="construct" size={16} color="#111827" />
                </View>
                <Text style={styles.modalSummaryText} numberOfLines={1}>
                  {request.partName}
                </Text>
              </View>
              <View style={styles.modalSummaryRow}>
                <View style={styles.modalSummaryIcon}>
                  <Ionicons name="car-outline" size={16} color="#111827" />
                </View>
                <Text style={styles.modalSummaryText}>
                  {request.vehicle.make} {request.vehicle.model} ({request.vehicle.year})
                </Text>
              </View>
              {request.budgetGEL && (
                <View style={styles.modalSummaryRow}>
                  <View style={styles.modalSummaryIcon}>
                    <Ionicons name="cash-outline" size={16} color="#111827" />
                  </View>
                  <Text style={styles.modalSummaryText}>
                    ბიუჯეტი: {request.budgetGEL} ₾
                  </Text>
                </View>
              )}
            </View>

            {/* Price Input */}
            <View style={styles.modalInputGroup}>
              <Text style={styles.modalInputLabel}>ფასი (₾) *</Text>
              <View style={styles.modalInputWrapper}>
                <Ionicons name="cash-outline" size={18} color="#9CA3AF" style={{ marginLeft: 14 }} />
                <TextInput
                  style={styles.modalInput}
                  placeholder="მაგ: 150"
                  placeholderTextColor="#9CA3AF"
                  value={offerPrice}
                  onChangeText={setOfferPrice}
                  keyboardType="numeric"
                />
                <Text style={styles.modalInputSuffix}>₾</Text>
              </View>
            </View>

            {/* Description Input */}
            <View style={styles.modalInputGroup}>
              <Text style={styles.modalInputLabel}>კომენტარი (არასავალდებულო)</Text>
              <TextInput
                style={styles.modalTextarea}
                placeholder="დამატებითი ინფორმაცია, მდგომარეობა, გარანტია..."
                placeholderTextColor="#9CA3AF"
                value={offerDescription}
                onChangeText={setOfferDescription}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            {/* Submit */}
            <TouchableOpacity
              style={[
                styles.modalSubmitBtn,
                (!offerPrice || isSubmittingOffer) && styles.modalSubmitBtnDisabled,
              ]}
              onPress={handleCreateOffer}
              disabled={!offerPrice || isSubmittingOffer}
              activeOpacity={0.7}
            >
              {isSubmittingOffer ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Ionicons name="send" size={16} color="#FFFFFF" />
                  <Text style={styles.modalSubmitText}>შეთავაზების გაგზავნა</Text>
                </>
              )}
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
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
    paddingVertical: 14,
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
  headerBtnDanger: {
    backgroundColor: '#FEF2F2',
  },
  headerTitle: {
    fontSize: 15,
    fontFamily: 'HelveticaMedium',
    color: '#111827',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'HelveticaMedium',
    color: '#111827',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyBtn: {
    marginTop: 20,
    backgroundColor: '#111827',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
  },
  emptyBtnText: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },

  // Scroll
  scrollView: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },

  // Hero Card
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroChips: {
    flexDirection: 'row',
    gap: 6,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusChipText: {
    fontSize: 11,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
  },
  urgencyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  urgencyChipText: {
    fontSize: 11,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
  },
  heroPartName: {
    fontSize: 22,
    fontFamily: 'HelveticaMedium',
    color: '#111827',
    textTransform: 'uppercase',
    letterSpacing: -0.3,
    marginTop: 4,
  },
  heroBrand: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    color: '#6B7280',
  },
  heroDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  heroDateText: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    color: '#6B7280',
  },
  heroTimeAgo: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    color: '#9CA3AF',
  },
  myBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 2,
  },
  myBadgeText: {
    fontSize: 11,
    fontFamily: 'HelveticaMedium',
    color: '#111827',
    textTransform: 'uppercase',
  },

  // Card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },

  // Section Label
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'HelveticaMedium',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 14,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  seeAllText: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    color: '#111827',
    textTransform: 'uppercase',
  },

  // Vehicle
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  vehicleIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleInfo: {
    flex: 1,
    gap: 6,
  },
  vehicleName: {
    fontSize: 18,
    fontFamily: 'HelveticaMedium',
    color: '#111827',
    textTransform: 'uppercase',
  },
  vehicleMetaRow: {
    flexDirection: 'row',
    gap: 8,
  },
  vehicleMetaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  vehicleMetaText: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    color: '#6B7280',
  },

  // Description
  descriptionBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  descriptionText: {
    fontSize: 15,
    fontFamily: 'HelveticaMedium',
    color: '#374151',
    lineHeight: 24,
  },

  // Details Grid
  detailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  detailCard: {
    flex: 1,
    minWidth: (width - 52) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 14,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  detailIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailValue: {
    fontSize: 18,
    fontFamily: 'HelveticaMedium',
    color: '#111827',
  },
  detailLabel: {
    fontSize: 10,
    fontFamily: 'HelveticaMedium',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Offers list
  offerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  offerItemLast: {
    borderBottomWidth: 0,
  },
  offerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  offerContent: {
    flex: 1,
    gap: 3,
  },
  offerName: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    color: '#111827',
  },
  offerMeta: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    color: '#6B7280',
  },
  offerPriceChip: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  offerPriceText: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    color: '#10B981',
  },

  // Empty offers
  emptyOffersContainer: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 10,
  },
  emptyOffersIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyOffersTitle: {
    fontSize: 15,
    fontFamily: 'HelveticaMedium',
    color: '#111827',
    textTransform: 'uppercase',
  },
  emptyOffersSubtitle: {
    fontSize: 13,
    fontFamily: 'HelveticaMedium',
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  },

  // Bottom spacer
  bottomSpacer: {
    height: 90,
  },

  // Bottom Bar
  bottomBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 30,
  },
  bottomActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  primaryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#111827',
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryActionText: {
    fontSize: 15,
    fontFamily: 'HelveticaMedium',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  secondaryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F3F4F6',
    paddingVertical: 16,
    borderRadius: 16,
  },
  secondaryActionText: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    color: '#111827',
    textTransform: 'uppercase',
  },
  cancelActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: '#FEF2F2',
  },
  cancelActionText: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    color: '#EF4444',
    textTransform: 'uppercase',
  },
  sentBanner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
  },
  sentBannerText: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    color: '#6B7280',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
    maxHeight: '85%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'HelveticaMedium',
    color: '#111827',
    textTransform: 'uppercase',
  },
  modalCloseBtn: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSummary: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
    gap: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  modalSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalSummaryIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSummaryText: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    color: '#374151',
    flex: 1,
  },
  modalInputGroup: {
    marginBottom: 16,
  },
  modalInputLabel: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  modalInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    overflow: 'hidden',
  },
  modalInput: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: 'HelveticaMedium',
    color: '#111827',
  },
  modalInputSuffix: {
    fontSize: 16,
    fontFamily: 'HelveticaMedium',
    color: '#9CA3AF',
    marginRight: 16,
  },
  modalTextarea: {
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontFamily: 'HelveticaMedium',
    color: '#111827',
    minHeight: 90,
    textAlignVertical: 'top',
  },
  modalSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#111827',
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 8,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  modalSubmitBtnDisabled: {
    opacity: 0.4,
  },
  modalSubmitText: {
    fontSize: 15,
    fontFamily: 'HelveticaMedium',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
});
