import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  StatusBar,
  ActivityIndicator,
  Share,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { newsFeedApi, NewsArticleItem } from '@/services/newsFeedApi';

const { width } = Dimensions.get('window');

export default function NewsDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const id = params.id as string;

  const [article, setArticle] = useState<NewsArticleItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    const load = async () => {
      setLoading(true);
      try {
        const data = await newsFeedApi.getArticle(id);
        setArticle(data);
        if (data) newsFeedApi.incrementView(id);
      } catch (e) {
        console.error('Error loading article:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const handleShare = async () => {
    if (!article) return;
    try {
      await Share.share({
        message: `${article.title}\n\n${article.summary}`,
        title: article.title,
      });
    } catch (e) {
      console.error('Share error:', e);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('ka-GE', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const categoryLabel = (cat?: string) => {
    if (!cat) return '';
    const map: Record<string, string> = {
      technology: 'ტექნოლოგია',
      tips: 'რჩევები',
      general: 'ზოგადი',
    };
    return map[cat] || cat;
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent />
        <View style={styles.topBar}>
          <SafeAreaView edges={['top']}>
            <View style={styles.topBarContent}>
              <TouchableOpacity style={styles.topBarButton} onPress={() => router.back()}>
                <Ionicons name="arrow-back" size={24} color="#111827" />
              </TouchableOpacity>
              <Text style={styles.topBarTitle}>სტატია</Text>
              <View style={styles.topBarRight} />
            </View>
          </SafeAreaView>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#111827" />
          <Text style={styles.loadingText}>იტვირთება...</Text>
        </View>
      </View>
    );
  }

  if (!article) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent />
        <View style={styles.topBar}>
          <SafeAreaView edges={['top']}>
            <View style={styles.topBarContent}>
              <TouchableOpacity style={styles.topBarButton} onPress={() => router.back()}>
                <Ionicons name="arrow-back" size={24} color="#111827" />
              </TouchableOpacity>
              <Text style={styles.topBarTitle}>სტატია</Text>
              <View style={styles.topBarRight} />
            </View>
          </SafeAreaView>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>სტატია ვერ მოიძებნა</Text>
        </View>
      </View>
    );
  }

  const imageUri = article.image || 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent />
      
      <View style={styles.topBar}>
        <SafeAreaView edges={['top']}>
          <View style={styles.topBarContent}>
            <TouchableOpacity style={styles.topBarButton} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.topBarTitle} numberOfLines={1}>{article.title}</Text>
            <TouchableOpacity style={styles.topBarButton} onPress={handleShare}>
              <Ionicons name="share-outline" size={24} color="#111827" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <Image source={{ uri: imageUri }} style={styles.heroImage} resizeMode="cover" />
        
        <View style={styles.content}>
          {article.category && (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{categoryLabel(article.category)}</Text>
            </View>
          )}
          
          <Text style={styles.title}>{article.title}</Text>
          
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="eye-outline" size={14} color="#6B7280" />
              <Text style={styles.metaText}>{article.views ?? 0}</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="heart-outline" size={14} color="#6B7280" />
              <Text style={styles.metaText}>{article.likes ?? 0}</Text>
            </View>
            {article.publishedAt && (
              <Text style={styles.dateText}>{formatDate(article.publishedAt)}</Text>
            )}
          </View>

          <Text style={styles.summary}>{article.summary}</Text>
          
          {article.body && article.body.trim() && (
            <Text style={styles.body}>{article.body}</Text>
          )}
        </View>
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
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
    fontSize: 16,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
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
  heroImage: {
    width,
    height: 240,
    backgroundColor: '#F3F4F6',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#111827',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 16,
  },
  categoryText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  title: {
    fontSize: 22,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
    lineHeight: 30,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 20,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: '#6B7280',
    fontWeight: '500',
  },
  dateText: {
    fontSize: 13,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: '#6B7280',
    fontWeight: '500',
  },
  summary: {
    fontSize: 16,
    fontFamily: 'HelveticaMedium',
    color: '#374151',
    lineHeight: 24,
    marginBottom: 20,
  },
  body: {
    fontSize: 15,
    fontFamily: 'HelveticaMedium',
    color: '#111827',
    lineHeight: 24,
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
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: '#9CA3AF',
    fontWeight: '500',
  },
});
