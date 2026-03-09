import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Image,
  Dimensions,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { specialOffersApi, type SpecialOffer } from '@/services/specialOffersApi';

const { width } = Dimensions.get('window');
const PREVIEW_CARD_WIDTH = width * 0.5;
const PREVIEW_IMAGE_HEIGHT = 90;

const TYPE_CONFIG: Record<string, { title: string; icon: string; color: string }> = {
  store: { title: 'მაღაზია', icon: 'storefront', color: '#F59E0B' },
  dismantler: { title: 'დაშლილი', icon: 'car-sport', color: '#6366F1' },
  mechanic: { title: 'ხელოსანი', icon: 'construct', color: '#10B981' },
  service: { title: 'სერვისი', icon: 'settings', color: '#3B82F6' },
};

// პრევიუ-ქარდი: ასე გამოჩნდება კატეგორიის გვერდებზე
function PreviewCard({
  title,
  image,
  discount,
  oldPrice,
  newPrice,
  location,
}: {
  title: string;
  image: string;
  discount: string;
  oldPrice: string;
  newPrice: string;
  location: string;
}) {
  const hasAny = title || discount || oldPrice || newPrice;
  return (
    <View style={previewStyles.card}>
      <View style={previewStyles.imageWrap}>
        <Image
          source={{ uri: image || 'https://images.unsplash.com/photo-1517672651691-24622a91b550?q=80&w=400' }}
          style={previewStyles.image}
          resizeMode="cover"
        />
        {discount ? (
          <View style={previewStyles.discountBadge}>
            <Text style={previewStyles.discountBadgeText}>-{discount}%</Text>
          </View>
        ) : null}
      </View>
      <View style={previewStyles.body}>
        <Text style={previewStyles.title} numberOfLines={2}>
          {title || 'შეთავაზების სათაური'}
        </Text>
        {location ? (
          <Text style={previewStyles.location} numberOfLines={1}>{location}</Text>
        ) : null}
        <View style={previewStyles.priceRow}>
          {oldPrice ? <Text style={previewStyles.oldPrice}>{oldPrice} ₾</Text> : null}
          <Text style={previewStyles.newPrice}>{newPrice ? `${newPrice} ₾` : '—'}</Text>
        </View>
      </View>
    </View>
  );
}

const previewStyles = StyleSheet.create({
  card: {
    width: PREVIEW_CARD_WIDTH,
    backgroundColor: '#FFF',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  imageWrap: { height: PREVIEW_IMAGE_HEIGHT, backgroundColor: '#F3F4F6', position: 'relative' },
  image: { width: '100%', height: '100%' },
  discountBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  discountBadgeText: { fontSize: 11, fontFamily: 'HelveticaMedium', fontWeight: '700', color: '#FFF' },
  body: { padding: 10, gap: 4 },
  title: { fontSize: 12, fontFamily: 'HelveticaMedium', fontWeight: '700', color: '#111827' },
  location: { fontSize: 10, fontFamily: 'HelveticaMedium', color: '#6B7280' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  oldPrice: { fontSize: 11, fontFamily: 'HelveticaMedium', color: '#9CA3AF', textDecorationLine: 'line-through' },
  newPrice: { fontSize: 13, fontFamily: 'HelveticaMedium', fontWeight: '700', color: '#111827' },
});

export default function SpecialOfferFormScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string; id?: string; name?: string }>();
  const type = (params.type || 'store') as keyof typeof TYPE_CONFIG;
  const entityId = params.id || '';
  const entityName = params.name || TYPE_CONFIG[type]?.title || 'განცხადება';

  const config = TYPE_CONFIG[type] || TYPE_CONFIG.store;

  const [offers, setOffers] = useState<SpecialOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingOffer, setEditingOffer] = useState<SpecialOffer | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    discount: '',
    oldPrice: '',
    newPrice: '',
    image: '',
  });

  const loadOffers = useCallback(async () => {
    if (type !== 'store' || !entityId) return;
    try {
      const data = await specialOffersApi.getSpecialOffersByStore(entityId, false);
      setOffers(Array.isArray(data) ? data : []);
    } catch (e) {
      setOffers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [type, entityId]);

  useEffect(() => {
    loadOffers();
  }, [loadOffers]);

  const onRefresh = () => {
    setRefreshing(true);
    loadOffers();
  };

  const openAdd = () => {
    setEditingOffer(null);
    setForm({ title: '', description: '', discount: '', oldPrice: '', newPrice: '', image: '' });
    setShowModal(true);
  };

  const openEdit = (offer: SpecialOffer) => {
    setEditingOffer(offer);
    setForm({
      title: offer.title || '',
      description: offer.description || '',
      discount: offer.discount || '',
      oldPrice: offer.oldPrice || '',
      newPrice: offer.newPrice || '',
      image: offer.image || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (type !== 'store' || !entityId) return;
    if (!form.discount.trim() || !form.oldPrice.trim() || !form.newPrice.trim()) {
      Alert.alert('შეცდომა', 'შეავსეთ ფასდაკლება, ძველი და ახალი ფასი');
      return;
    }
    setSubmitting(true);
    try {
      if (editingOffer) {
        const updated = await specialOffersApi.updateSpecialOffer(editingOffer.id, {
          title: form.title || undefined,
          description: form.description || undefined,
          discount: form.discount,
          oldPrice: form.oldPrice,
          newPrice: form.newPrice,
          image: form.image || undefined,
        });
        if (updated) {
          setOffers((prev) => prev.map((o) => (o.id === editingOffer.id ? updated : o)));
          Alert.alert('წარმატება', 'შეთავაზება განახლდა');
          setShowModal(false);
        }
      } else {
        const created = await specialOffersApi.createSpecialOffer({
          storeId: entityId,
          discount: form.discount,
          oldPrice: form.oldPrice,
          newPrice: form.newPrice,
          title: form.title || undefined,
          description: form.description || undefined,
          image: form.image || undefined,
          isActive: true,
        });
        if (created) {
          setOffers((prev) => [created, ...prev]);
          Alert.alert('წარმატება', 'შეთავაზება დაემატა');
          setShowModal(false);
        }
      }
    } catch (e) {
      Alert.alert('შეცდომა', 'შენახვა ვერ მოხერხდა');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (offer: SpecialOffer) => {
    try {
      const updated = await specialOffersApi.toggleActive(offer.id);
      if (updated) setOffers((prev) => prev.map((o) => (o.id === offer.id ? updated : o)));
    } catch (e) {
      Alert.alert('შეცდომა', 'განახლება ვერ მოხერხდა');
    }
  };

  const handleDelete = (offer: SpecialOffer) => {
    Alert.alert('შეთავაზების წაშლა', 'დარწმუნებული ხართ?', [
      { text: 'გაუქმება', style: 'cancel' },
      {
        text: 'წაშლა',
        style: 'destructive',
        onPress: async () => {
          const ok = await specialOffersApi.deleteSpecialOffer(offer.id);
          if (ok) setOffers((prev) => prev.filter((o) => o.id !== offer.id));
        },
      },
    ]);
  };

  if (type !== 'store') {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.safe} edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()} activeOpacity={0.7}>
              <Ionicons name="arrow-back" size={22} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>სპეციალური შეთავაზებები</Text>
            <View style={styles.headerBtn} />
          </View>
          <View style={styles.comingSoonWrap}>
            <View style={[styles.comingSoonIcon, { backgroundColor: config.color + '22' }]}>
              <Ionicons name={config.icon as any} size={48} color={config.color} />
            </View>
            <Text style={styles.comingSoonTitle}>{entityName}</Text>
            <Text style={styles.comingSoonText}>
              სპეციალური შეთავაზებები {config.title.toLowerCase()}სთვის მალე დაემატება.
            </Text>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
              <Text style={styles.backBtnText}>უკან</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            შეთავაზებები — {entityName}
          </Text>
          <View style={styles.headerBtn} />
        </View>

        {loading ? (
          <View style={styles.loadWrap}>
            <ActivityIndicator size="large" color="#111827" />
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#111827" />}
            showsVerticalScrollIndicator={false}
          >
            {/* ზემოთ: რას აკეთებთ + მაგალითი ქარდი */}
            <View style={styles.infoBlock}>
              <View style={styles.infoRow}>
                <Ionicons name="information-circle" size={22} color="#3B82F6" />
                <Text style={styles.infoTitle}>რას აკეთებთ?</Text>
              </View>
              <Text style={styles.infoText}>
                აქ დამატებული შეთავაზება კატეგორიის გვერდებზე (მაღაზიები, ნაწილები, ხელოსნები) ასეთი ქარდით გამოჩნდება. მომხმარებელი დააჭერს „ნახვა“ და დაინახავს დეტალებს.
              </Text>
              <View style={styles.previewBlock}>
                <Text style={styles.previewLabel}>მაგალითი — ასე დაინახავენ</Text>
                <View style={styles.previewCardWrap}>
                  <PreviewCard
                    title="ზამთრის ფასდაკლება"
                    image="https://images.unsplash.com/photo-1517672651691-24622a91b550?q=80&w=400"
                    discount="20"
                    oldPrice="100"
                    newPrice="80"
                    location={entityName}
                  />
                </View>
              </View>
            </View>

            <TouchableOpacity style={[styles.addStrip, { borderColor: config.color }]} onPress={openAdd} activeOpacity={0.8}>
              <Ionicons name="add-circle" size={22} color={config.color} />
              <Text style={[styles.addStripText, { color: config.color }]}>ახალი შეთავაზება</Text>
            </TouchableOpacity>

            {offers.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>ჯერ არც ერთი შეთავაზება არ არის</Text>
                <Text style={styles.emptySub}>დააჭირეთ ღილაკს ზემოთ რომ დაამატოთ</Text>
              </View>
            ) : (
              <>
                <Text style={styles.sectionLabel}>თქვენი შეთავაზებები</Text>
                {offers.map((offer) => (
                  <View key={offer.id} style={styles.card}>
                    <View style={styles.cardRow}>
                      <Text style={styles.cardTitle} numberOfLines={1}>{offer.title || 'შეთავაზება'}</Text>
                      <View style={styles.cardBadge}>
                        <Text style={styles.cardBadgeText}>{offer.discount}%</Text>
                      </View>
                    </View>
                    {(offer.oldPrice || offer.newPrice) && (
                      <View style={styles.cardRow}>
                        <Text style={styles.cardOldPrice}>{offer.oldPrice} ₾</Text>
                        <Text style={styles.cardNewPrice}>{offer.newPrice} ₾</Text>
                      </View>
                    )}
                    <View style={styles.cardActions}>
                      <TouchableOpacity style={styles.cardBtn} onPress={() => openEdit(offer)}>
                        <Ionicons name="create-outline" size={18} color="#111827" />
                        <Text style={styles.cardBtnText}>რედაქტირება</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.cardBtn} onPress={() => handleToggle(offer)}>
                        <Ionicons name={offer.isActive ? 'eye-off-outline' : 'eye-outline'} size={18} color="#111827" />
                        <Text style={styles.cardBtnText}>{offer.isActive ? 'დამალვა' : 'გამოჩენა'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.cardBtn} onPress={() => handleDelete(offer)}>
                        <Ionicons name="trash-outline" size={18} color="#EF4444" />
                        <Text style={[styles.cardBtnText, { color: '#EF4444' }]}>წაშლა</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </>
            )}
            <View style={{ height: 40 }} />
          </ScrollView>
        )}

        <Modal visible={showModal} animationType="slide" transparent>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editingOffer ? 'რედაქტირება' : 'ახალი შეთავაზება'}</Text>
                <TouchableOpacity onPress={() => setShowModal(false)} style={styles.modalClose}>
                  <Ionicons name="close" size={24} color="#111827" />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {/* ცოცხალი პრევიუ */}
                <View style={styles.modalPreviewSection}>
                  <Text style={styles.previewLabel}>ასე გამოჩნდება</Text>
                  <View style={styles.previewCardWrap}>
                    <PreviewCard
                      title={form.title || 'შეთავაზების სათაური'}
                      image={form.image}
                      discount={form.discount}
                      oldPrice={form.oldPrice}
                      newPrice={form.newPrice}
                      location={entityName}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>სათაური</Text>
                  <TextInput
                    style={styles.input}
                    value={form.title}
                    onChangeText={(t) => setForm((f) => ({ ...f, title: t }))}
                    placeholder="მაგ: ზამთრის ფასდაკლება"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>ძველი ფასი (₾) *</Text>
                  <TextInput
                    style={styles.input}
                    value={form.oldPrice}
                    onChangeText={(t) => setForm((f) => ({ ...f, oldPrice: t }))}
                    placeholder="100"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>ახალი ფასი (₾) *</Text>
                  <TextInput
                    style={styles.input}
                    value={form.newPrice}
                    onChangeText={(t) => setForm((f) => ({ ...f, newPrice: t }))}
                    placeholder="80"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>ფასდაკლება (%) *</Text>
                  <TextInput
                    style={styles.input}
                    value={form.discount}
                    onChangeText={(t) => setForm((f) => ({ ...f, discount: t }))}
                    placeholder="20"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>აღწერა (არასავალდებულო)</Text>
                  <TextInput
                    style={[styles.input, styles.inputArea]}
                    value={form.description}
                    onChangeText={(t) => setForm((f) => ({ ...f, description: t }))}
                    placeholder="დამატებითი ინფო მომხმარებლისთვის"
                    placeholderTextColor="#9CA3AF"
                    multiline
                  />
                </View>
              </ScrollView>
              <TouchableOpacity
                style={[styles.saveBtn, submitting && styles.saveBtnDisabled]}
                onPress={handleSave}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.saveBtnText}>შენახვა</Text>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFF',
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
    fontWeight: '700',
    color: '#111827',
    textTransform: 'uppercase',
    flex: 1,
    textAlign: 'center',
  },
  loadWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 24 },

  infoBlock: {
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  infoTitle: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    fontWeight: '700',
    color: '#1E40AF',
    textTransform: 'uppercase',
  },
  infoText: {
    fontSize: 13,
    fontFamily: 'HelveticaMedium',
    color: '#1E3A8A',
    lineHeight: 20,
    marginBottom: 14,
  },
  previewBlock: { marginTop: 4 },
  previewLabel: {
    fontSize: 11,
    fontFamily: 'HelveticaMedium',
    color: '#6B7280',
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  previewCardWrap: { alignItems: 'flex-start' },

  addStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    marginBottom: 16,
  },
  addStripText: { fontSize: 14, fontFamily: 'HelveticaMedium', fontWeight: '700', textTransform: 'uppercase' },
  sectionLabel: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    color: '#6B7280',
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  empty: { paddingVertical: 28, alignItems: 'center' },
  emptyText: { fontSize: 15, fontFamily: 'HelveticaMedium', color: '#6B7280', marginBottom: 6 },
  emptySub: { fontSize: 13, color: '#9CA3AF' },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  cardTitle: {
    fontSize: 15,
    fontFamily: 'HelveticaMedium',
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    textTransform: 'uppercase',
  },
  cardBadge: { backgroundColor: '#EF4444', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  cardBadgeText: { fontSize: 12, fontFamily: 'HelveticaMedium', fontWeight: '700', color: '#FFF' },
  cardOldPrice: {
    fontSize: 13,
    fontFamily: 'HelveticaMedium',
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },
  cardNewPrice: { fontSize: 15, fontFamily: 'HelveticaMedium', fontWeight: '700', color: '#111827' },
  cardActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  cardBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardBtnText: {
    fontSize: 13,
    fontFamily: 'HelveticaMedium',
    fontWeight: '600',
    color: '#111827',
    textTransform: 'uppercase',
  },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 16,
    fontFamily: 'HelveticaMedium',
    fontWeight: '700',
    color: '#111827',
    textTransform: 'uppercase',
  },
  modalClose: { padding: 8 },
  modalScroll: { maxHeight: 420, paddingHorizontal: 20, paddingTop: 16 },
  modalPreviewSection: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  inputGroup: { marginBottom: 14 },
  inputLabel: {
    fontSize: 11,
    fontFamily: 'HelveticaMedium',
    color: '#6B7280',
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
  },
  inputArea: { minHeight: 72, textAlignVertical: 'top' },
  saveBtn: {
    marginHorizontal: 20,
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    fontWeight: '700',
    color: '#FFF',
    textTransform: 'uppercase',
  },

  comingSoonWrap: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center' },
  comingSoonIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  comingSoonTitle: {
    fontSize: 18,
    fontFamily: 'HelveticaMedium',
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  comingSoonText: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 24 },
  backBtn: { paddingVertical: 14, paddingHorizontal: 28, borderRadius: 14, backgroundColor: '#111827' },
  backBtnText: {
    fontSize: 15,
    fontFamily: 'HelveticaMedium',
    fontWeight: '600',
    color: '#FFF',
    textTransform: 'uppercase',
  },
});
