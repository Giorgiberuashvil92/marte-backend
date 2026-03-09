import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Stack, useRouter } from 'expo-router';

/**
 * გლობალური გვერდი შეთავაზებების დასამატებლად / სამართავად.
 * მომხმარებელი მიმართულებს partner-dashboard-store-ზე (მაღაზიის პანელი სპეციალური შეთავაზებებით).
 */
export default function SpecialOffersManageScreen() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/partner-dashboard-store' as any);
  }, [router]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#111827" />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
});
