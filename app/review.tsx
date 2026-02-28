import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  Linking,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { useUser } from '../contexts/UserContext';
import { useToast } from '../contexts/ToastContext';

export default function ReviewScreen() {
  const router = useRouter();
  const { user } = useUser();
  const { success, error } = useToast();
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [scaleAnim] = useState(new Animated.Value(1));

  const handleStarPress = (starIndex: number) => {
    setRating(starIndex);
    // Animate star press
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.2,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      error('შეცდომა', 'გთხოვთ აირჩიოთ რეიტინგი');
      return;
    }

    try {
      setSubmitted(true);
      
      // Open App Store / Play Store
      const appStoreUrl = Platform.select({
        ios: 'https://apps.apple.com/app/id6753679575', // Marte App Store ID
        android: 'https://play.google.com/store/apps/details?id=com.marte.marte',
      });

      if (appStoreUrl) {
        const canOpen = await Linking.canOpenURL(appStoreUrl);
        if (canOpen) {
          await Linking.openURL(appStoreUrl);
          success('მადლობა!', 'თქვენი შეფასება ძალიან მნიშვნელოვანია ჩვენთვის!');
          
          // Optional: Send review data to backend
          // You can add API call here to track reviews
          
          // Navigate back after a delay
          setTimeout(() => {
            router.back();
          }, 2000);
        } else {
          error('შეცდომა', 'App Store-ის გახსნა ვერ მოხერხდა');
          setSubmitted(false);
        }
      } else {
        error('შეცდომა', 'პლატფორმა არ არის მხარდაჭერილი');
        setSubmitted(false);
      }
    } catch (err: any) {
      console.error('Error opening app store:', err);
      error('შეცდომა', 'App Store-ის გახსნა ვერ მოხერხდა');
      setSubmitted(false);
    }
  };

  const renderStars = () => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((starIndex) => (
          <TouchableOpacity
            key={starIndex}
            onPress={() => handleStarPress(starIndex)}
            activeOpacity={0.7}
            disabled={submitted}
          >
            <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
              <Ionicons
                name={starIndex <= rating ? 'star' : 'star-outline'}
                size={48}
                color={starIndex <= rating ? '#F59E0B' : '#D1D5DB'}
                style={styles.star}
              />
            </Animated.View>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container}>
        <LinearGradient
          colors={['#1F2937', '#111827']}
          style={styles.gradient}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={24} color="#F8FAFC" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>შეფასება</Text>
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
          >
            {/* Main Content */}
            <View style={styles.mainContent}>
              {/* Icon */}
              <View style={styles.iconContainer}>
                <LinearGradient
                  colors={['#8B5CF6', '#6366F1']}
                  style={styles.iconGradient}
                >
                  <Ionicons name="star" size={64} color="#FFFFFF" />
                </LinearGradient>
              </View>

              {/* Title */}
              <Text style={styles.title}>როგორ მოგწონს Marte?</Text>
              <Text style={styles.subtitle}>
                თქვენი შეფასება დაგვეხმარება გავაუმჯობესოთ აპლიკაცია
              </Text>

              {/* Stars Rating */}
              <View style={styles.ratingSection}>
                {renderStars()}
                {rating > 0 && (
                  <Text style={styles.ratingText}>
                    {rating === 5 && 'შესანიშნავი! ⭐'}
                    {rating === 4 && 'კარგი! 👍'}
                    {rating === 3 && 'საშუალო'}
                    {rating === 2 && 'უკმაყოფილო'}
                    {rating === 1 && 'ცუდი'}
                  </Text>
                )}
              </View>

              {/* Review Text Input */}
              <View style={styles.textInputContainer}>
                <Text style={styles.textInputLabel}>თქვენი მოსაზრება (არასავალდებულო)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="დაწერეთ თქვენი მოსაზრება..."
                  placeholderTextColor="#6B7280"
                  value={reviewText}
                  onChangeText={setReviewText}
                  multiline
                  numberOfLines={4}
                  editable={!submitted}
                  textAlignVertical="top"
                />
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={submitted || rating === 0}
                style={[
                  styles.submitButton,
                  (submitted || rating === 0) && styles.submitButtonDisabled,
                ]}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={
                    submitted || rating === 0
                      ? ['#4B5563', '#374151']
                      : ['#8B5CF6', '#6366F1']
                  }
                  style={styles.submitButtonGradient}
                >
                  {submitted ? (
                    <View style={styles.submitButtonContent}>
                      <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                      <Text style={styles.submitButtonText}>გაგზავნილია</Text>
                    </View>
                  ) : (
                    <View style={styles.submitButtonContent}>
                      <Ionicons name="star" size={20} color="#FFFFFF" />
                      <Text style={styles.submitButtonText}>შეფასება</Text>
                    </View>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {/* Info */}
              <View style={styles.infoCard}>
                <Ionicons name="information-circle-outline" size={20} color="#9CA3AF" />
                <Text style={styles.infoText}>
                  App Store-ზე გადასვლის შემდეგ შეგიძლიათ დატოვოთ შეფასება და მიმოხილვა
                </Text>
              </View>
            </View>
          </ScrollView>
        </LinearGradient>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  gradient: {
    flex: 1,
  },
  header: {
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
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F8FAFC',
    fontFamily: 'Outfit',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  mainContent: {
    alignItems: 'center',
  },
  iconContainer: {
    marginTop: 20,
    marginBottom: 24,
  },
  iconGradient: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#F8FAFC',
    textAlign: 'center',
    marginBottom: 12,
    fontFamily: 'Outfit',
  },
  subtitle: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 40,
    paddingHorizontal: 20,
    lineHeight: 24,
    fontFamily: 'Outfit',
  },
  ratingSection: {
    alignItems: 'center',
    marginBottom: 40,
    width: '100%',
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  star: {
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  ratingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#F59E0B',
    fontFamily: 'Outfit',
  },
  textInputContainer: {
    width: '100%',
    marginBottom: 32,
  },
  textInputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E5E7EB',
    marginBottom: 12,
    fontFamily: 'Outfit',
  },
  textInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 16,
    color: '#F8FAFC',
    fontSize: 16,
    fontFamily: 'Outfit',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    minHeight: 120,
  },
  submitButton: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonGradient: {
    paddingVertical: 18,
    paddingHorizontal: 24,
  },
  submitButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Outfit',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.1)',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#9CA3AF',
    lineHeight: 18,
    fontFamily: 'Outfit',
  },
});
