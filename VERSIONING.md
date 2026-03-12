# Marte – ვერსიების მართვა და Force Update

## სად იცვლება ვერსია

### 1. `app.json` (Expo)

| ველი | როლი | მაგალითი |
|------|------|----------|
| **`version`** | ვერსია ორივე პლატფორმაზე (მომხმარებლის ვერსია) | `"1.0.22"` → შემდეგი რელიზი: `"1.0.23"` |
| **`ios.buildNumber`** | iOS-ზე ყოველი ახალი აწყობის უნიკალური ნომერი (App Store) | `"22"` → შემდეგი build: `"23"` |
| **`android.versionCode`** | Android-ზე მთელი რიცხვი, ყოველ აწყობაზე უნდა გაიზარდოს (Play Store) | `16` → შემდეგი: `17` |

**რელიზისას ყოველთვის:**
- გაზარდე `version` (მაგ. 1.0.22 → 1.0.23).
- iOS: გაზარდე `ios.buildNumber` (მაგ. "22" → "23").
- Android: გაზარდე `android.versionCode` (მაგ. 16 → 17).

---

## ძველი ვერსიის აფდეითზე „აძლევა“ (Force Update)

1. **ბექენდი** – `marte-backend/src/app.service.ts`:
   - **`currentVersion`** – დააყენე იგივე, რაც `app.json`-ის `version` (ახალი რელიზის ვერსია).
   - **`minVersion`** – ის ვერსია, **ვისაც ქვემოთ** ყველას ვაჩვენებთ Force Update-ს.
     - მაგ: თუ ახალი ვერსიაა `1.0.23`, დააყენე `minVersion: '1.0.23'` → 1.0.22 და უფრო ძველი დაააფდეითებს.
     - ან `minVersion: '1.0.22'` → 1.0.21 და ქვემოთ დაააფდეითებს, 1.0.22+ უკვე „OK“.

2. **აპი** – ყოველი ჩატვირთვისას იძახებს `GET /app/version-check`, ადარებს `Constants.expoConfig.version`-ს `minVersion`-ს. თუ მიმდინარე ვერსია ნაკლებია, იხსნება **ForceUpdateModal** (App Store / Play Store-ის ლინკი).

3. **როდის შეცვალო ბექენდი:** როცა ახალი ვერსია (მაგ. 1.0.23) უკვე გამოვიდა App Store-ში და Play Store-ში და გინდა, რომ ძველი ვერსიები აიძულო აფდეითზე – ბექენდზე განაახლე `currentVersion` და `minVersion` (იხ. ზემოთ).

---

## მოკლე ჩეკლისტი რელიზისთვის

1. `app.json`: გაზარდე `version`, `ios.buildNumber`, `android.versionCode`.
2. ააწყობი და ატვირთე App Store / Play Store.
3. როცა ახალი ვერსია ორივე სტორში ჩანს – `marte-backend` → `app.service.ts`: განაახლე `currentVersion` და `minVersion` (საჭიროებისამებრ).
