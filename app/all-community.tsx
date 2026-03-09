import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Dimensions, Animated, Image, RefreshControl, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { communityApi, CommunityPost } from '../services/communityApi';
import { useUser } from '../contexts/UserContext';

const { width } = Dimensions.get('window');

export default function AllCommunityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'popular' | 'recent'>('all');
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchPosts();
    
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  const fetchPosts = async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      
      const fetchedPosts = await communityApi.getPosts(user?.id);
      setPosts(fetchedPosts);
    } catch (error) {
      console.error('Error fetching community posts:', error);
      // Fallback to empty array on error
      setPosts([]);
    } finally {
      setLoading(false);
      if (isRefresh) setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchPosts(true);
  };

  const toggleLike = async (postId: string) => {
    if (!user?.id) return;
    
    try {
      const result = await communityApi.toggleLike(postId, user.id);
      
      setPosts(prevPosts =>
        prevPosts.map(post =>
          post.id === postId
            ? { ...post, isLiked: result.isLiked, likesCount: result.likesCount }
            : post
        )
      );
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const formatTime = (dateString: string): string => {
    const now = new Date();
    const postDate = new Date(dateString);
    const diffInMs = now.getTime() - postDate.getTime();
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInHours < 1) return 'ახლა';
    if (diffInHours < 24) return `${diffInHours} სთ`;
    if (diffInDays < 7) return `${diffInDays} დღე`;
    return postDate.toLocaleDateString('ka-GE');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>იტვირთება...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <LinearGradient colors={['#1E293B', '#0F172A']} style={styles.header}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <BlurView intensity={40} tint="dark" style={styles.backButtonBlur}>
                <Ionicons name="arrow-back" size={22} color="#FFF" />
              </BlurView>
            </TouchableOpacity>
            
            <Text style={styles.headerText}>ჯგუფი</Text>
            
            <TouchableOpacity style={styles.headerButton}>
              <BlurView intensity={40} tint="dark" style={styles.backButtonBlur}>
                <Ionicons name="add" size={24} color="#FFF" />
              </BlurView>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Filters */}
      <View style={styles.filtersContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {[
            { key: 'all', label: 'ყველა', icon: 'apps' },
            { key: 'popular', label: 'პოპულარული', icon: 'flame' },
            { key: 'recent', label: 'ბოლო', icon: 'time' },
          ].map((item) => (
            <TouchableOpacity
              key={item.key}
              style={[styles.filterButton, filter === item.key && styles.filterButtonActive]}
              onPress={() => setFilter(item.key as any)}
            >
              <BlurView intensity={filter === item.key ? 50 : 30} tint="dark" style={styles.filterBlur}>
                <Ionicons name={item.icon as any} size={16} color={filter === item.key ? '#FFF' : '#9CA3AF'} />
                <Text style={[styles.filterText, filter === item.key && styles.filterTextActive]}>{item.label}</Text>
              </BlurView>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Posts */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.postsList, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" />}
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          {posts.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="chatbubbles-outline" size={60} color="#9CA3AF" />
              <Text style={styles.emptyText}>პოსტები არ არის</Text>
              <Text style={styles.emptySubtext}>გახდი პირველი ვინც დაპოსტავს</Text>
            </View>
          ) : (
            posts.map((post: CommunityPost) => (
            <View key={post.id} style={styles.postCard}>
              <BlurView intensity={40} tint="dark" style={styles.postCardBlur}>
                {/* Header */}
                <View style={styles.postHeader}>
                  <View style={styles.authorInfo}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{post.userInitial}</Text>
                    </View>
                    <View>
                      <Text style={styles.authorName}>{post.userName}</Text>
                      <Text style={styles.postTime}>{formatTime(post.createdAt)}</Text>
                    </View>
                  </View>
                  <TouchableOpacity>
                    <Ionicons name="ellipsis-horizontal" size={20} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>

                {/* Content */}
                <Text style={styles.postContent}>{post.postText}</Text>

                {/* Image */}
                {post.postImage && (
                  <View style={styles.postImageContainer}>
                    <View style={styles.postImagePlaceholder}>
                      <Ionicons name="image" size={40} color="rgba(255,255,255,0.3)" />
                    </View>
                  </View>
                )}

                {/* Actions */}
                <View style={styles.postActions}>
                  <TouchableOpacity style={styles.actionButton} onPress={() => toggleLike(post.id)}>
                    <Ionicons name={post.isLiked ? "heart" : "heart-outline"} size={20} color={post.isLiked ? "#EF4444" : "#9CA3AF"} />
                    <Text style={styles.actionText}>{post.likesCount}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionButton}>
                    <Ionicons name="chatbubble-outline" size={18} color="#9CA3AF" />
                    <Text style={styles.actionText}>{post.commentsCount}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionButton}>
                    <Ionicons name="share-social-outline" size={18} color="#9CA3AF" />
                    <Text style={styles.actionText}>0</Text>
                  </TouchableOpacity>
                </View>
              </BlurView>
            </View>
          ))
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111827' },
  loadingText: { marginTop: 16, fontSize: 16, color: '#9CA3AF', fontFamily: 'Firago-Regular' },
  
  // Header
  header: { paddingBottom: 20 },
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10 },
  backButton: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden' },
  backButtonBlur: { flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  headerText: { fontSize: 20, fontWeight: '700', color: '#FFF', fontFamily: 'Firago-Bold' },
  headerButton: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden' },
  
  // Filters
  filtersContainer: { paddingVertical: 16, backgroundColor: '#111827' },
  filters: { paddingHorizontal: 20, gap: 10 },
  filterButton: { borderRadius: 16, overflow: 'hidden' },
  filterButtonActive: { borderWidth: 1, borderColor: 'rgba(59,130,246,0.5)' },
  filterBlur: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  filterText: { fontSize: 14, color: '#9CA3AF', fontFamily: 'Firago-Medium' },
  filterTextActive: { color: '#FFF', fontFamily: 'Firago-Bold' },
  
  // Posts
  scrollView: { flex: 1 },
  postsList: { padding: 20, gap: 16 },
  postCard: { borderRadius: 20, overflow: 'hidden' },
  postCardBlur: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', padding: 16 },
  postHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  authorInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#3B82F6', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: '700', color: '#FFF', fontFamily: 'Firago-Bold' },
  authorName: { fontSize: 15, fontWeight: '600', color: '#E5E7EB', fontFamily: 'Firago-SemiBold' },
  postTime: { fontSize: 12, color: '#9CA3AF', fontFamily: 'Firago-Regular' },
  postContent: { fontSize: 15, lineHeight: 22, color: '#E5E7EB', marginBottom: 12, fontFamily: 'Firago-Regular' },
  postImageContainer: { height: 200, borderRadius: 12, overflow: 'hidden', marginBottom: 12, backgroundColor: '#1E293B' },
  postImagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  postActions: { flexDirection: 'row', gap: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  actionButton: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { fontSize: 14, color: '#9CA3AF', fontFamily: 'Firago-Medium' },
  
  // Empty State
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 18, fontWeight: '700', color: '#E5E7EB', fontFamily: 'Firago-Bold' },
  emptySubtext: { fontSize: 14, color: '#9CA3AF', fontFamily: 'Firago-Regular' },
});
