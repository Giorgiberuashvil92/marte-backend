import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack } from 'expo-router';

const FAQ: { question: string; answer: string; keywords: string[] }[] = [
 
  {
    question: 'როგორ ვიყიდო / ვიხილო Carfax (მანქანის ისტორია)?',
    keywords: ['carfax', 'კარფაქსი', 'კარფაქს', 'ისტორია', 'მანქანის ისტორია', 'ვინახო'],
    answer:
      'Carfax-ის სანახავად ან შესაძენად: აპში გახსენი „მთავარი“ ტაბი და აირჩიე „Carfax“ / „მანქანის ისტორია“, ან გადადი გარაჟში → მანქანა → Carfax. იქ შეგიძლია VIN ან ნომრის მიწერით იხილო ან იყიდო რეპორტი.',
  },
  {
    question: 'როგორ ვიხილო და ვიყიდო ჯარიმა?',
    keywords: ['ჯარიმა', 'ჯარიმები', 'ვიყიდო', 'გადახდა', 'საჯარიმო'],
    answer:
      'ჯარიმების სანახავად და გადასახდელად: გახსენი „გარაჟი“ (მანქანა) → „ჯარიმები“. პრემიუმ გამოწერის შემდეგ შეგიძლია დაარეგისტრირო მანქანა ნომერით და ტექპასპორტით – ჯარიმების სია და გადახდის ბმულები იქ გამოჩნდება.',
  },
  {
    question: 'როგორ დავარეგისტრირო მანქანა ჯარიმებისთვის?',
    keywords: ['რეგისტრაცია', 'ჯარიმა', 'მანქანის რეგისტრაცია', 'დარეგისტრირება'],
    answer:
      'ჯარიმებისთვის მანქანის რეგისტრაცია: გახსენი „გარაჟი“ → „ჯარიმები“. საჭიროა პრემიუმ გამოწერა. იქ დაამატებ მანქანას საავტომობილო ნომრით და ტექპასპორტის ნომრით – შემდეგ ჯარიმების სია ავტომატურად განახლდება.',
  },
  {
    question: 'როგორ გავაკეთო ნაწილის მოთხოვნა?',
    keywords: ['ნაწილი', 'მოთხოვნა', 'ნაწილის მოთხოვნა', 'ავტონაწილი'],
    answer:
      'ნაწილის მოთხოვნისთვის: „მართვა“ ტაბზე დააჭირე „ნაწილის მოთხოვნა“ ან გადადი „ნაწილის მოთხოვნა“ სწრაფ ქმედებებში. შეავსებ მანქანის მონაცემებს და სასურველ ნაწილს – მაღაზიები და დისმანტლერები შეთავაზებებს გიგზავნით.',
  },
  {
    question: 'სად ვნახო ჩემი შეთავაზებები და მოთხოვნები?',
    keywords: ['შეთავაზება', 'მოთხოვნა', 'ჩემი', 'სად'],
    answer:
      'შეთავაზებები: „მართვა“ → „შეთავაზებები“. ჩემი მოთხოვნები: „მართვა“ → „ჩემი მოთხოვნები“. იქ იხილავ ყველა აქტიურ და დასრულებულ მოთხოვნას და მათზე მოწოდებულ შეთავაზებებს.',
  },
  {
    question: 'როგორ გავხდე პარტნიორი / დავამატო მაღაზია?',
    keywords: ['პარტნიორი', 'მაღაზია', 'დისმანტლერი', 'ბიზნესი'],
    answer:
      'პარტნიორად რეგისტრაციისთვის: „მართვა“ ტაბზე დააჭირე „გახდი პარტნიორი“ (ბანერი). იქ მოგაწვენი როგორ დაამატო მაღაზია ან დაშლილი – შემდეგ მიიღებ ნაწილის მოთხოვნებს და შეგიძლია შეთავაზებების გაგზავნა.',
  },
  {
    question: 'როგორ ვიხილო ჩატები და შეტყობინებები?',
    keywords: ['ჩატი', 'შეტყობინება', 'წერილი'],
    answer:
      'ჩატები: „მართვა“ → „ჩატები“ ან ჩატების ტაბი. შეტყობინებები: „შეტყობინებები“ იკონიდან მთავარ ეკრანზე ან „მართვა“ → „შეტყობინებები“. იქ ჩანს ყველა push და სისტემური შეტყობინება.',
  },
]; 

export default function HelpAssistantScreen() {
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return FAQ;
    const lower = search.toLowerCase().trim();
    return FAQ.filter(
      (item) =>
        item.question.toLowerCase().includes(lower) ||
        item.keywords.some((k) => k.toLowerCase().includes(lower) || lower.includes(k.toLowerCase()))
    );
  }, [search]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      <Stack.Screen
        options={{
          title: 'AI ასისტენტი',
          headerShown: true,
          headerBackTitle: 'უკან',
          headerTitleStyle: { fontFamily: 'HelveticaMedium', fontWeight: '700', fontSize: 18 },
        }}
      />
      <LinearGradient
        colors={['#F8FAFC', '#F1F5F9']}
        style={StyleSheet.absoluteFillObject}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={20} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="ჩაწერე კითხვა, მაგ: საბსქრიფშენის გაუქმება..."
            placeholderTextColor="#9CA3AF"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={12}>
              <Ionicons name="close-circle" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {filtered.length === 0 ? (
            <Text style={styles.empty}>შედეგი ვერ მოიძებნა. სცადე სხვა საკვანძო სიტყვა.</Text>
          ) : (
            filtered.map((item, index) => {
              const id = FAQ.indexOf(item);
              const isExpanded = expandedId === id;
              return (
                <TouchableOpacity
                  key={id}
                  style={styles.card}
                  activeOpacity={0.8}
                  onPress={() => setExpandedId(isExpanded ? null : id)}
                >
                  <View style={styles.cardHeader}>
                    <Text style={styles.question}>{item.question}</Text>
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color="#6B7280"
                    />
                  </View>
                  {isExpanded && (
                    <View style={styles.answerWrap}>
                      <Text style={styles.answer}>{item.answer}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  flex: { flex: 1 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'HelveticaMedium',
    color: '#111827',
    paddingVertical: 0,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 24 },
  empty: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 10,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    gap: 12,
  },
  question: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    fontWeight: '600',
    color: '#111827',
  },
  answerWrap: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 0,
  },
  answer: {
    fontSize: 13,
    fontFamily: 'HelveticaMedium',
    color: '#4B5563',
    lineHeight: 20,
  },
});
