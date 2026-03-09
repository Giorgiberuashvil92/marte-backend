import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, StatusBar, TextInput, ActivityIndicator, Dimensions, Modal, Switch, KeyboardAvoidingView, Platform, ScrollView, ImageBackground, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { mechanicsApi, MechanicDTO } from '@/services/mechanicsApi';
import photoService from '@/services/photoService';
import { useUser } from '../contexts/UserContext';
import { addItemApi } from '../services/addItemApi';
import { LinearGradient } from 'expo-linear-gradient';
import AddModal, { AddModalType } from '../components/ui/AddModal';
import { DetailItem } from '../components/ui/DetailModal';

const { width } = Dimensions.get('window');
const GAP = 16;
const CARD_WIDTH = (width - GAP * 3) / 2; // 2-cols grid with 16px paddings

type SortKey = 'recommended' | 'rating' | 'price' | 'name';
const SPECIALTIES: string[] = [
  'ზოგადი სერვისი',
  'კომპიუტერული დიაგნოსტიკა',
  'ძრავი (ტაიმინგი/ზეთის სისტემა)',
  'გადაცემათა კოლოფი (ავტომატი)',
  'გადაცემათა კოლოფი (მექანიკა)',
  'სავალი ნაწილი / ამორტიზატორი',
  'მუხრუჭები',
  'გაგრილების სისტემა (რადიატორი/ტუმბო)',
  'საწვავის სისტემა (ინჟექტორი/ტუმბო)',
  'ავტოელექტრიკა / ელექტრონიკა',
  'სტარტერი / გენერატორი',
  'კონდიციონერი / კლიმატი',
  'გამონაბოლქვი / გამომშვები სისტემა',
  'საბურავები / დაბალანსება / ვულკანიზაცია',
  'კუზავი / ფერწერა / შედუღება',
  'დეტეილინგი / ანტიკოროზია',
];

export default function MechanicsScreen() {
  const router = useRouter();
  const { user } = useUser();
  const [mechanics, setMechanics] = useState<MechanicDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('recommended');
  const [specialty, setSpecialty] = useState<string>('');
  const [userMechanics, setUserMechanics] = useState<any[]>([]);
  const [hasUserMechanics, setHasUserMechanics] = useState(false);
  const [vipMechanics, setVipMechanics] = useState<MechanicDTO[]>([]);
  const [regularMechanics, setRegularMechanics] = useState<MechanicDTO[]>([]);

  // Add mechanic modal state
  const [showAddModal, setShowAddModal] = useState(false);
  // Filter modal state
  const [showFilter, setShowFilter] = useState(false);
  const [filterSpec, setFilterSpec] = useState<string>('');
  const [filterLocation, setFilterLocation] = useState<string>('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params: { q?: string; specialty?: string } = {};
      if (debounced.trim()) params.q = debounced.trim();
      if (specialty) params.specialty = specialty;
      const data = await mechanicsApi.getMechanics(params);
      
      // Separate VIP and regular mechanics
      const vip = data.filter((m: MechanicDTO) => m.isFeatured);
      const regular = data.filter((m: MechanicDTO) => !m.isFeatured);
      
      setVipMechanics(vip);
      setRegularMechanics(regular);
      setMechanics(data);
    } catch (e) {
      console.error(e);
      setError('მონაცემების ჩატვირთვა ვერ მოხერხდა');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [debounced, specialty]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Load user's mechanics (for management)
  const loadUserMechanics = useCallback(async () => {
    if (!user?.id) {
      setHasUserMechanics(false);
      return;
    }
    
    try {
      // Normalize ownerId - remove 'usr_' prefix if present, or try both formats
      const normalizedOwnerId = user.id.startsWith('usr_') ? user.id.replace('usr_', '') : user.id;
      
      // Try both formats: with and without 'usr_' prefix
      const response1 = await addItemApi.getMechanics({ ownerId: user.id });
      const response2 = await addItemApi.getMechanics({ ownerId: normalizedOwnerId });
      
      // Combine results from both queries
      const allMechanics = [
        ...(response1.success && response1.data ? response1.data : []),
        ...(response2.success && response2.data ? response2.data : []),
      ];
      
      // Remove duplicates based on id
      const uniqueMechanics = allMechanics.filter((mechanic, index, self) =>
        index === self.findIndex((m) => (m.id || m._id) === (mechanic.id || mechanic._id))
      );
      
      setUserMechanics(uniqueMechanics);
      setHasUserMechanics(uniqueMechanics.length > 0);
    } catch (error) {
      console.error('Error loading user mechanics:', error);
      setHasUserMechanics(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadUserMechanics();
  }, [loadUserMechanics]);

  const sorted = useMemo(() => {
    const list = [...regularMechanics];
    if (sortBy === 'rating') {
      list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    } else if (sortBy === 'price') {
      list.sort((a, b) => (a.priceGEL ?? Infinity) - (b.priceGEL ?? Infinity));
    } else if (sortBy === 'name') {
      list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }
    return list;
  }, [regularMechanics, sortBy]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // Convert mechanic to DetailItem
  const convertMechanicToDetailItem = (mechanic: MechanicDTO): DetailItem => {
    const mainImage = mechanic.avatar || 'https://images.unsplash.com/photo-1581094271901-8022df4466b9?q=80&w=600&auto=format&fit=crop';
    return {
      id: mechanic.id,
      title: mechanic.name,
      name: mechanic.name,
      description: mechanic.description || `${mechanic.name} - პროფესიონალი ${mechanic.specialty}`,
      image: mainImage,
      type: 'mechanic',
      location: mechanic.location,
      phone: mechanic.phone,
      address: mechanic.address,
      gallery: mechanic.avatar ? [mechanic.avatar] : [mainImage],
      services: mechanic.services,
      specifications: {
        'სპეციალობა': mechanic.specialty || '',
        'გამოცდილება': mechanic.experience || '',
        'მდებარეობა': mechanic.location || '',
        'ტელეფონი': mechanic.phone || '',
        'რეიტინგი': mechanic.rating ? `${mechanic.rating.toFixed(1)} ⭐` : '',
        'რევიუები': mechanic.reviews ? `${mechanic.reviews} რევიუ` : '',
      }
    };
  };

  const renderVIPMechanic = ({ item }: { item: MechanicDTO }) => {
    const img = item.avatar || 'https://images.unsplash.com/photo-1581094271901-8022df4466b9?q=80&w=600&auto=format&fit=crop';
    return (
      <TouchableOpacity
        style={styles.vipMechanicCard}
        onPress={() => {
          const detailItem = convertMechanicToDetailItem(item);
          router.push({
            pathname: '/parts-details-new',
            params: { item: JSON.stringify(detailItem) }
          });
        }}
        activeOpacity={0.7}
      >
        <ImageBackground
          source={{ uri: img }}
          style={styles.vipMechanicCardImage}
          imageStyle={styles.vipMechanicCardImageStyle}
        >
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.8)']}
            style={styles.vipMechanicCardGradient}
          >
            <View style={styles.vipMechanicBadge}>
              <Ionicons name="star" size={12} color="#F59E0B" />
              <Text style={styles.vipMechanicBadgeText}>VIP</Text>
            </View>
            <View style={styles.vipMechanicCardContent}>
              <Text style={styles.vipMechanicCardTitle} numberOfLines={2}>{item.name}</Text>
              <View style={styles.vipMechanicCardMeta}>
                <Ionicons name="location" size={14} color="#FFFFFF" />
                <Text style={styles.vipMechanicCardLocation}>{item.location || 'თბილისი'}</Text>
              </View>
              {item.specialty && (
                <View style={styles.vipMechanicCardMeta}>
                  <Ionicons name="construct" size={14} color="#FFFFFF" />
                  <Text style={styles.vipMechanicCardLocation}>{item.specialty}</Text>
                </View>
              )}
            </View>
          </LinearGradient>
        </ImageBackground>
      </TouchableOpacity>
    );
  };

  const renderCard = ({ item }: { item: MechanicDTO }) => {
    const img = item.avatar || 'https://images.unsplash.com/photo-1581094271901-8022df4466b9?q=80&w=600&auto=format&fit=crop';
    return (
      <TouchableOpacity 
        style={styles.modernMechanicCard} 
        activeOpacity={0.9} 
        onPress={() => {
          const detailItem = convertMechanicToDetailItem(item);
          router.push({
            pathname: '/parts-details-new',
            params: { item: JSON.stringify(detailItem) }
          });
        }}
      >
        <ImageBackground 
          source={{ uri: img }}
          style={styles.modernMechanicBackgroundImage}
          resizeMode="cover"
        >
          <LinearGradient
            colors={['rgba(0,0,0,0.4)', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.5)']}
            style={styles.modernMechanicGradientOverlay}
          >
            <View style={styles.modernMechanicHeader}>
              <View style={styles.modernMechanicProfileSection}>
                <View style={styles.modernMechanicAvatarPlaceholder}>
                  {item.avatar ? (
                    <Image source={{ uri: item.avatar }} style={styles.modernMechanicAvatar} />
                  ) : (
                    <View style={styles.modernMechanicAvatarPlaceholderInner}>
                      <Ionicons name="construct" size={14} color="#FFFFFF" />
                    </View>
                  )}
                </View>
                <Text style={styles.modernMechanicUsername} numberOfLines={1}>
                  {item.name}
                </Text>
              </View>
              {item.isFeatured && (
                <View style={styles.modernMechanicVipBadge}>
                  <Ionicons name="star" size={10} color="#F59E0B" />
                  <Text style={styles.modernMechanicVipText}>VIP</Text>
                </View>
              )}
            </View>

            <View style={styles.modernMechanicMainCard}>
              <View style={styles.modernMechanicInfoSection}>
                <View style={styles.modernMechanicCategoryButton}>
                  <Text style={styles.modernMechanicCategoryText} numberOfLines={1}>
                    {item.specialty || 'სპეციალობა'}
                  </Text>
                </View>
                {item.priceGEL && (
                  <View style={styles.modernMechanicPriceButton}>
                    <Text style={styles.modernMechanicPriceText}>
                      {item.priceGEL}₾/სთ
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.modernMechanicSeparator} />

              <View style={styles.modernMechanicTypeSection}>
                <View style={styles.modernMechanicTypeLeft}>
                  <View style={styles.modernMechanicLocationRow}>
                    <Ionicons name="location-outline" size={10} color="rgba(255,255,255,0.8)" />
                    <Text style={styles.modernMechanicLocationText} numberOfLines={1}>
                      {item.location || 'თბილისი'}
                    </Text>
                  </View>
                </View>
                {item.phone && (
                  <TouchableOpacity 
                    style={styles.modernMechanicCallButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      Linking.openURL(`tel:${item.phone}`);
                    }}
                  >
                    <Ionicons name="call-outline" size={12} color="#FFFFFF" />
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.modernMechanicActionsFooter}>
                <View style={styles.modernMechanicActionsLeft}>
                  {typeof item.rating === 'number' && (
                    <View style={styles.modernMechanicRatingButton}>
                      <Ionicons name="star" size={10} color="#FDE68A" />
                      <Text style={styles.modernMechanicRatingText}>
                        {item.rating.toFixed(1)}
                      </Text>
                    </View>
                  )}
                  <View style={[
                    styles.modernMechanicStatusBadge, 
                    item.isAvailable ? styles.modernMechanicStatusBadgeOpen : styles.modernMechanicStatusBadgeClosed
                  ]}>
                    <View style={[
                      styles.modernMechanicStatusDot, 
                      item.isAvailable ? styles.modernMechanicStatusDotOpen : styles.modernMechanicStatusDotClosed
                    ]} />
                    <Text style={styles.modernMechanicStatusText}>
                      {item.isAvailable ? 'ხელმისაწვდომი' : 'დაკავებული'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </LinearGradient>
        </ImageBackground>
      </TouchableOpacity>
    );
  };

  const header = (
    <View>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#111827" />
            </TouchableOpacity>
        <Text style={styles.title}>ხელოსნები</Text>
        <TouchableOpacity style={styles.headerAddBtn} onPress={() => setShowAddModal(true)}>
          <Ionicons name="add" size={16} color="#111827" />
          <Text style={styles.headerAddBtnText}>ხელოსნად დამატება</Text>
            </TouchableOpacity>
          </View>
      
      {/* განცხადებების მართვა ღილაკი */}
      {hasUserMechanics && (
        <View style={styles.manageSection}>
          <TouchableOpacity
            style={styles.manageButton}
            onPress={() => router.push('/mechanic-management')}
          >
            <LinearGradient
              colors={['#1E40AF', '#3B82F6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.manageButtonGradient}
            >
              <View style={styles.manageButtonIconContainer}>
                <Ionicons name="settings" size={20} color="#FFFFFF" />
              </View>
              <View style={styles.manageButtonTextContainer}>
                <Text style={styles.manageButtonTitle}>განცხადებების მართვა</Text>
                <Text style={styles.manageButtonSubtitle}>{userMechanics.length} ცალი</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#FFFFFF" style={styles.manageButtonArrow} />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}
      
      <View style={styles.searchWrap}>
              <Ionicons name="search" size={18} color="#9CA3AF" />
              <TextInput
          style={styles.input}
          placeholder="ძიება სახელით ან სპეციალობით"
                placeholderTextColor="#6B7280"
          value={search}
          onChangeText={setSearch}
              />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
                  <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                </TouchableOpacity>
        ) : null}
          </View>
      <View style={styles.controlsRow}>
        <View style={{ flex: 1 }}>
          <FlatList
            data={["ყველა", ...SPECIALTIES]}
            keyExtractor={(i) => i}
          horizontal
          showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingRight: 8, gap: 8 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.pill,
                  (item === 'ყველა' ? !specialty : specialty === item) && styles.pillActive,
                ]}
                onPress={() => setSpecialty(item === 'ყველა' ? '' : item)}
              >
                <Text style={[styles.pillText, (item === 'ყველა' ? !specialty : specialty === item) && styles.pillTextActive]}>
                  {item}
                  </Text>
              </TouchableOpacity>
            )}
          />
        </View>
        <View style={styles.actionsCol}>
            <TouchableOpacity 
            style={[styles.pillSm, styles.pillAccent]}
            onPress={() => {
              setFilterSpec(specialty);
              setFilterLocation('');
              setShowFilter(true);
            }}
          >
            <Ionicons name="options" size={14} color="#111827" />
            <Text style={[styles.pillText, styles.pillTextActive]}>ფილტრი</Text>
            </TouchableOpacity>
        </View>
      </View>
      
      {/* VIP Section */}
      {vipMechanics.length > 0 && (
        <View style={styles.vipSection}>
          <View style={styles.sectionHeader}>
            <Ionicons name="star" size={20} color="#F59E0B" />
            <Text style={styles.sectionTitle}>VIP ხელოსნები</Text>
          </View>
          <FlatList
            horizontal
            data={vipMechanics}
            renderItem={renderVIPMechanic}
            keyExtractor={(item, index) => item.id || index.toString()}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.vipList}
          />
        </View>
      )}
          </View>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={{ flex: 1 }}>
        {error ? (
          <View style={styles.center}>
            <Text style={styles.error}>{error}</Text>
            <TouchableOpacity style={styles.retry} onPress={fetchData}>
              <Text style={styles.retryText}>თავიდან ცდა</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={sorted}
            keyExtractor={(it) => it.id}
            numColumns={1}
            contentContainerStyle={{ paddingTop: 12, paddingBottom: 32, paddingHorizontal: GAP, gap: 12 }}
            ListHeaderComponent={header}
            renderItem={renderCard}
            ListEmptyComponent={loading ? (
              <View style={styles.center}><ActivityIndicator color="#6366F1" size="large" /></View>
            ) : (
              <View style={styles.center}><Text style={styles.error}>ხელოსნები ვერ მოიძებნა</Text></View>
            )}
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        )}
      </SafeAreaView>

      {/* Floating Add Button */}
      <TouchableOpacity style={styles.fab} activeOpacity={0.9} onPress={() => setShowAddModal(true)}>
        <Ionicons name="add" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Add Mechanic Modal */}
      <AddModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={(type, data) => {
          console.log('Mechanic saved:', type, data);
          setShowAddModal(false);
          fetchData();
          loadUserMechanics();
        }}
        defaultType="mechanic"
      />

      {/* Filter Modal */}
      <Modal visible={showFilter} animationType="slide" transparent onRequestClose={() => setShowFilter(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>ფილტრი</Text>
              <TouchableOpacity onPress={() => setShowFilter(false)}>
                <Ionicons name="close" size={22} color="#111827" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={[{ key: 'content' }]}
              keyExtractor={(i) => String(i.key)}
              renderItem={() => (
                <View style={styles.formGrid}>
                  <View style={styles.field}>
                    <Text style={styles.label}>სპეციალობა</Text>
                    <View style={styles.dropdown}>
                      {SPECIALTIES.map((opt) => (
                        <TouchableOpacity key={opt} style={styles.dropdownItem} onPress={() => setFilterSpec(opt)}>
                          <Text style={[styles.dropdownText, filterSpec === opt && styles.dropdownTextActive]}>{opt}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.label}>მდებარეობა (არასავალდებულო)</Text>
                    <TextInput
                      value={filterLocation}
                      onChangeText={setFilterLocation}
                      placeholder="მაგ: თბილისი"
                      placeholderTextColor="#6B7280"
                      style={styles.inputDark}
                    />
                  </View>
                </View>
              )}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.btnSecondary}
                onPress={() => { setFilterSpec(''); setFilterLocation(''); setSpecialty(''); setShowFilter(false); }}
              >
                <Text style={styles.btnSecondaryText}>გასუფთავება</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnPrimary}
                onPress={() => {
                  setSpecialty(filterSpec);
                  // Note: filterLocation can be wired to backend if needed
                  setShowFilter(false);
                  fetchData();
                }}
              >
                <Text style={styles.btnPrimaryText}>გამოყენება</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: GAP, paddingTop: 8 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  title: { color: '#111827', fontSize: 22, fontWeight: '800' },
  searchWrap: { marginTop: 12, marginHorizontal: GAP, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  input: { flex: 1, color: '#111827', fontSize: 14, fontWeight: '500' },
  controlsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: GAP, paddingVertical: 12 },
  pill: { borderRadius: 18, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#F9FAFB' },
  pillActive: { borderColor: '#C7D2FE', backgroundColor: '#EEF2FF' },
  pillAccent: { borderColor: '#C7D2FE', backgroundColor: '#EEF2FF' },
  pillText: { color: '#6B7280', fontWeight: '600', fontSize: 12 },
  pillTextActive: { color: '#111827' },
  pillSm: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB', paddingHorizontal: 10, paddingVertical: 8 },
  actionsCol: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  card: { width: CARD_WIDTH, backgroundColor: '#FFFFFF', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  cardImageWrap: { width: '100%', height: 120, position: 'relative' },
  cardImage: { width: '100%', height: '100%' },
  badgeRow: { position: 'absolute', top: 8, left: 8, right: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap' },
  vipBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#F59E0B', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  vipBadgeText: { color: '#F59E0B', fontSize: 11, fontWeight: '700' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  badgeGreen: { backgroundColor: 'rgba(16,185,129,0.9)' },
  badgeRed: { backgroundColor: 'rgba(239,68,68,0.9)' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 6, paddingVertical: 4, borderRadius: 10 },
  ratingText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  ratingLight: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  ratingLightText: { color: '#111827', fontSize: 12, fontWeight: '800' },
  cardBody: { padding: 12, gap: 6 },
  name: { color: '#111827', fontSize: 14, fontWeight: '800' },
  sub: { color: '#6B7280', fontSize: 12, fontWeight: '600' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: CARD_WIDTH - 70 },
  meta: { color: '#6B7280', fontSize: 11, fontWeight: '600' },
  pricePill: { paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#EEF2FF', borderRadius: 10, borderWidth: 1, borderColor: '#C7D2FE' },
  pricePillText: { color: '#4338CA', fontSize: 11, fontWeight: '800' },
  tagsRow: { flexDirection: 'row', gap: 6, marginTop: 2 },
  tag: { paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#F3F4F6', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  tagText: { color: '#6B7280', fontSize: 10, fontWeight: '600', maxWidth: CARD_WIDTH / 2 - 16 },
  price: { color: '#4F46E5', fontSize: 11, fontWeight: '800' },
  center: { paddingTop: 40, alignItems: 'center' },
  error: { color: '#DC2626', fontSize: 14, marginBottom: 12 },
  retry: { backgroundColor: '#EEF2FF', borderWidth: 1, borderColor: '#C7D2FE', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  retryText: { color: '#111827', fontWeight: '700' },
  headerAddBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, backgroundColor: '#EEF2FF', borderWidth: 1, borderColor: '#C7D2FE' },
  headerAddBtnText: { color: '#111827', fontSize: 12, fontWeight: '700' },
  fab: { position: 'absolute', right: 16, bottom: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: '#6366F1', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, borderWidth: 1, borderColor: 'rgba(99,102,241,0.5)' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(17,24,39,0.35)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, borderColor: '#E5E7EB' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  modalTitle: { color: '#111827', fontSize: 18, fontWeight: '800' },
  formGrid: { paddingHorizontal: 16, paddingTop: 8, gap: 12 },
  field: { gap: 6 },
  fieldRow: { flexDirection: 'row', gap: 12 },
  label: { color: '#374151', fontSize: 12, fontWeight: '600' },
  inputDark: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, color: '#111827' },
  modalActions: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 16, paddingBottom: 24 },
  btnSecondary: { flex: 1, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', paddingVertical: 12, backgroundColor: '#F9FAFB' },
  btnSecondaryText: { color: '#374151', fontWeight: '700' },
  btnPrimary: { flex: 1, borderRadius: 12, backgroundColor: '#6366F1', alignItems: 'center', paddingVertical: 12, borderWidth: 1, borderColor: '#4F46E5' },
  btnPrimaryText: { color: '#FFFFFF', fontWeight: '800' },
  dropdown: { marginTop: 8, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  dropdownAbsolute: { position: 'absolute', top: 76, left: 0, right: 0, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', zIndex: 50, elevation: 10, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  dropdownItem: { paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  dropdownText: { color: '#374151', fontSize: 13, fontWeight: '600' },
  dropdownTextActive: { color: '#111827' },
  fieldRelative: { position: 'relative' },
  avatarPreview: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: 40, height: 40, borderRadius: 20 },
  manageSection: {
    marginHorizontal: GAP,
    marginTop: 12,
    marginBottom: 8,
  },
  manageButton: {
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  manageButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  manageButtonIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  manageButtonTextContainer: {
    flex: 1,
  },
  manageButtonTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  manageButtonSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  manageButtonArrow: {
    marginLeft: 'auto',
  },
  // Modern Mechanic Card Styles
  modernMechanicCard: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  modernMechanicBackgroundImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  modernMechanicGradientOverlay: {
    flex: 1,
    padding: 10,
    justifyContent: 'space-between',
  },
  modernMechanicHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  modernMechanicProfileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  modernMechanicAvatarPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  modernMechanicAvatarPlaceholderInner: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modernMechanicAvatar: {
    width: '100%',
    height: '100%',
  },
  modernMechanicUsername: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600',
    flex: 1,
  },
  modernMechanicVipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.5)',
  },
  modernMechanicVipText: {
    fontSize: 9,
    color: '#F59E0B',
    fontWeight: '700',
  },
  modernMechanicMainCard: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modernMechanicInfoSection: {
    marginBottom: 6,
    flexDirection: 'row',
    gap: 5,
    flexWrap: 'wrap',
  },
  modernMechanicCategoryButton: {
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 10,
    backgroundColor: 'rgba(17, 24, 39, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    alignSelf: 'flex-start',
  },
  modernMechanicCategoryText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  modernMechanicPriceButton: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(17, 24, 39, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    alignSelf: 'flex-start',
  },
  modernMechanicPriceText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  modernMechanicSeparator: {
    height: 0.5,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginVertical: 5,
  },
  modernMechanicTypeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  modernMechanicTypeLeft: {
    flex: 1,
  },
  modernMechanicLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  modernMechanicLocationText: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '500',
  },
  modernMechanicCallButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(17, 24, 39, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  modernMechanicActionsFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  modernMechanicActionsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  modernMechanicRatingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 3,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  modernMechanicRatingText: {
    fontSize: 9,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  modernMechanicStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 2,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  modernMechanicStatusBadgeOpen: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  modernMechanicStatusBadgeClosed: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  modernMechanicStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  modernMechanicStatusDotOpen: {
    backgroundColor: '#10B981',
  },
  modernMechanicStatusDotClosed: {
    backgroundColor: '#EF4444',
  },
  modernMechanicStatusText: {
    fontSize: 9,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  // VIP Section Styles
  vipSection: {
    paddingHorizontal: GAP,
    paddingTop: 12,
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  vipList: {
    paddingRight: GAP,
  },
  // VIP Mechanic Card Styles
  vipMechanicCard: {
    width: width * 0.75,
    height: 200,
    borderRadius: 20,
    overflow: 'hidden',
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  vipMechanicCardImage: {
    width: '100%',
    height: '100%',
  },
  vipMechanicCardImageStyle: {
    borderRadius: 20,
  },
  vipMechanicCardGradient: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 16,
  },
  vipMechanicBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  vipMechanicBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F59E0B',
  },
  vipMechanicCardContent: {
    gap: 8,
  },
  vipMechanicCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  vipMechanicCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  vipMechanicCardLocation: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '500',
  },
});
