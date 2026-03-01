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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useUser } from '@/contexts/UserContext';
import { analyticsService } from '@/services/analytics';
import API_BASE_URL from '@/config/api';

const { width } = Dimensions.get('window');

export default function NewsFeedScreen() {
  const { user } = useUser();
  const router = useRouter();
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadArticles();
  }, []);

  const loadArticles = async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      
      // TODO: Replace with actual News Feed API endpoint
      // const response = await fetch(`${API_BASE_URL}/news-feed`);
      // const data = await response.json();
      
      // Temporary mock data
      const mockArticles = [
        {
          id: '1',
          title: 'ახალი ელექტრო მანქანები 2024-ში',
          summary: 'გაიგე რა ახალი ელექტრო მანქანები გამოვიდა 2024 წელს',
          category: 'technology',
          image: 'https://images.unsplash.com/photo-1593941707882-a5bac6861d75?w=800',
          views: 1250,
          likes: 89,
          publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        },
        {
          id: '2',
          title: '5 რჩევა ზამთრის მოვლისთვის',
          summary: 'როგორ მოვამზადოთ მანქანა ზამთრისთვის',
          category: 'tips',
          image: 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800',
          views: 890,
          likes: 67,
          publishedAt: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
        },
        {
          id: '3',
          title: 'როგორ დავზოგოთ საწვავზე',
          summary: 'პრაქტიკული რჩევები საწვავის დაზოგვისთვის',
          category: 'tips',
          image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800',
          views: 2100,
          likes: 145,
          publishedAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        },
      ];
      
      setArticles(mockArticles);
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

  const renderArticle = (article: any) => (
    <TouchableOpacity
      key={article.id}
      style={styles.articleCard}
      activeOpacity={0.9}
      onPress={() => {
        // TODO: Navigate to article detail
        analyticsService.logButtonClick('სტატიის ნახვა', 'NewsFeed', { articleId: article.id }, user?.id);
      }}
    >
      <View style={styles.articleImageContainer}>
        <Image source={{ uri: article.image }} style={styles.articleImage} />
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
      </View>
      
      <View style={styles.articleContent}>
        <Text style={styles.articleTitle}>{article.title}</Text>
        <Text style={styles.articleSummary}>{article.summary}</Text>
        
        <View style={styles.articleFooter}>
          <View style={styles.articleMeta}>
            <Ionicons name="eye-outline" size={14} color="#6B7280" />
            <Text style={styles.metaText}>{article.views}</Text>
            <Ionicons name="heart-outline" size={14} color="#6B7280" style={{ marginLeft: 12 }} />
            <Text style={styles.metaText}>{article.likes}</Text>
            <Text style={[styles.metaText, { marginLeft: 12 }]}>
              {formatTimeAgo(article.publishedAt)}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header */}
      <LinearGradient
        colors={['#F8FAFC', '#FFFFFF']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>სიახლეები</Text>
            <View style={styles.titleUnderline} />
          </View>
          
          <View style={styles.headerRight} />
        </View>
      </LinearGradient>

      {/* Content */}
      {loading && articles.length === 0 ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>იტვირთება...</Text>
        </View>
      ) : articles.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="newspaper-outline" size={64} color="#D1D5DB" />
          <Text style={styles.emptyText}>სტატიები ჯერ არ არის</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
        >
          {articles.map(renderArticle)}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Outfit',
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  titleUnderline: {
    width: 40,
    height: 3,
    backgroundColor: '#3B82F6',
    borderRadius: 2,
    marginTop: 4,
  },
  headerRight: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  articleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F3F4F6',
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
    backgroundColor: 'rgba(59, 130, 246, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  categoryText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: 'Outfit',
    fontWeight: '600',
  },
  articleContent: {
    padding: 16,
  },
  articleTitle: {
    fontSize: 18,
    fontFamily: 'Outfit',
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    lineHeight: 24,
  },
  articleSummary: {
    fontSize: 14,
    fontFamily: 'Outfit',
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
    fontFamily: 'Outfit',
    color: '#6B7280',
    marginLeft: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'Outfit',
    color: '#6B7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'Outfit',
    color: '#6B7280',
    marginTop: 16,
  },
});
