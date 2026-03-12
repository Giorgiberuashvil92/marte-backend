import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ColorSchemeName, useColorScheme as _useColorScheme } from 'react-native';

/** true = dark თემა დაბლოკირებულია, აპლიკაცია ყოველთვის light-ში */
const LIGHT_ONLY = true;

let globalSetColorScheme: React.Dispatch<React.SetStateAction<NonNullable<ColorSchemeName>>> | null = null;

export function useColorScheme(): NonNullable<ColorSchemeName> {
  const systemColorScheme = _useColorScheme();
  const [colorScheme, setColorScheme] = useState<NonNullable<ColorSchemeName>>(
    systemColorScheme || 'light'
  );
  globalSetColorScheme = setColorScheme;

  useEffect(() => {
    if (LIGHT_ONLY) return;
    AsyncStorage.getItem('theme').then((storedTheme) => {
      if (storedTheme === 'light' || storedTheme === 'dark') {
        setColorScheme(storedTheme);
      }
    });
  }, []);

  if (LIGHT_ONLY) return 'light';
  return colorScheme;
}

/** თემის შეცვლა (ამჟამად არაფერს აკეთებს – dark დაბლოკირებულია) */
export async function toggleColorScheme(): Promise<'light' | 'dark'> {
  if (LIGHT_ONLY) return 'light';
  const currentTheme = await AsyncStorage.getItem('theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  await AsyncStorage.setItem('theme', newTheme);
  if (globalSetColorScheme) {
    globalSetColorScheme(newTheme as NonNullable<ColorSchemeName>);
  }
  return newTheme as 'light' | 'dark';
}