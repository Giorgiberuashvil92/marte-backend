import React from 'react';
import { View, FlatList, TouchableOpacity, Image, Text, StyleSheet, FontVariant } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

type Props = {
  stories: Array<{ id: string; author: { avatar?: string; name: string }; internalImage?: string; seen?: boolean }>;
  onOpen: (index: number) => void;
  onCreate?: () => void;
  title?: string;
};

export default function StoriesRow({ stories, onOpen, onCreate, title = 'სთორების კატალოგი' }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{title}</Text>
        {onCreate ? (
          <TouchableOpacity onPress={onCreate} activeOpacity={0.8}>
            <View style={styles.addBtn}><Text style={styles.addText}>+</Text></View>
          </TouchableOpacity>
        ) : null}
      </View>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 4, gap: 12 }}
        data={stories}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity 
            onPress={() => onOpen(stories.findIndex((s) => s.id === item.id))} 
            activeOpacity={0.85}
            style={styles.storyContainer}
          >
            <View style={[
              styles.storyBubble,
              item.seen ? styles.storyBubbleSeen : styles.storyBubbleNew
            ]}>
              <Image 
                source={{ uri: item.internalImage || item.author.avatar || 'https://i.pravatar.cc/100' }} 
                style={styles.storyAvatar} 
              />
            </View>
            <Text numberOfLines={1} style={styles.storyName}>{item.author.name}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 4, paddingBottom: 8, paddingTop: 4 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  title: {  fontSize: 16 , fontFamily: 'HelveticaMedium', fontWeight: '700', textTransform: 'uppercase'   },
  addBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center' },
  addText: { color: '#fff', fontSize: 18, marginTop: -2 },
  
  // მარტივი სტილები
  storyContainer: {
    alignItems: 'center',
  },
  
  storyBubble: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  
  storyBubbleNew: {
    borderWidth: 2,
    borderColor: '#3B82F6', // ლურჯი ბორდერი ახალი stories-ისთვის
  },
  
  storyBubbleSeen: {
    borderWidth: 2,
    borderColor: '#9CA3AF', // ნაცარი ბორდერი ნანახი stories-ისთვის
  },
  
  storyAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  
  storyName: {
    color: '#374151',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 8,
    width: 64,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
  },
});


