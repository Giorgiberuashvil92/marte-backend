import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, ActivityIndicator, StatusBar, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { mechanicsApi, MechanicDTO } from '@/services/mechanicsApi';
import { engagementApi } from '@/services/engagementApi';
import { useUser } from '@/contexts/UserContext';

export default function MechanicDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useUser();
  const [data, setData] = useState<MechanicDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const mech = id ? await mechanicsApi.getMechanicById(String(id)) : null;
        setData(mech);
        
        console.log('🔧 [MECHANIC] Mechanic details loaded:', {
          mechanicId: id,
          mechanicName: mech?.name,
          userId: user?.id,
        });
        
        // Track view
        if (mech && id && user?.id) {
          console.log('👁️ [MECHANIC] Tracking view for mechanic:', id, 'user:', user.id);
          engagementApi.trackMechanicView(id, user.id).catch((err) => {
            console.error('❌ [MECHANIC] Error tracking mechanic view:', err);
          });
        } else {
          console.warn('⚠️ [MECHANIC] Cannot track view - missing userId or mechanicId:', {
            userId: user?.id,
            mechanicId: id,
            hasMechanic: !!mech,
          });
        }
      } catch (e) {
        setError('დეტალების ჩატვირთვა ვერ მოხერხდა');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [id, user?.id]);

  const img = data?.avatar || 'https://images.unsplash.com/photo-1581094271901-8022df4466b9?q=80&w=1200&auto=format&fit=crop';
  const services = data?.services || [];
  const [tab, setTab] = useState<'projects' | 'reviews'>('projects');

  const handleCall = async () => {
    if (!data || !id) return;
    const phone = data.phone;
    if (!phone) {
      Alert.alert('შეცდომა', 'ტელეფონის ნომერი არ არის მითითებული');
      return;
    }
    
    console.log('📞 [MECHANIC] Call button pressed:', {
      mechanicId: id,
      mechanicName: data.name,
      phone: phone,
      userId: user?.id,
    });
    
    // Track call
    if (user?.id) {
      console.log('📞 [MECHANIC] Tracking call for mechanic:', id, 'user:', user.id);
      engagementApi.trackMechanicCall(id, user.id).catch((err) => {
        console.error('❌ [MECHANIC] Error tracking mechanic call:', err);
      });
    } else {
      console.warn('⚠️ [MECHANIC] Cannot track call - missing userId:', {
        userId: user?.id,
        mechanicId: id,
      });
    }
    
    // ასუფთავებს ტელეფონის ნომერს - ტოვებს მხოლოდ რიცხვებს და + სიმბოლოს
    let phoneNumber = phone.replace(/[^\d+]/g, '');
    // თუ არ იწყება +-ით, ვამატებთ საქართველოს კოდს
    if (!phoneNumber.startsWith('+')) {
      // თუ იწყება 5-ით, ეს არის ქართული მობილური ნომერი
      if (phoneNumber.startsWith('5')) {
        phoneNumber = `+995${phoneNumber}`;
      } else {
        // სხვა შემთხვევაში ვამატებთ +995
        phoneNumber = `+995${phoneNumber}`;
      }
    }
    const url = `tel:${phoneNumber}`;
    console.log('📞 [CALL] Phone:', phone, '-> Formatted:', phoneNumber, '-> URL:', url);
    try {
      const supported = await Linking.canOpenURL(url);
      console.log('📞 [CALL] Can open URL:', supported);
      if (supported) {
        await Linking.openURL(url);
      } else {
        // iOS-ზე ზოგჯერ canOpenURL აბრუნებს false, მაგრამ openURL მაინც მუშაობს
        try {
          await Linking.openURL(url);
        } catch (e) {
          console.error('📞 [CALL] Error:', e);
          Alert.alert('შეცდომა', 'ტელეფონის დარეკვა ვერ მოხერხდა. გთხოვთ დარეკოთ ხელით: ' + phone);
        }
      }
    } catch (error) {
      console.error('📞 [CALL] Error:', error);
      Alert.alert('შეცდომა', `ტელეფონის დარეკვა ვერ მოხერხდა. გთხოვთ დარეკოთ ხელით: ${phone}`);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
          <View style={styles.heroWrap}>
            <Image source={{ uri: img }} style={styles.hero} resizeMode="cover" />
            <View style={styles.heroTopRow}>
              <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
                <Ionicons name="arrow-back" size={20} color="#111827" />
              </TouchableOpacity>
            </View>
            {data && (
              <View style={styles.heroBadges}>
                <View style={[styles.badge, data.isAvailable ? styles.badgeGreen : styles.badgeRed]}>
                  <View style={styles.dot} />
                  <Text style={styles.badgeText}>{data.isAvailable ? 'ხელმისაწვდომი' : 'დაკავებული'}</Text>
                </View>
                {typeof data.rating === 'number' ? (
                  <View style={styles.ratingLight}>
                    <Ionicons name="star" size={14} color="#F59E0B" />
                    <Text style={styles.ratingLightText}>{data.rating.toFixed(1)}</Text>
                  </View>
                ) : null}
              </View>
            )}
          </View>

          {loading ? (
            <View style={styles.center}><ActivityIndicator color="#6366F1" size="large" /></View>
          ) : error ? (
            <View style={styles.center}><Text style={styles.error}>{error}</Text></View>
          ) : !data ? (
            <View style={styles.center}><Text style={styles.error}>ჩანაწერი ვერ მოიძებნა</Text></View>
          ) : (
            <View style={{ paddingHorizontal: 20, gap: 20 }}>
              <View style={styles.headerBlock}>
                <Text style={styles.title}>{data.name}</Text>
                <Text style={styles.sub}>{data.specialty}</Text>
                {typeof data.rating === 'number' && data.rating > 0 ? (
                  <View style={styles.ratingRow}>
                    <Ionicons name="star" size={16} color="#F59E0B" />
                    <Text style={styles.ratingText}>{data.rating.toFixed(1)}</Text>
                    {data.reviews != null && data.reviews > 0 ? (
                      <Text style={styles.reviewsCount}>({data.reviews} მიმოხილვა)</Text>
                    ) : null}
                  </View>
                ) : null}
              </View>

              <View style={styles.infoGrid}>
                <View style={styles.infoItem}>
                  <View style={styles.infoIconWrap}>
                    <Ionicons name="location" size={18} color="#6366F1" />
                  </View>
                  <Text style={styles.infoLabel}>ლოკაცია</Text>
                  <Text style={styles.infoValue} numberOfLines={2}>{data.location || '-'}</Text>
                </View>
                <View style={styles.infoItem}>
                  <View style={styles.infoIconWrap}>
                    <Ionicons name="call" size={18} color="#10B981" />
                  </View>
                  <Text style={styles.infoLabel}>ტელეფონი</Text>
                  <Text style={styles.infoValue}>{data.phone || '-'}</Text>
                </View>
                
              </View>

              {services.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>სერვისები</Text>
                  <View style={styles.tagsRow}>
                    {services.map((s, i) => (
                      <View key={`${s}-${i}`} style={styles.tag}>
                        <Ionicons name="checkmark-circle" size={14} color="#6366F1" />
                        <Text style={styles.tagText}>{s}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {data.description && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>აღწერა</Text>
                  <View style={styles.descCard}>
                    <Text style={styles.desc}>{data.description}</Text>
                  </View>
                </View>
              )}

              {/* Tabs */}
              <View style={styles.tabsRow}>
                <TouchableOpacity
                  style={[styles.tabBtn, tab === 'projects' && styles.tabBtnActive]}
                  onPress={() => setTab('projects')}
                  activeOpacity={0.7}
                >
                  <Ionicons 
                    name={tab === 'projects' ? 'images' : 'images-outline'} 
                    size={16} 
                    color={tab === 'projects' ? '#6366F1' : '#9CA3AF'} 
                  />
                  <Text style={[styles.tabText, tab === 'projects' && styles.tabTextActive]}>ნამუშევრები</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tabBtn, tab === 'reviews' && styles.tabBtnActive]}
                  onPress={() => setTab('reviews')}
                  activeOpacity={0.7}
                >
                  <Ionicons 
                    name={tab === 'reviews' ? 'star' : 'star-outline'} 
                    size={16} 
                    color={tab === 'reviews' ? '#6366F1' : '#9CA3AF'} 
                  />
                  <Text style={[styles.tabText, tab === 'reviews' && styles.tabTextActive]}>მიმოხილვები</Text>
                </TouchableOpacity>
              </View>

              {tab === 'projects' ? (
                <View style={styles.tabContent}>
                  {Array.isArray(data.projects) && data.projects.length > 0 ? (
                    <View style={styles.projectsGrid}>
                      {data.projects.map((p, idx) => (
                        <TouchableOpacity key={`prj-${idx}`} style={styles.projectCard} activeOpacity={0.8}>
                          {p?.image ? (
                            <Image source={{ uri: p.image }} style={styles.projectImage} />
                          ) : (
                            <View style={styles.projectImagePlaceholder}>
                              <Ionicons name="image-outline" size={32} color="#9CA3AF" />
                            </View>
                          )}
                          {p?.title ? (
                            <View style={styles.projectTitleWrap}>
                              <Text numberOfLines={2} style={styles.projectTitle}>{String(p.title)}</Text>
                            </View>
                          ) : null}
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : (
                    <View style={styles.emptyState}>
                      <Ionicons name="images-outline" size={48} color="#D1D5DB" />
                      <Text style={styles.emptyStateText}>ნამუშევრები არ არის</Text>
                    </View>
                  )}
                </View>
              ) : (
                <View style={styles.tabContent}>
                  {Array.isArray(data.reviewList) && data.reviewList.length > 0 ? (
                    <View style={styles.reviewsList}>
                      {data.reviewList.map((r, idx) => (
                        <View key={`rev-${idx}`} style={styles.reviewCard}>
                          <View style={styles.reviewHeader}>
                            <View style={styles.reviewUserWrap}>
                              <View style={styles.reviewAvatar}>
                                <Text style={styles.reviewAvatarText}>{(r.user || 'მ')[0].toUpperCase()}</Text>
                              </View>
                              <View>
                                <Text style={styles.reviewUser}>{r.user || 'მომხმარებელი'}</Text>
                                {r.date != null && r.date !== '' ? <Text style={styles.reviewDate}>{String(r.date)}</Text> : null}
                              </View>
                            </View>
                            <View style={styles.reviewStars}>
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Ionicons key={i} name={i < (r.rating || 0) ? 'star' : 'star-outline'} size={14} color="#F59E0B" />
                              ))}
                            </View>
                          </View>
                          {r.comment ? <Text style={styles.reviewText}>{String(r.comment)}</Text> : null}
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View style={styles.emptyState}>
                      <Ionicons name="star-outline" size={48} color="#D1D5DB" />
                      <Text style={styles.emptyStateText}>მიმოხილვები არ არის</Text>
                    </View>
                  )}
                </View>
              )}

              <View style={styles.actionsRow}>
                <TouchableOpacity style={styles.btnPrimary} onPress={handleCall} activeOpacity={0.8}>
                  <View style={styles.btnIconWrap}>
                    <Ionicons name="call" size={20} color="#FFFFFF" />
                  </View>
                  <Text style={styles.btnPrimaryText}>დარეკვა</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  heroWrap: { width: '100%', height: 280, position: 'relative', backgroundColor: '#000000', overflow: 'hidden' },
  hero: { width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  heroTopRow: { position: 'absolute', top: 16, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', zIndex: 10 },
  iconBtn: { 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    backgroundColor: 'rgba(255,255,255,0.95)', 
    alignItems: 'center', 
    justifyContent: 'center', 
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  heroBadges: { position: 'absolute', bottom: 16, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  badgeGreen: { backgroundColor: 'rgba(16,185,129,0.95)' },
  badgeRed: { backgroundColor: 'rgba(239,68,68,0.95)' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  ratingLight: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.95)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  ratingLightText: { color: '#111827', fontSize: 13, fontWeight: '800' },
  center: { padding: 48, alignItems: 'center', justifyContent: 'center', minHeight: 200 },
  error: { color: '#DC2626', fontSize: 15, fontWeight: '600' },
  headerBlock: { gap: 8, marginTop: 8 },
  title: { color: '#111827', fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  sub: { color: '#6B7280', fontSize: 15, fontWeight: '600' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  ratingText: { color: '#111827', fontSize: 15, fontWeight: '700' },
  reviewsCount: { color: '#9CA3AF', fontSize: 13 },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  infoItem: { 
    width: '48%', 
    backgroundColor: '#FFFFFF', 
    borderRadius: 16, 
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  infoIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  infoLabel: { color: '#6B7280', fontSize: 11, fontWeight: '600', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { color: '#111827', fontSize: 15, fontWeight: '700', lineHeight: 20 },
  section: { gap: 12 },
  sectionTitle: { color: '#111827', fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tag: { 
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14, 
    paddingVertical: 10, 
    backgroundColor: '#FFFFFF', 
    borderRadius: 12, 
    borderWidth: 1, 
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  tagText: { color: '#374151', fontSize: 13, fontWeight: '600' },
  descCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  desc: { color: '#374151', fontSize: 14, lineHeight: 22 },
  muted: { color: '#9CA3AF', fontSize: 13 },
  actionsRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  btnPrimary: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 10, 
    backgroundColor: '#6366F1', 
    borderRadius: 16, 
    paddingVertical: 16,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  btnIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  btnSecondary: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#F9FAFB', borderRadius: 12, paddingVertical: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  btnSecondaryText: { color: '#374151', fontWeight: '800' },
  tabContent: { minHeight: 200 },
  projectsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  projectCard: { 
    width: '48%', 
    backgroundColor: '#FFFFFF', 
    borderRadius: 16, 
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  projectImage: { width: '100%', height: 140 },
  projectImagePlaceholder: {
    width: '100%',
    height: 140,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  projectTitleWrap: {
    padding: 12,
    backgroundColor: '#FFFFFF',
  },
  projectTitle: { color: '#111827', fontSize: 13, fontWeight: '700', lineHeight: 18 },
  reviewCard: { 
    backgroundColor: '#FFFFFF', 
    borderRadius: 16, 
    padding: 16, 
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  reviewHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 },
  reviewUserWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  reviewAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewAvatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  reviewUser: { color: '#111827', fontSize: 15, fontWeight: '800', marginBottom: 2 },
  reviewStars: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  reviewText: { color: '#374151', fontSize: 14, lineHeight: 20 },
  reviewDate: { color: '#9CA3AF', fontSize: 12 },
  reviewsList: { gap: 12 },
  tabsRow: { flexDirection: 'row', gap: 8, backgroundColor: '#F3F4F6', borderRadius: 16, padding: 6 },
  tabBtn: { 
    flex: 1, 
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12, 
    borderRadius: 12,
  },
  tabBtnActive: { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  tabText: { color: '#9CA3AF', fontSize: 14, fontWeight: '700' },
  tabTextActive: { color: '#6366F1' },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  emptyStateText: {
    color: '#9CA3AF',
    fontSize: 15,
    fontWeight: '600',
  },
});


