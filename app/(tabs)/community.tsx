import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  RefreshControl,
  StatusBar,
  ActivityIndicator,
  Alert,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useUser } from '../../contexts/UserContext';
import { useToast } from '../../contexts/ToastContext';
import { communityApi, CommunityPost, CreatePostData } from '../../services/communityApi';
import { communityRealtime } from '../../services/communityRealtime';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { photoService } from '../../services/photoService';
import ImageViewing from 'react-native-image-viewing';

// Helper function to format time
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

export default function CommunityScreen() {
  const { user } = useUser();
  const { success, error, info } = useToast();
  const router = useRouter();
  const { highlightPostId } = useLocalSearchParams();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newPostText, setNewPostText] = useState('');
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  const [realtimeSubscriptions, setRealtimeSubscriptions] = useState<Map<string, () => void>>(new Map());
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [highlightedPostId, setHighlightedPostId] = useState<string | null>(null);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [imageViewerIndex, setImageViewerIndex] = useState(0);
  const scrollViewRef = React.useRef<ScrollView>(null);

  // Load posts on component mount
  useEffect(() => {
    loadPosts();
  }, []);

  useEffect(() => {
    if (highlightPostId && posts.length > 0) {
      setHighlightedPostId(highlightPostId as string);
      
      setTimeout(() => {
        const postIndex = posts.findIndex(post => post.id === highlightPostId);
        if (postIndex !== -1 && scrollViewRef.current) {
          // Calculate approximate scroll position
          const scrollY = 300 + (postIndex * 220);
          scrollViewRef.current.scrollTo({ y: scrollY, animated: true });
        }
      }, 500);

      // Remove highlight after 3 seconds
      setTimeout(() => {
        setHighlightedPostId(null);
      }, 3000);
    }
  }, [highlightPostId, posts]);

  // Reload posts when screen comes into focus (e.g., returning from comments)
  // Note: useFocusEffect is from @react-navigation/native, but we're using Expo Router
  // For now, we'll rely on the useEffect and manual refresh

  // Cleanup real-time subscriptions on unmount
  useEffect(() => {
    return () => {
      realtimeSubscriptions.forEach((unsubscribe) => unsubscribe());
    };
  }, []);

  const mergeWithExisting = (prev: CommunityPost[], incoming: CommunityPost[]) => {
    return incoming.map((post) => {
      const prevMatch = prev.find((p) => p.id === post.id);
      if (prevMatch?.isLiked) {
        return { ...post, isLiked: true };
      }
      return post;
    });
  };

  const loadPosts = async () => {
    try {
      setLoading(true);
      const fetchedPosts = await communityApi.getPosts(user?.id);
      setPosts((prev) => mergeWithExisting(prev, fetchedPosts));
      
      // Set up real-time listeners for each post
      setupRealtimeListeners(fetchedPosts);
    } catch (err) {
      console.error('Error loading posts:', err);
      error('შეცდომა', 'პოსტების ჩატვირთვა ვერ მოხერხდა');
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeListeners = (posts: CommunityPost[]) => {
    // Clean up existing subscriptions
    realtimeSubscriptions.forEach((unsubscribe) => unsubscribe());
    
    const newSubscriptions = new Map<string, () => void>();
    
    posts.forEach((post) => {
      const unsubscribe = communityRealtime.subscribeToPost(post.id, (data) => {
        setPosts(prevPosts =>
          prevPosts.map(p =>
            p.id === post.id
              ? {
                  ...p,
                  likesCount: data.likesCount,
                  commentsCount: data.commentsCount,
                }
              : p
          )
        );
      });
      
      newSubscriptions.set(post.id, unsubscribe);
    });
    
    setRealtimeSubscriptions(newSubscriptions);
  };

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      const fetchedPosts = await communityApi.getPosts(user?.id);
      setPosts((prev) => mergeWithExisting(prev, fetchedPosts));
      success('განახლდა!', 'კომუნიტის პოსტები განახლდა');
    } catch (err) {
      console.error('Error refreshing posts:', err);
      error('შეცდომა', 'პოსტების განახლება ვერ მოხერხდა');
    } finally {
      setRefreshing(false);
    }
  }, [user?.id, success, error]);

  const toggleLike = async (postId: string) => {
    if (!user?.id) {
      error('შეცდომა', 'მომხმარებლის იდენტიფიკაცია საჭიროა');
      return;
    }

    try {
      const result = await communityApi.toggleLike(postId, user.id);
      
      // Update Firebase real-time data
      if (result.isLiked) {
        await communityRealtime.incrementLikes(postId);
      } else {
        await communityRealtime.decrementLikes(postId);
      }
      
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

  const handleImagePicker = () => {
    photoService.showPhotoPickerOptions(async (result) => {
      if (result.success && result.assets && result.assets.length > 0) {
        const imageUri = result.assets[0].uri;
        setSelectedImage(imageUri);
        
        // ავტვირთავთ cloudinary-ზე
        setIsUploadingImage(true);
        try {
          const uploadResult = await photoService.uploadPhoto(imageUri, 'community');
          if (uploadResult.success && uploadResult.url) {
            setSelectedImage(uploadResult.url);
            success('✅ ფოტო ავტვირთულია', 'ფოტო წარმატებით ავტვირთულია');
          } else {
            error('შეცდომა', uploadResult.error || 'ფოტოს ატვირთვა ვერ მოხერხდა');
            setSelectedImage(null);
          }
        } catch (err) {
          console.error('Image upload error:', err);
          error('შეცდომა', 'ფოტოს ატვირთვისას მოხდა შეცდომა');
          setSelectedImage(null);
        } finally {
          setIsUploadingImage(false);
        }
      } else if (result.error) {
        error('შეცდომა', result.error);
      }
    });
  };

  const removeSelectedImage = () => {
    setSelectedImage(null);
  };

  const createPost = async () => {
    if (!user?.id || !newPostText.trim()) {
      error('შეცდომა', 'პოსტის ტექსტი აუცილებელია');
      return;
    }

    try {
      setIsCreatingPost(true);
      const postData: CreatePostData = {
        userId: user.id,
        userName: user.name || 'უცნობი მომხმარებელი',
        userInitial: user.name ? user.name.charAt(0).toUpperCase() : '?',
        postText: newPostText.trim(),
        postImage: selectedImage || undefined,
      };

      const newPost = await communityApi.createPost(postData);
      setPosts(prevPosts => [newPost, ...prevPosts]);
      setNewPostText('');
      setSelectedImage(null);
      success('წარმატება!', 'პოსტი გამოქვეყნდა');
    } catch (err) {
      console.error('Error creating post:', err);
      error('შეცდომა', 'პოსტის გამოქვეყნება ვერ მოხერხდა');
    } finally {
      setIsCreatingPost(false);
    }
  };

  const sharePost = async (post: CommunityPost) => {
    try {
      const messageParts = [
        post.postText || '',
        post.postImage ? `📸 ${post.postImage}` : '',
      ].filter(Boolean);

      await Share.share({
        message: messageParts.join('\n\n'),
        url: post.postImage,
        title: 'გაზიარება',
      });
    } catch (err) {
      console.error('Error sharing post:', err);
      error('შეცდომა', 'გაზიარება ვერ მოხერხდა');
    }
  };

  const deletePost = async (postId: string) => {
    Alert.alert(
      'პოსტის წაშლა',
      'დარწმუნებული ხართ რომ გსურთ პოსტის წაშლა?',
      [
        { text: 'გაუქმება', style: 'cancel' },
        {
          text: 'წაშლა',
          style: 'destructive',
          onPress: async () => {
            try {
              await communityApi.deletePost(postId);
              setPosts(prevPosts => prevPosts.filter(post => post.id !== postId));
              success('წარმატება!', 'პოსტი წაიშალა');
            } catch (err) {
              console.error('Error deleting post:', err);
              error('შეცდომა', 'პოსტის წაშლა ვერ მოხერხდა');
            }
          },
        },
      ]
    );
  };

  const showPostOptions = (post: CommunityPost) => {
    const canDelete = user?.id && post.userId === user.id;

    const actions = [
      {
        text: 'გაზიარება',
        onPress: () => sharePost(post),
      },
      canDelete
        ? {
            text: 'წაშლა',
            style: 'destructive' as const,
            onPress: () => deletePost(post.id),
          }
        : null,
      { text: 'გაუქმება', style: 'cancel' as const },
    ].filter(Boolean) as { text: string; style?: any; onPress?: () => void }[];

    Alert.alert('პოსტის ოფციები', 'აირჩიე ქმედება', actions);
  };

  const renderPost = (post: CommunityPost) => {
    const isHighlighted = highlightedPostId === post.id;
    const isOwner = user?.id && post.userId === user.id;
    
    return (
    <View style={[styles.post, isHighlighted && styles.highlightedPost]}>
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
        {isOwner ? (
          <TouchableOpacity onPress={() => showPostOptions(post)}>
            <Ionicons name="ellipsis-horizontal" size={20} color="#6B7280" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 24, height: 24 }} />
        )}
      </View>
      
      <Text style={styles.postText}>{post.postText}</Text>
      
      {post.postImage && (
        <TouchableOpacity 
          style={styles.postImageContainer}
          onPress={() => {
            // ვიპოვოთ ამ პოსტის ინდექსი ყველა ფოტოების სიაში
            const postsWithImages = posts.filter(p => p.postImage);
            const imageIndex = postsWithImages.findIndex(p => p.id === post.id);
            setImageViewerIndex(imageIndex >= 0 ? imageIndex : 0);
            setImageViewerVisible(true);
          }}
          activeOpacity={0.9}
        >
          <Image 
            source={{ uri: post.postImage }} 
            style={styles.postImage} 
          />
        </TouchableOpacity>
      )}
      
      <View style={styles.postActions}>
        <TouchableOpacity 
          style={[styles.actionButton, post.isLiked && styles.actionButtonLiked]}
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
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => sharePost(post)}
        >
          <Ionicons name="share-outline" size={18} color="#6B7280" />
          <Text style={styles.actionText}>გაზიარება</Text>
        </TouchableOpacity>
      </View>
    </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header */}
      <LinearGradient
        colors={['#FFFFFF', '#F8FAFC']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>ჯგუფი</Text>
            <Text style={styles.headerSubtitle}>
              მანქანების მოყვარულთა საზოგადოება
            </Text>
          </View>
          
        </View>
      </LinearGradient>

      <ScrollView 
        ref={scrollViewRef}
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={['#111827']}
          />
        }
      >
        {/* Create Post Section */}
        <View style={styles.createPostContainer}>
          <View style={styles.createPostHeader}>
            <View style={styles.userAvatar}>
              <Text style={styles.userAvatarText}>
                {user?.name ? user.name.charAt(0).toUpperCase() : '?'}
              </Text>
            </View>
            <TextInput
              style={styles.createPostInput}
              placeholder="დაწერე რაიმე რაც გაინტერესებს .. "
              placeholderTextColor="#9CA3AF"
              value={newPostText}
              onChangeText={setNewPostText}
              multiline
            />
          </View>
          
          {/* Selected Image Preview */}
          {selectedImage && (
            <View style={styles.selectedImageContainer}>
              <Image source={{ uri: selectedImage }} style={styles.selectedImage} />
              <TouchableOpacity 
                style={styles.removeImageButton}
                onPress={removeSelectedImage}
              >
                <Ionicons name="close-circle" size={24} color="#EF4444" />
              </TouchableOpacity>
              {isUploadingImage && (
                <View style={styles.uploadingOverlay}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.uploadingText}>ავტვირთვა...</Text>
                </View>
              )}
            </View>
          )}
          
          <View style={styles.createPostActions}>
            <TouchableOpacity 
              style={styles.createPostAction}
              onPress={handleImagePicker}
              disabled={isUploadingImage}
            >
              <Ionicons name="image-outline" size={20} color="#6B7280" />
              <Text style={styles.createPostActionText}>ფოტო</Text>
            </TouchableOpacity>
           
            <TouchableOpacity 
              style={[styles.publishButton, (!newPostText.trim() || isCreatingPost || isUploadingImage) && styles.disabledButton]}
              disabled={!newPostText.trim() || isCreatingPost || isUploadingImage}
              onPress={createPost}
              activeOpacity={0.8}
            >
              {isCreatingPost ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.publishButtonText}>გამოქვეყნება</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Posts */}
        <View style={styles.postsContainer}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#111827" />
              <Text style={styles.loadingText}>პოსტები იტვირთება...</Text>
            </View>
          ) : posts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={64} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>პოსტები არ არის</Text>
              <Text style={styles.emptySubtitle}>იყავი პირველი, ვინც გამოაქვეყნებს პოსტს!</Text>
            </View>
          ) : (
            posts.map((post) => (
              <View key={post.id}>
                {renderPost(post)}
              </View>
            ))
          )}
        </View>

        {/* Bottom Spacing */}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Image Viewer Modal */}
      <ImageViewing
        images={posts
          .filter(post => post.postImage)
          .map(post => ({ uri: post.postImage! }))}
        imageIndex={imageViewerIndex}
        visible={imageViewerVisible}
        onRequestClose={() => setImageViewerVisible(false)}
        swipeToCloseEnabled={true}
        doubleTapToZoomEnabled={true}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: '#1A1A1A',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: '#6B7280',
    marginTop: 4,
  },
  createPostButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  content: {
    flex: 1,
  },
  createPostContainer: {
    backgroundColor: '#FFFFFF',
    margin: 20,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  createPostHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  createPostInput: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
    minHeight: 40,
    textAlignVertical: 'top',
  },
  createPostActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  createPostAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  createPostActionText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  publishButton: {
    backgroundColor: '#000000',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  publishButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    letterSpacing: 0.1,
  },
  postsContainer: {
    paddingHorizontal: 20,
    gap: 16,
  },
  post: {
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
    fontWeight: '600',
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  postTime: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  postText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 12,
  },
  postImageContainer: {
    marginBottom: 12,
  },
  postImage: {
    width: '100%',
    height: 200,
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
  actionButtonLiked: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderColor: '#FCA5A5',
  },
  actionText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  likedText: {
    color: '#EF4444',
  },
  disabledButton: {
    opacity: 0.6,
    shadowOpacity: 0.1,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  selectedImageContainer: {
    position: 'relative',
    marginVertical: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  selectedImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 2,
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  uploadingText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 8,
  },
  highlightedPost: {
    borderWidth: 2,
    borderColor: '#3B82F6',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
