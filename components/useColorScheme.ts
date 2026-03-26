/**
 * აპლიკაცია მუშაობს მხოლოდ light თემაზე — სისტემური dark / მომხმარებლის თემა არ გამოიყენება.
 *
 * დამატებით (ნეიტივი): `app/_layout.tsx`-ში იძახება `Appearance.setColorScheme('light')`.
 * Expo: `app.json` → `"userInterfaceStyle": "light"`.
 */
export function useColorScheme(): 'light' {
  return 'light';
}

/** თემის გადართვა გამორთულია — ყოველთვის light */
export async function toggleColorScheme(): Promise<'light'> {
  return 'light';
}
