import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
  StatusBar,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useUser } from '@/contexts/UserContext';
import { addItemApi } from '@/services/addItemApi';

type ListingType = 'store' | 'dismantler' | 'mechanic' | 'service';

interface BaseListing {
  type: ListingType;
  id: string;
  title: string;
  expiryDate?: string | null;
  createdAt?: string;
  isFeatured?: boolean;
}

interface StoreItem {
  _id: string;
  id?: string;
  title?: string;
  name?: string;
  expiryDate?: string;
  createdAt?: string;
  isFeatured?: boolean;
}

interface DismantlerItem {
  _id: string;
  id?: string;
  brand?: string;
  model?: string;
  expiryDate?: string;
  createdAt?: string;
  isFeatured?: boolean;
}

interface MechanicItem {
  _id: string;
  id?: string;
  name?: string;
  expiryDate?: string;
  createdAt?: string;
  isFeatured?: boolean;
}

interface ServiceItem {
  _id: string;
  id?: string;
  name?: string;
  expiryDate?: string;
  createdAt?: string;
  isFeatured?: boolean;
}

const SECTION_CONFIG: Record<ListingType, { title: string; icon: string; color: string }> = {
  store: { title: 'მაღაზიები', icon: 'storefront-outline', color: '#10B981' },
  dismantler: { title: 'დაშლილები', icon: 'car-outline', color: '#EF4444' },
  mechanic: { title: 'ხელოსნები', icon: 'build-outline', color: '#3B82F6' },
  service: { title: 'სერვისები', icon: 'construct-outline', color: '#8B5CF6' },
};

function getExpiryDate(item: { expiryDate?: string; createdAt?: string }): Date | null {
  if (item.expiryDate) return new Date(item.expiryDate);
  if (item.createdAt) {
    const d = new Date(item.createdAt);
    d.setMonth(d.getMonth() + 1);
    return d;
  }
  return null;
}

function getDaysUntilExpiry(item: { expiryDate?: string; createdAt?: string }): number | null {
  const expiry = getExpiryDate(item);
  if (!expiry) return null;
  const diff = expiry.getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatExpiry(item: { expiryDate?: string; createdAt?: string }): string {
  const expiry = getExpiryDate(item);
  if (!expiry) return 'უცნობი';
  return expiry.toLocaleDateString('ka-GE', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatCreated(item: { createdAt?: string }): string {
  if (!item.createdAt) return 'უცნობი';
  const d = new Date(item.createdAt);
  return d.toLocaleDateString('ka-GE', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getRenewalPrice(type: ListingType, item: { isFeatured?: boolean }): number {
  if (type === 'store') return item.isFeatured ? 20 : 5;
  if (type === 'dismantler') return 5;
  if (type === 'mechanic') return 20;
  if (type === 'service') return 20;
  return 0;
}

export default function BusinessPanelScreen() {
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [renewingId, setRenewingId] = useState<string | null>(null);
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [dismantlers, setDismantlers] = useState<DismantlerItem[]>([]);
  const [mechanics, setMechanics] = useState<MechanicItem[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);

  const loadData = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    try {
      const normId = user.id.startsWith('usr_') ? user.id.replace('usr_', '') : user.id;
      const [storesRes, dismantlersRes, mechanicsRes1, mechanicsRes2, servicesRes1, servicesRes2] = await Promise.all([
        addItemApi.getStores({ ownerId: user.id }),
        addItemApi.getDismantlers({ ownerId: user.id }),
        addItemApi.getMechanics({ ownerId: user.id }),
        addItemApi.getMechanics({ ownerId: normId }),
        addItemApi.getServices({ ownerId: user.id }),
        addItemApi.getServices({ ownerId: normId }),
      ]);

      const storeList = (storesRes.success && storesRes.data ? storesRes.data : Array.isArray(storesRes) ? storesRes : []) as StoreItem[];
      setStores(Array.isArray(storeList) ? storeList : []);
      if (storeList?.length > 0) {
        console.log('[BusinessPanel] sample store keys:', Object.keys(storeList[0]));
        console.log('[BusinessPanel] sample store createdAt/expiryDate:', { createdAt: (storeList[0] as any).createdAt, expiryDate: (storeList[0] as any).expiryDate });
      }

      const dismantlerList = (dismantlersRes.success && dismantlersRes.data ? dismantlersRes.data : Array.isArray(dismantlersRes) ? dismantlersRes : []) as DismantlerItem[];
      setDismantlers(Array.isArray(dismantlerList) ? dismantlerList : []);
      if (dismantlerList?.length > 0) {
        console.log('[BusinessPanel] sample dismantler keys:', Object.keys(dismantlerList[0]));
        console.log('[BusinessPanel] sample dismantler createdAt/expiryDate:', { createdAt: (dismantlerList[0] as any).createdAt, expiryDate: (dismantlerList[0] as any).expiryDate });
      }

      const mech1 = (mechanicsRes1.success && mechanicsRes1.data ? mechanicsRes1.data : Array.isArray(mechanicsRes1) ? mechanicsRes1 : []) as MechanicItem[];
      const mech2 = (mechanicsRes2.success && mechanicsRes2.data ? mechanicsRes2.data : Array.isArray(mechanicsRes2) ? mechanicsRes2 : []) as MechanicItem[];
      const allMech = [...mech1, ...mech2];
      const uniqueMech = allMech.filter((m, i, arr) => arr.findIndex(x => (x._id || x.id) === (m._id || m.id)) === i);
      setMechanics(uniqueMech);
      if (uniqueMech.length > 0) {
        console.log('[BusinessPanel] sample mechanic keys:', Object.keys(uniqueMech[0]));
        console.log('[BusinessPanel] sample mechanic createdAt/expiryDate:', { createdAt: (uniqueMech[0] as any).createdAt, expiryDate: (uniqueMech[0] as any).expiryDate });
      }

      const srv1 = (servicesRes1.success && servicesRes1.data ? servicesRes1.data : Array.isArray(servicesRes1) ? servicesRes1 : []) as ServiceItem[];
      const srv2 = (servicesRes2.success && servicesRes2.data ? servicesRes2.data : Array.isArray(servicesRes2) ? servicesRes2 : []) as ServiceItem[];
      const allSrv = [...srv1, ...srv2];
      const uniqueSrv = allSrv.filter((s, i, arr) => arr.findIndex(x => (x._id || x.id) === (s._id || s.id)) === i);
      setServices(uniqueSrv);
      if (uniqueSrv.length > 0) {
        console.log('[BusinessPanel] sample service keys:', Object.keys(uniqueSrv[0]));
        console.log('[BusinessPanel] sample service createdAt/expiryDate:', { createdAt: (uniqueSrv[0] as any).createdAt, expiryDate: (uniqueSrv[0] as any).expiryDate });
      }
    } catch (e) {
      console.error('[BusinessPanel] load error:', e);
      setStores([]);
      setDismantlers([]);
      setMechanics([]);
      setServices([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      if (user?.id) loadData();
    }, [user?.id, loadData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleRenewStore = (store: StoreItem) => {
    const storeId = store._id || store.id;
    if (!storeId) return;
    const title = store.title || store.name || 'მაღაზია';
    const price = store.isFeatured ? 20 : 5;
    Alert.alert(
      'განცხადების განახლება',
      `გსურთ განაახლოთ "${title}"? განახლება ღირს ${price}₾.`,
      [
        { text: 'გაუქმება', style: 'cancel' },
        {
          text: 'გადახდა',
          onPress: () => {
            setRenewingId(storeId);
            router.push({
              pathname: '/payment-card',
              params: {
                amount: price.toString(),
                description: `განახლება - ${title}`,
                context: 'store-renewal',
                orderId: `store_renewal_${storeId}_${Date.now()}`,
                metadata: JSON.stringify({
                  storeId,
                  tier: store.isFeatured ? 'vip' : 'regular',
                  userId: user?.id,
                }),
              },
            } as any);
            setRenewingId(null);
          },
        },
      ]
    );
  };

  const handleRenewDismantler = (d: DismantlerItem) => {
    const id = d._id || d.id;
    if (!id) return;
    const title = d.brand && d.model ? `${d.brand} ${d.model}` : 'დაშლილი';
    Alert.alert(
      'განცხადების განახლება',
      `გსურთ განაახლოთ "${title}"? განახლება ღირს 5₾.`,
      [
        { text: 'გაუქმება', style: 'cancel' },
        {
          text: 'გადახდა',
          onPress: () => {
            setRenewingId(id);
            router.push({
              pathname: '/payment-card',
              params: {
                amount: '5',
                description: `განახლება - ${title}`,
                context: 'dismantler-renewal',
                orderId: `dismantler_renewal_${id}_${Date.now()}`,
                metadata: JSON.stringify({
                  dismantlerId: id,
                  userId: user?.id,
                }),
              },
            } as any);
            setRenewingId(null);
          },
        },
      ]
    );
  };

  const handleRenewMechanic = (m: MechanicItem) => {
    const id = m._id || m.id;
    if (!id) return;
    const title = m.name || 'ხელოსანი';
    Alert.alert(
      'განცხადების განახლება',
      `გსურთ განაახლოთ "${title}"? განახლება ღირს 20₾.`,
      [
        { text: 'გაუქმება', style: 'cancel' },
        {
          text: 'გადახდა',
          onPress: () => {
            setRenewingId(id);
            router.push({
              pathname: '/payment-card',
              params: {
                amount: '20',
                description: `განახლება - ${title}`,
                context: 'mechanic-renewal',
                orderId: `mechanic_renewal_${id}_${Date.now()}`,
                metadata: JSON.stringify({ mechanicId: id, userId: user?.id }),
              },
            } as any);
            setRenewingId(null);
          },
        },
      ]
    );
  };

  const handleRenewService = (s: ServiceItem) => {
    const id = s._id || s.id;
    if (!id) return;
    const title = s.name || 'სერვისი';
    Alert.alert(
      'განცხადების განახლება',
      `გსურთ განაახლოთ "${title}"? განახლება ღირს 20₾.`,
      [
        { text: 'გაუქმება', style: 'cancel' },
        {
          text: 'გადახდა',
          onPress: () => {
            setRenewingId(id);
            router.push({
              pathname: '/payment-card',
              params: {
                amount: '20',
                description: `განახლება - ${title}`,
                context: 'service-renewal',
                orderId: `service_renewal_${id}_${Date.now()}`,
                metadata: JSON.stringify({ serviceId: id, userId: user?.id }),
              },
            } as any);
            setRenewingId(null);
          },
        },
      ]
    );
  };

  const renderCard = (
    type: ListingType,
    item: StoreItem | DismantlerItem | MechanicItem | ServiceItem,
    title: string,
    onRenew: () => void
  ) => {
    const raw = item as any;
    const createdStr = formatCreated(item);
    const expiryStr = formatExpiry(item);
    console.log('[BusinessPanel] renderCard', { type, title, createdAt: raw.createdAt, expiryDate: raw.expiryDate, formatCreated: createdStr, formatExpiry: expiryStr });

    const id = raw._id || raw.id;
    const days = getDaysUntilExpiry(item);
    const isExpired = days !== null && days <= 0;
    const isSoon = days !== null && days > 0 && days <= 7;
    const config = SECTION_CONFIG[type];
    const isRenewing = renewingId === id;
    const price = getRenewalPrice(type, item);
    const statusText = isExpired ? 'ვადა გაუვიდა' : isSoon ? 'მალე ვადა' : 'აქტიური';
    const statusColor = isExpired ? '#EF4444' : isSoon ? '#F59E0B' : '#10B981';

    const subtitle = `${expiryStr} · ${statusText}${days != null && !isExpired ? ` · ${days} დღე` : ''}`;

    const canRenew = isExpired || isSoon || days == null;
    const renewalLabel = isExpired
      ? 'განახლება საჭიროა'
      : isSoon
        ? 'განახლება (წინასწარ)'
        : 'განახლება';
    const renewalValue =
      !canRenew
        ? (days != null ? `${days} დღის შემდეგ` : 'აქტიურია')
        : null;

    const photoUrl =
      (type === 'store' && (raw.images?.[0] || raw.photos?.[0])) ||
      (type === 'dismantler' && raw.photos?.[0]) ||
      (type === 'mechanic' && raw.avatar) ||
      (type === 'service' && (raw.images?.[0] || raw.photos?.[0])) ||
      null;

    return (
      <View key={`${type}-${id}`} style={styles.wireframeCard}>
        {/* ზედა დიდი ბლოკი: ფოტო ან აიქონი + სათაური + ქვესათაური */}
        <View style={styles.wireframeTop}>
          <View style={[styles.wireframeIconBox, { backgroundColor: config.color + '22' }]}>
            {photoUrl ? (
              <Image source={{ uri: photoUrl }} style={styles.wireframePhoto} resizeMode="cover" />
            ) : (
              <Ionicons name={config.icon as any} size={40} color={config.color} />
            )}
          </View>
          <Text style={styles.wireframeTitle} numberOfLines={2}>{title}</Text>
          <Text style={[styles.wireframeSubtitle, { color: statusColor }]} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
        {/* ქვედა მცირე ზოლები: მარცხნივ ინფო, მარჯვნივ აქცია */}
        <View style={styles.wireframeStrips}>
          <View style={styles.stripRow}>
            <Text style={styles.stripLabel}>შექმნის თარიღი</Text>
            <Text style={styles.stripValue}>{createdStr}</Text>
          </View>
          <View style={styles.stripRow}>
            <Text style={styles.stripLabel}>ვადის გასვლა</Text>
            <Text style={[styles.stripValue, isExpired && styles.stripValueDanger]}>{expiryStr}</Text>
          </View>
          <View style={styles.stripRow}>
            <Text style={styles.stripLabel}>{renewalLabel}</Text>
            {canRenew ? (
              <TouchableOpacity
                style={[styles.stripButton, { backgroundColor: config.color }]}
                onPress={onRenew}
                disabled={isRenewing}
                activeOpacity={0.85}
              >
                {isRenewing ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.stripButtonText}>{price} ₾</Text>
                )}
              </TouchableOpacity>
            ) : (
              <Text style={[styles.stripValue, styles.stripValueRight]} numberOfLines={1}>{renewalValue}</Text>
            )}
          </View>
          <View style={styles.stripRow}>
            <Text style={styles.stripLabel}>შეთავაზებები</Text>
            <TouchableOpacity
              style={[styles.stripButton, { backgroundColor: '#F59E0B' }]}
              onPress={() =>
                router.push({
                  pathname: '/special-offer-form',
                  params: { type, id: String(id), name: title },
                } as any)
              }
              activeOpacity={0.85}
            >
              <Text style={styles.stripButtonText}>დამატება</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const hasAny = stores.length > 0 || dismantlers.length > 0 || mechanics.length > 0 || services.length > 0;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
        <LinearGradient colors={['#F8FAFC', '#F1F5F9', '#E2E8F0']} style={StyleSheet.absoluteFillObject} />
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>ბიზნესის სამართავი პანელი</Text>
          <View style={styles.headerBtn} />
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#111827" />
            <Text style={styles.loadingText}>იტვირთება...</Text>
          </View>
        ) : !hasAny ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="business-outline" size={48} color="#9CA3AF" />
            </View>
            <Text style={styles.emptyTitle}>განცხადებები არ არის</Text>
            <Text style={styles.emptySubtitle}>
              მაღაზიების, დაშლილების, ხელოსნების ან სერვისების განცხადებები აქ გამოჩნდება
            </Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => router.back()} activeOpacity={0.7}>
              <Text style={styles.primaryBtnText}>უკან</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#111827" />
            }
            showsVerticalScrollIndicator={false}
          >
            {stores.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionTitleRow}>
                  <View style={[styles.sectionIconWrap, { backgroundColor: SECTION_CONFIG.store.color + '18' }]}>
                    <Ionicons name={SECTION_CONFIG.store.icon as any} size={20} color={SECTION_CONFIG.store.color} />
                  </View>
                  <Text style={styles.sectionTitle}>{SECTION_CONFIG.store.title}</Text>
                </View>
                {stores.map((s) => renderCard('store', s, s.title || s.name || 'მაღაზია', () => handleRenewStore(s)))}
              </View>
            )}
            {dismantlers.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionTitleRow}>
                  <View style={[styles.sectionIconWrap, { backgroundColor: SECTION_CONFIG.dismantler.color + '18' }]}>
                    <Ionicons name={SECTION_CONFIG.dismantler.icon as any} size={20} color={SECTION_CONFIG.dismantler.color} />
                  </View>
                  <Text style={styles.sectionTitle}>{SECTION_CONFIG.dismantler.title}</Text>
                </View>
                {dismantlers.map((d) => renderCard('dismantler', d, d.brand && d.model ? `${d.brand} ${d.model}` : 'დაშლილი', () => handleRenewDismantler(d)))}
              </View>
            )}
            {mechanics.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionTitleRow}>
                  <View style={[styles.sectionIconWrap, { backgroundColor: SECTION_CONFIG.mechanic.color + '18' }]}>
                    <Ionicons name={SECTION_CONFIG.mechanic.icon as any} size={20} color={SECTION_CONFIG.mechanic.color} />
                  </View>
                  <Text style={styles.sectionTitle}>{SECTION_CONFIG.mechanic.title}</Text>
                </View>
                {mechanics.map((m) => renderCard('mechanic', m, m.name || 'ხელოსანი', () => handleRenewMechanic(m)))}
              </View>
            )}
            {services.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionTitleRow}>
                  <View style={[styles.sectionIconWrap, { backgroundColor: SECTION_CONFIG.service.color + '18' }]}>
                    <Ionicons name={SECTION_CONFIG.service.icon as any} size={20} color={SECTION_CONFIG.service.color} />
                  </View>
                  <Text style={styles.sectionTitle}>{SECTION_CONFIG.service.title}</Text>
                </View>
                {services.map((s) => renderCard('service', s, s.name || 'სერვისი', () => handleRenewService(s)))}
              </View>
            )}
            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontFamily: 'HelveticaMedium',
    fontWeight: '800',
    color: '#111827',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 15, color: '#6B7280' },
  emptyWrap: { flex: 1, paddingHorizontal: 24, paddingTop: 48, alignItems: 'center' },
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: { fontSize: 18, fontFamily: 'HelveticaMedium', fontWeight: '700', color: '#111827', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 24 },
  primaryBtn: { backgroundColor: '#111827', paddingVertical: 14, paddingHorizontal: 28, borderRadius: 14 },
  primaryBtnText: { fontSize: 15, fontFamily: 'HelveticaMedium', fontWeight: '600', color: '#FFFFFF' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20 },
  section: { marginBottom: 24 },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  sectionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: 'HelveticaMedium',
    fontWeight: '700',
    color: '#111827',
    textTransform: 'uppercase',
    letterSpacing: -0.3,
  },
  wireframeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  wireframeTop: {
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  wireframeIconBox: {
    width: 80,
    height: 80,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    overflow: 'hidden',
  },
  wireframePhoto: {
    width: 80,
    height: 80,
    borderRadius: 18,
  },
  wireframeTitle: {
    fontSize: 18,
    fontFamily: 'HelveticaMedium',
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  wireframeSubtitle: {
    fontSize: 13,
    fontFamily: 'HelveticaMedium',
    color: '#6B7280',
    textAlign: 'center',
  },
  wireframeStrips: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    paddingBottom: 14,
    gap: 0,
  },
  stripRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    marginBottom: 8,
  },
  stripLabel: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    color: '#6B7280',
    fontWeight: '600',
  },
  stripValue: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    fontWeight: '600',
    color: '#111827',
  },
  stripValueRight: { flexShrink: 1, maxWidth: '60%', textAlign: 'right' },
  stripValueDanger: { color: '#EF4444' },
  stripButton: {
    minWidth: 56,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stripButtonText: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
