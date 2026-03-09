import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUser } from '../contexts/UserContext';

export const options = { headerShown: false };

export default function PersonalInfoScreen() {
  const router = useRouter();
  const { user, updateProfile } = useUser();

  const [fullName, setFullName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFullName(user?.name ?? '');
    setEmail(user?.email ?? '');
    setPhone(user?.phone ?? '');
  }, [user?.id, user?.name, user?.email, user?.phone]);

  const emailInvalid = useMemo(() => {
    const trimmed = email.trim();
    if (!trimmed) return false;
    return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  }, [email]);

  const hasChanges = useMemo(() => {
    return (
      fullName.trim() !== (user?.name ?? '') ||
      email.trim() !== (user?.email ?? '') ||
      phone.trim() !== (user?.phone ?? '')
    );
  }, [email, fullName, phone, user?.email, user?.name, user?.phone]);

  const handleSave = async () => {
    if (!user) {
      Alert.alert(
        'საჭიროა ავტორიზაცია',
        'პირადი ინფორმაციის სანახავად ან შესანახად გაიარეთ ავტორიზაცია.',
        [
          { text: 'დახურვა', style: 'cancel' },
          { text: 'ავტორიზაცია', onPress: () => router.replace('/login') },
        ]
      );
      return;
    }

    if (!fullName.trim()) {
      Alert.alert('შეავსეთ სახელი', 'გთხოვთ შეიყვანოთ თქვენი სახელი.');
      return;
    }

    if (emailInvalid) {
      Alert.alert('ელ-ფოსტის ფორმატი', 'გთხოვთ შეამოწმოთ ელ-ფოსტა.');
      return;
    }

    setSaving(true);
    try {
      await updateProfile({
        name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
      });
      Alert.alert('განახლდა', 'პირადი ინფორმაცია შენახულია.');
    } catch (error) {
      Alert.alert('შეცდომა', 'ვერ შევინახეთ მონაცემები, სცადეთ თავიდან.');
    } finally {
      setSaving(false);
    }
  };

  const renderReadonlyField = (
    icon: string,
    label: string,
    value?: string,
    fallback?: string
  ) => (
    <View style={styles.infoItem}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon as any} size={18} color="#111827" />
      </View>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value || fallback || '—'}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent />

      <View style={styles.topBar}>
        <SafeAreaView edges={['top']}>
          <View style={styles.topBarContent}>
            <TouchableOpacity
              style={styles.topBarButton}
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={22} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.topBarTitle}>პირადი ინფორმაცია</Text>
            <View style={styles.topBarRight} />
          </View>
        </SafeAreaView>
      </View>

      {!user ? (
        <View style={styles.emptyState}>
          <Ionicons name="person-circle-outline" size={52} color="#6B7280" />
          <Text style={styles.emptyTitle}>არ ხართ ავტორიზებული</Text>
          <Text style={styles.emptySubtitle}>
            ავტორიზაციის შემდეგ შეძლებთ პირადი მონაცემების ნახვას და განახლებას.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.replace('/login')}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>შესვლა</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.keyboardWrap}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={72}
        >
          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 40 }}
          >
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.cardTitle}>{fullName || 'მომხმარებელი'}</Text>
                  <Text style={styles.cardSubtitle}>{email || 'ელ-ფოსტა არ არის მითითებული'}</Text>
                </View>
                {user.role ? (
                  <View style={styles.rolePill}>
                    <Ionicons name="shield-checkmark" size={16} color="#111827" />
                    <Text style={styles.roleText}>
                      {user.role}
                    </Text>
                  </View>
                ) : null}
              </View>
              {renderReadonlyField('id-card-outline', 'მომხმარებლის ID', user.id)}
              {renderReadonlyField('time-outline', 'ანგარიში შექმნილია', '—', '—')}
            </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>განახლება</Text>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>სრული სახელი</Text>
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                placeholder="მაგ: გიორგი მაისურაძე"
                placeholderTextColor="#9CA3AF"
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>ელ-ფოსტა</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="user@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor="#9CA3AF"
                style={[styles.input, emailInvalid && styles.inputError]}
              />
              {emailInvalid && (
                <Text style={styles.helperText}>
                  ელ-ფოსტის ფორმატი არასწორია
                </Text>
              )}
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>ტელეფონი</Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="+995 5XX XXX XXX"
                keyboardType="phone-pad"
                placeholderTextColor="#9CA3AF"
                style={styles.input}
              />
            </View>

            <TouchableOpacity
              style={[
                styles.primaryButton,
                (saving || !hasChanges) && styles.primaryButtonDisabled,
              ]}
              onPress={handleSave}
              disabled={saving || !hasChanges}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryButtonText}>
                {saving ? 'შენახვა...' : 'მონაცემების შენახვა'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => {
                setFullName(user?.name ?? '');
                setEmail(user?.email ?? '');
                setPhone(user?.phone ?? '');
              }}
              activeOpacity={0.8}
              disabled={!hasChanges || saving}
            >
              <Text
                style={[
                  styles.secondaryButtonText,
                  (!hasChanges || saving) && styles.secondaryButtonTextDisabled,
                ]}
              >
                ცვლილებების გაუქმება
              </Text>
            </TouchableOpacity>
          </View>
          </ScrollView>
        </KeyboardAvoidingView>
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
    paddingHorizontal: 20,
    paddingTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topBarButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
  topBarRight: { width: 40, height: 40 },
  keyboardWrap: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 18,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: '#111827',
  },
  cardSubtitle: {
    fontSize: 13,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '500',
    color: '#6B7280',
    marginTop: 2,
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  roleText: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#111827',
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  field: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: 'HelveticaMedium',
    color: '#111827',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  helperText: {
    marginTop: 6,
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#EF4444',
  },
  primaryButton: {
    backgroundColor: '#111827',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  secondaryButton: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#111827',
  },
  secondaryButtonTextDisabled: {
    color: '#9CA3AF',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  infoIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#6B7280',
  },
  infoValue: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#111827',
    marginTop: 2,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#111827',
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '500',
    color: '#6B7280',
    textAlign: 'center',
  },
});
