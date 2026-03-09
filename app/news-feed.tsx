import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  StatusBar,
  RefreshControl,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useUser } from '@/contexts/UserContext';
import { analyticsService } from '@/services/analytics';
import { newsFeedApi, NewsArticleItem } from '@/services/newsFeedApi';

const { width } = Dimensions.get('window');

export default function NewsFeedScreen() {
  const { user } = useUser();
  const router = useRouter();
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    loadArticles();
  }, []);

  const loadArticles = async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      const data = await newsFeedApi.getArticles(true);
      setArticles(
        data.map((a: NewsArticleItem) => ({
          ...a,
          publishedAt: a.publishedAt ? new Date(a.publishedAt) : new Date(),
        })),
      );
    } catch (error) {
      console.error('Error loading articles:', error);
      setArticles([]);
    } finally {
      setLoading(false);
      if (isRefresh) setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadArticles(true);
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} დღის წინ`;
    if (hours > 0) return `${hours} საათის წინ`;
    return 'ახლახან';
  };

  const toggleFavorite = (id: string) => {
    setFavorites(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    );
  };

  const isFavorite = (id: string) => favorites.includes(id);

  const renderArticle = (article: NewsArticleItem & { publishedAt: Date }) => (
    <TouchableOpacity
      key={article.id}
      style={styles.articleCard}
      activeOpacity={0.9}
      onPress={() => {
        newsFeedApi.incrementView(article.id);
        analyticsService.logButtonClick('სტატიის ნახვა', 'NewsFeed', { articleId: article.id }, user?.id);
        router.push({ pathname: '/news-detail', params: { id: article.id } });
      }}
    >
      <View style={styles.articleImageContainer}>
        <Image
          source={{
            uri:
              article.image ||
              'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800',
          }}
          style={styles.articleImage}
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.7)']}
          style={styles.imageGradient}
        />
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>
            {article.category === 'technology' ? 'ტექნოლოგია' : 
             article.category === 'tips' ? 'რჩევები' : 
             article.category}
          </Text>
        </View>
        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation();
            toggleFavorite(article.id);
          }}
          style={styles.favoriteButton}
          activeOpacity={0.7}
        >
          <Ionicons
            name={isFavorite(article.id) ? 'heart' : 'heart-outline'}
            size={22}
            color={isFavorite(article.id) ? '#EF4444' : '#FFFFFF'}
          />
        </TouchableOpacity>
      </View>
      
      <View style={styles.articleContent}>
        <Text style={styles.articleTitle}>{article.title}</Text>
        <Text style={styles.articleSummary}>{article.summary}</Text>
        
        <View style={styles.articleFooter}>
          <View style={styles.articleMeta}>
            <Ionicons name="eye-outline" size={14} color="#6B7280" />
            <Text style={styles.metaText}>{article.views}</Text>
            <Text style={[styles.metaText, { marginLeft: 12 }]}>
              {formatTimeAgo(article.publishedAt)}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent />
      
      <View style={styles.topBar}>
        <SafeAreaView edges={['top']}>
          <View style={styles.topBarContent}>
            <TouchableOpacity style={styles.topBarButton} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.topBarTitle}>სიახლეები</Text>
            <View style={styles.topBarRight} />
          </View>
        </SafeAreaView>
      </View>

      {loading && articles.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#111827" />
          <Text style={styles.loadingText}>იტვირთება...</Text>
        </View>
      ) : articles.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="newspaper-outline" size={64} color="#9CA3AF" />
          <Text style={styles.emptyText}>სტატიები ჯერ არ არის</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#111827" />
          }
          showsVerticalScrollIndicator={false}
        >
          {articles.map(renderArticle)}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topBar: {
    backgroundColor: '#FFFFFF',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  topBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  topBarTitle: {
    fontSize: 18,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    textAlign: 'center',
  },
  topBarButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarRight: { width: 40 },
  scrollView: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 100,
  },
  articleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  articleImageContainer: {
    width: '100%',
    height: 200,
    position: 'relative',
  },
  articleImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imageGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
  },
  categoryBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: '#111827',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  categoryText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  favoriteButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  articleContent: {
    padding: 16,
  },
  articleTitle: {
    fontSize: 18,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    lineHeight: 24,
  },
  articleSummary: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 12,
  },
  articleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  articleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: '#6B7280',
    fontWeight: '500',
    marginLeft: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: '#6B7280',
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: '#9CA3AF',
    fontWeight: '500',
    marginTop: 16,
  },
});
