import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import Colors from '../constants/Colors';
import { useColorScheme } from '../components/useColorScheme';
import { useUser } from '../contexts/UserContext';
import { useToast } from '../contexts/ToastContext';
import API_BASE_URL from '../config/api';
import { hasCookieConsent } from '../components/ui/CookiePolicyModal';

// Constants
const MAX_NAME_LENGTH = 30;
const REGISTER_STEPS = {
  NAME: 1,
  ROLE: 2,
} as const;

// Types
type UserRole = 'user' | 'partner';
type RegisterStep = typeof REGISTER_STEPS.NAME | typeof REGISTER_STEPS.ROLE;

interface ApiError {
  message?: string;
}

interface AuthVerifyResponse {
  user?: {
    id: string;
    phone: string;
    firstName?: string;
    email?: string;
    role: string;
    ownedCarwashes: string[];
  };
}

export default function RegisterScreen() {
  const params = useLocalSearchParams<{ userId?: string }>();
  const userId = params.userId;

  // State
  const [loading, setLoading] = useState(false);
  const [registerStep, setRegisterStep] = useState<RegisterStep>(REGISTER_STEPS.NAME);
  const [firstName, setFirstName] = useState('');
  const [personalId, setPersonalId] = useState('');
  const [role, setRole] = useState<UserRole | null>(null);

  // Refs
  const nameInputRef = useRef<TextInput>(null);
  const personalIdInputRef = useRef<TextInput>(null);

  // Hooks
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { login } = useUser();
  const { success, error } = useToast();

  // Memoized values
  const canProceedToNextStep = useMemo(
    () => 
      firstName.trim().length > 0 && 
      firstName.trim().length <= MAX_NAME_LENGTH &&
      personalId.trim().length === 11, // Georgian personal ID is 11 digits
    [firstName, personalId]
  );

  useEffect(() => {
    if (!userId) {
      router.back();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (registerStep === REGISTER_STEPS.NAME && nameInputRef.current) {
      const timer = setTimeout(() => {
        nameInputRef.current?.focus();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [registerStep]);

  const handleCompleteRegistration = useCallback(async () => {
    const hasConsent = await hasCookieConsent();
    if (!hasConsent) {
      error('შეცდომა', 'გთხოვთ დაეთანხმოთ ქუქი-ფაილების პოლიტიკას რეგისტრაციის გასაგრძელებლად');
      return;
    }

    if (!userId) {
      error('შეცდომა', 'დაბრუნდით თავიდან');
      router.back();
      return;
    }

    if (!firstName.trim() || !personalId.trim() || !role) {
      error('შეცდომა', 'შეიყვანეთ სახელი, პირადი ნომერი და აირჩიეთ როლი');
      return;
    }

    if (personalId.trim().length !== 11) {
      error('შეცდომა', 'პირადი ნომერი უნდა შედგებოდეს 11 ციფრისგან');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/auth/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          firstName: firstName.trim(),
          personalId: personalId.trim(),
          role,
        }),
      });

      const data: AuthVerifyResponse = await res.json();

      if (!res.ok) {
        const message = (data as ApiError)?.message || 'შენახვა ვერ მოხერხდა';
        error('შეცდომა', message);
        return;
      }

      if (data.user) {
        await login(data.user);
      }

      success('წარმატება!', 'ანგარიში წარმატებით შეიქმნა');
      router.replace('/(tabs)');
    } catch (err) {
      error('შეცდომა', 'ქსელური შეცდომა');
    } finally {
      setLoading(false);
    }
  }, [userId, firstName, personalId, role, error, success, login]);

  const styles = StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      padding: 20,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 24,
      paddingTop: Platform.OS === 'ios' ? 10 : 20,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: '#F3F4F6',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: '#E5E7EB',
    },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#EEF2FF',
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 6,
      gap: 6,
      borderWidth: 1,
      borderColor: '#E0E7FF',
    },
    badgeText: {
      fontSize: 12,
      fontFamily: 'Outfit_700Bold',
      color: '#4F46E5',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    stepIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    stepDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#E5E7EB',
    },
    stepDotActive: {
      backgroundColor: '#4F46E5',
    },
    stepLine: {
      width: 24,
      height: 2,
      backgroundColor: '#E5E7EB',
    },
    stepLineActive: {
      backgroundColor: '#4F46E5',
    },
    title: {
      fontSize: 28,
      fontFamily: 'Outfit_700Bold',
      color: '#111827',
      letterSpacing: -0.5,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      color: '#4B5563',
      lineHeight: 24,
      fontFamily: 'Outfit',
      marginBottom: 24,
    },
    sectionCard: {
      backgroundColor: '#F8FAFC',
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: '#E5E7EB',
      marginTop: 6,
      gap: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.05,
      shadowRadius: 12,
      elevation: 4,
    },
    label: {
      fontSize: 12,
      fontFamily: 'Outfit_700Bold',
      color: '#111827',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: '#E5E7EB',
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 10,
      minHeight: 54,
    },
    inputWrapperFocused: {
      borderColor: '#4F46E5',
      shadowColor: '#4F46E5',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.12,
      shadowRadius: 12,
      elevation: 6,
      backgroundColor: '#F9FAFF',
    },
    input: {
      flex: 1,
      fontSize: 16,
      color: '#111827',
      fontFamily: 'Outfit_600SemiBold',
      paddingVertical: 0,
    },
    helper: {
      fontSize: 12,
      color: '#9CA3AF',
      fontFamily: 'Outfit',
    },
    roleChipsRow: {
      gap: 12,
    },
    roleChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#FFFFFF',
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: '#E5E7EB',
      gap: 12,
      marginTop: 8,
      minHeight: 72,
    },
    roleChipActive: {
      backgroundColor: '#EEF2FF',
      borderColor: '#4F46E5',
      shadowColor: '#4F46E5',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 16,
      elevation: 8,
    },
    roleChipIcon: {
      width: 42,
      height: 42,
      borderRadius: 12,
      backgroundColor: '#F3F4F6',
      alignItems: 'center',
      justifyContent: 'center',
    },
    roleChipIconActive: {
      backgroundColor: '#4F46E5',
    },
    roleChipTextWrap: {
      flex: 1,
      gap: 2,
    },
    roleChipTitle: {
      fontSize: 15,
      fontFamily: 'Outfit_700Bold',
      color: '#111827',
      letterSpacing: -0.2,
    },
    roleChipSubtitle: {
      fontSize: 12,
      fontFamily: 'Outfit',
      color: '#6B7280',
      lineHeight: 16,
    },
    footer: {
      marginTop: 24,
      gap: 12,
    },
    hintRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: '#ECFDF3',
      borderColor: '#BBF7D0',
      borderWidth: 1,
      borderRadius: 12,
      padding: 10,
    },
    hintText: {
      fontSize: 13,
      fontFamily: 'Outfit',
      color: '#065F46',
      flex: 1,
    },
    footerButtons: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 16,
    },
    backButtonFooter: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      paddingHorizontal: 20,
      backgroundColor: '#F3F4F6',
      borderRadius: 12,
    },
    backText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#6B7280',
    },
    primaryButton: {
      backgroundColor: '#111827',
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.2,
      shadowRadius: 12,
      elevation: 6,
    },
    primaryButtonDisabled: {
      backgroundColor: '#E5E7EB',
      shadowOpacity: 0,
      elevation: 0,
    },
    primaryText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontFamily: 'Outfit_700Bold',
    },
    primaryTextDisabled: {
      color: '#9CA3AF',
      letterSpacing: 0.3,
    },
    loadingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    loadingText: {
      marginLeft: 8,
    },
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        enabled
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="interactive"
        >
          {/* Header */}
            <View style={styles.header}>
            <View style={styles.headerLeft}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={styles.backButton}
                hitSlop={{ top: 10, left: 10, right: 10, bottom: 10 }}
              >
                <Ionicons name="arrow-back" size={20} color="#111827" />
              </TouchableOpacity>
              <View style={styles.badge}>
                <Ionicons name="sparkles-outline" size={18} color="#4F46E5" />
                <Text style={styles.badgeText}>ახალი პროფილი</Text>
              </View>
              <View style={styles.stepIndicator}>
                <View style={[styles.stepDot, registerStep >= REGISTER_STEPS.NAME && styles.stepDotActive]} />
                <View style={[styles.stepLine, registerStep >= REGISTER_STEPS.ROLE && styles.stepLineActive]} />
                <View style={[styles.stepDot, registerStep >= REGISTER_STEPS.ROLE && styles.stepDotActive]} />
              </View>
            </View>
          </View>

          {/* Step 1: Name */}
          {registerStep === REGISTER_STEPS.NAME && (
            <>
              <Text style={styles.title}>რა გქვია?</Text>
              <Text style={styles.subtitle}>
                შეიყვანე შენი სახელი და გვარი
              </Text>

              <View style={styles.sectionCard}>
                <Text style={styles.label}>სახელი და გვარი</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons
                    name="person-circle-outline"
                    size={22}
                    color="#9CA3AF"
                  />
                  <TextInput
                    ref={nameInputRef}
                    style={styles.input}
                    value={firstName}
                    onChangeText={setFirstName}
                    placeholder="მაგ: გიორგი გიორგიძე"
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="words"
                    autoCorrect={false}
                    autoFocus
                    editable
                    keyboardType="default"
                    returnKeyType="next"
                    onSubmitEditing={() => {
                      personalIdInputRef.current?.focus();
                    }}
                  />
                  <Text style={styles.helper}>{Math.min(firstName.trim().length, MAX_NAME_LENGTH)}/{MAX_NAME_LENGTH}</Text>
                </View>
              </View>

              <View style={styles.sectionCard}>
                <Text style={styles.label}>პირადი ნომერი *</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons
                    name="card-outline"
                    size={22}
                    color="#9CA3AF"
                  />
                  <TextInput
                    ref={personalIdInputRef}
                    style={styles.input}
                    value={personalId}
                    onChangeText={(text) => {
                      // Allow only digits and limit to 11 characters
                      const cleaned = text.replace(/\D/g, '').slice(0, 11);
                      setPersonalId(cleaned);
                    }}
                    placeholder="00000000000"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="number-pad"
                    returnKeyType="done"
                    maxLength={11}
                    onSubmitEditing={() => {
                      if (canProceedToNextStep) {
                        Keyboard.dismiss();
                        setTimeout(() => setRegisterStep(REGISTER_STEPS.ROLE), 100);
                      }
                    }}
                  />
                  <Text style={styles.helper}>{personalId.length}/11</Text>
                </View>
              </View>

              <View style={styles.footer}>
                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    (!canProceedToNextStep || loading) && styles.primaryButtonDisabled
                  ]}
                  onPress={() => {
                    if (canProceedToNextStep) {
                      setRegisterStep(REGISTER_STEPS.ROLE);
                    }
                  }}
                  disabled={!canProceedToNextStep || loading}
                >
                  <Text style={[
                    styles.primaryText,
                    (!canProceedToNextStep || loading) && styles.primaryTextDisabled
                  ]}>
                    შემდეგი
                  </Text>
                  <Ionicons 
                    name="arrow-forward" 
                    size={20} 
                    color={(!canProceedToNextStep || loading) ? '#9CA3AF' : '#FFFFFF'} 
                  />
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* Step 2: Role */}
          {registerStep === REGISTER_STEPS.ROLE && (
            <>
              <Text style={styles.title}>აირჩიე როლი</Text>
              <Text style={styles.subtitle}>
                როგორ გსურთ გამოიყენოთ MARTE?
              </Text>

              <View style={styles.sectionCard}>
                <View style={styles.roleChipsRow}>
                  <TouchableOpacity
                    onPress={() => setRole('user')}
                    activeOpacity={0.85}
                    style={[
                      styles.roleChip,
                      role === 'user' && styles.roleChipActive
                    ]}
                  >
                    <View style={[
                      styles.roleChipIcon,
                      role === 'user' && styles.roleChipIconActive
                    ]}>
                      <Ionicons
                        name="person"
                        size={20}
                        color={role === 'user' ? '#FFFFFF' : '#111827'}
                      />
                    </View>
                    <View style={styles.roleChipTextWrap}>
                      <Text style={styles.roleChipTitle}>
                        მომხმარებელი
                      </Text>
                      <Text style={styles.roleChipSubtitle}>შეკვეთები და დაჯავშნები</Text>
                    </View>
                    {role === 'user' && (
                      <Ionicons name="checkmark-circle" size={20} color="#4F46E5" />
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setRole('partner')}
                    activeOpacity={0.85}
                    style={[
                      styles.roleChip,
                      role === 'partner' && styles.roleChipActive
                    ]}
                  >
                    <View style={[
                      styles.roleChipIcon,
                      role === 'partner' && styles.roleChipIconActive
                    ]}>
                      <Ionicons
                        name="business"
                        size={20}
                        color={role === 'partner' ? '#FFFFFF' : '#111827'}
                      />
                    </View>
                    <View style={styles.roleChipTextWrap}>
                      <Text style={styles.roleChipTitle}>
                        პარტნიორი
                      </Text>
                      <Text style={styles.roleChipSubtitle}>ანგარიშები, სერვისები, გაყიდვები</Text>
                    </View>
                    {role === 'partner' && (
                      <Ionicons name="checkmark-circle" size={20} color="#4F46E5" />
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.footer}>
                <View style={styles.hintRow}>
                  <Ionicons name="shield-checkmark-outline" size={18} color="#10B981" />
                  <Text style={styles.hintText}>შესვლის შემდეგ შეგიძლია პროფილის ცვლილება.</Text>
                </View>

                <View style={styles.footerButtons}>
                  <TouchableOpacity
                    style={styles.backButtonFooter}
                    onPress={() => {
                      setRegisterStep(REGISTER_STEPS.NAME);
                    }}
                  >
                    <Ionicons name="arrow-back" size={20} color="#6B7280" />
                    <Text style={styles.backText}>უკან</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.primaryButton,
                      (loading || !role) && styles.primaryButtonDisabled
                    ]}
                    onPress={handleCompleteRegistration}
                    disabled={loading || !role}
                  >
                    {loading ? (
                      <View style={styles.loadingContainer}>
                        <ActivityIndicator color="#FFFFFF" />
                        <Text style={[styles.primaryText, styles.loadingText]}>შენახვა...</Text>
                      </View>
                    ) : (
                      <>
                        <Text style={[
                          styles.primaryText,
                          (loading || !role) && styles.primaryTextDisabled
                        ]}>
                          დასრულება
                        </Text>
                        <Ionicons 
                          name="checkmark-circle" 
                          size={20} 
                          color={(loading || !role) ? '#9CA3AF' : '#FFFFFF'} 
                        />
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

