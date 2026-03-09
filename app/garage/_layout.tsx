import React from 'react';
import { Stack } from 'expo-router';

export default function GarageLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="service" options={{ headerShown: false }} />
      <Stack.Screen name="reminders" options={{ headerShown: false }} />
      <Stack.Screen name="documents" options={{ headerShown: false }} />
      <Stack.Screen name="fuel" options={{ headerShown: false }} />
      <Stack.Screen name="statistics" options={{ headerShown: false }} />
    </Stack>
  );
}
