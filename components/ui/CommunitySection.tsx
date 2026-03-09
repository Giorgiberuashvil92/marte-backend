import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useUser } from '../../contexts/UserContext';
import { useToast } from '../../contexts/ToastContext';
import { communityApi, CommunityPost } from '../../services/communityApi';

interface CommunitySectionProps {
  limit?: number;
}

const CommunitySection: React.FC<CommunitySectionProps> = ({
  limit = 3
}) => {
  const router = useRouter();
  const { user } = useUser();
  const { success, error } = useToast();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);

  // Load posts on component mount
  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async () => {
    try {
      setLoading(true);
      const fetchedPosts = await communityApi.getPosts(user?.id);
      // Take only the first 'limit' posts for the section
      setPosts(fetchedPosts.slice(0, limit));
    } catch (err) {
      console.error('Error loading community posts:', err);
      error('შეცდომა', 'კომუნიტის პოსტების ჩატვირთვა ვერ მოხერხდა');
    } finally {
      setLoading(false);
    }
  };

  const toggleLike = async (postId: string) => {
    if (!user?.id) {
      error('შეცდომა', 'მომხმარებლის იდენტიფიკაცია საჭიროა');
      return;
    }

    try {
      const result = await communityApi.toggleLike(postId, user.id);
      
      // Update local state immediately for better UX
      setPosts(prevPosts =>
        prevPosts.map(post =>
          post.id === postId
            ? {
                ...post,
                isLiked: result.isLiked,
                likesCount: result.likesCount,
              }
            : post
        )
      );
    } catch (err) {
      console.error('Error toggling like:', err);
      error('შეცდომა', 'ლაიქის დამატება ვერ მოხერხდა');
    }
  };

  const formatTime = (dateString: string): string => {
    const now = new Date();
    const postDate = new Date(dateString);
    const diffInMs = now.getTime() - postDate.getTime();
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInHours < 1) {
      return 'ახლახან';
    } else if (diffInHours < 24) {
      return `${diffInHours} საათის წინ`;
    } else if (diffInDays < 7) {
      return `${diffInDays} დღის წინ`;
    } else {
      return postDate.toLocaleDateString('ka-GE');
    }
  };
  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <View style={styles.communityTitleContainer}>
          <Ionicons name="people" size={20} color="#111827" />
          <Text style={styles.sectionTitle}>ჯგუფი</Text>
        </View>
        <TouchableOpacity 
          style={styles.viewAllButton}
          onPress={() => router.push('/(tabs)/community')}
        >
          <Text style={styles.viewAllText}>ყველას ნახვა</Text>
          <Ionicons name="chevron-forward" size={16} color="#111827" />
        </TouchableOpacity>
      </View>
      
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.communityContent}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#111827" />
            <Text style={styles.loadingText}>პოსტები იტვირთება...</Text>
          </View>
        ) : posts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={48} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>პოსტები არ არის</Text>
            <Text style={styles.emptySubtitle}>იყავი პირველი, ვინც გამოაქვეყნებს პოსტს!</Text>
          </View>
        ) : (
          posts.map((post) => (
          <TouchableOpacity 
            key={post.id} 
            style={styles.communityPost}
            onPress={() => router.push({
              pathname: '/(tabs)/community',
              params: { highlightPostId: post.id }
            })}
          >
            <View style={styles.postHeader}>
              <View style={styles.userInfo}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{post.userInitial}</Text>
                </View>
                <View>
                  <Text style={styles.userName}>{post.userName}</Text>
                  <Text style={styles.postTime}>{formatTime(post.createdAt)}</Text>
                </View>
              </View>
              <TouchableOpacity>
                <Ionicons name="ellipsis-horizontal" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.postText}>{post.postText}</Text>
            
            {post.postImage && (
              <View style={styles.postImageContainer}>
                <Image 
                  source={{ uri: post.postImage }} 
                  style={styles.postImage} 
                />
              </View>
            )}
            
            <View style={styles.postActions}>
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => toggleLike(post.id)}
              >
                <Ionicons 
                  name={post.isLiked ? "heart" : "heart-outline"} 
                  size={18} 
                  color={post.isLiked ? "#EF4444" : "#6B7280"} 
                />
                <Text style={[styles.actionText, post.isLiked && styles.likedText]}>
                  {post.likesCount}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => router.push({
                  pathname: '/comments',
                  params: {
                    postId: post.id,
                    postText: post.postText,
                    userName: post.userName,
                    commentsCount: post.commentsCount,
                  }
                })}
              >
                <Ionicons name="chatbubble-outline" size={18} color="#6B7280" />
                <Text style={styles.actionText}>{post.commentsCount}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton}>
                <Ionicons name="share-outline" size={18} color="#6B7280" />
                <Text style={styles.actionText}>გაზიარება</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  communityTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'HelveticaMedium',
    fontWeight: '700',
    color: '#1A1A1A',
    textTransform: 'uppercase',
  },
  sectionAction: {
    fontSize: 13,
    color: '#111827',
    fontFamily: 'HelveticaMedium',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  viewAllText: {
    fontSize: 13,
    color: '#111827',
    fontFamily: 'HelveticaMedium',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  communityContent: {
    gap: 16,
    paddingRight: 20,
  },
  communityPost: {
    width: 280,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'HelveticaMedium',
    fontWeight: '600',
  },
  userName: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    fontWeight: '600',
    color: '#1F2937',
  },
  postTime: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    color: '#6B7280',
    marginTop: 2,
  },
  postText: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    color: '#374151',
    lineHeight: 20,
    marginBottom: 12,
  },
  postImageContainer: {
    marginBottom: 12,
  },
  postImage: {
    width: '100%',
    height: 120,
    borderRadius: 12,
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  actionText: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'HelveticaMedium',
    fontWeight: '500',
  },
  likedText: {
    color: '#EF4444',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'HelveticaMedium',
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: 'HelveticaMedium',
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default CommunitySection;
