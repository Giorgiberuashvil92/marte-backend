# 📱 App Store Permissions & Requirements

## ✅ დამატებული Permissions

### iOS (App Store)

#### 1. **App Tracking Transparency (ATT)**
- ✅ **Status:** დამატებულია
- **File:** `app.json` → `ios.infoPlist.NSUserTrackingUsageDescription`
- **Description:** "აპს სჭირდება tracking permission გამოცდილების გასაუმჯობესებლად და პერსონალიზებული კონტენტის მისაწოდებლად."
- **Plugin:** `expo-tracking-transparency`
- **Implementation:** `app/_layout.tsx` → `requestTrackingPermission()`

#### 2. **Camera Permission**
- ✅ **Status:** დამატებულია
- **Description:** "აპს სჭირდება კამერაზე წვდომა პროფილის ფოტოს გადასაღებად და ასატვირთად."

#### 3. **Photo Library Permission**
- ✅ **Status:** დამატებულია
- **Description:** "აპს სჭირდება ფოტოების ბიბლიოთეკაზე წვდომა პროფილის ფოტოს ასატვირთად."

#### 4. **Location Permission**
- ✅ **Status:** დამატებულია
- **Plugin:** `expo-location`

### Android (Google Play Store)

#### 1. **Location Permissions**
- ✅ `ACCESS_COARSE_LOCATION`
- ✅ `ACCESS_FINE_LOCATION`

#### 2. **Media Permissions**
- ✅ `CAMERA` - კამერის გამოსაყენებლად
- ❌ `READ_EXTERNAL_STORAGE` - **მოხსნილია** (არ არის საჭირო Android 13+)
- ❌ `WRITE_EXTERNAL_STORAGE` - **მოხსნილია** (არ არის საჭირო Android 13+)
- ✅ **Photo Picker API** - `expo-image-picker` ავტომატურად იყენებს Photo Picker API-ს Android 13+ (API 33+), რომელიც არ საჭიროებს persistent permissions-ს

#### 3. **Audio Permission**
- ✅ `RECORD_AUDIO`

#### 4. **Firebase Analytics**
- ✅ **No special permission needed** - Firebase Analytics uses INTERNET permission (default)

---

## 📋 App Store Requirements

### iOS App Store Connect

#### 1. **Privacy Policy** (სავალდებულო)
- ✅ **Required:** დიახ
- **Where:** App Store Connect → App Privacy → Privacy Policy URL
- **Example:** `https://yourdomain.com/privacy-policy`

#### 2. **Data Collection Disclosure** (სავალდებულო)
- ✅ **Required:** დიახ
- **Where:** App Store Connect → App Privacy → Data Types
- **Required disclosures:**
  - ✅ **Analytics Data** (Firebase Analytics)
  - ✅ **Location Data** (if collected)
  - ✅ **User Content** (photos, profile data)
  - ✅ **Device ID** (for analytics)
  - ✅ **Usage Data** (app interactions)

#### 3. **App Tracking Transparency**
- ✅ **Status:** დამატებულია
- **Required for:** iOS 14.5+
- **Implementation:** ✅ Done

### Google Play Store

#### 1. **Privacy Policy** (სავალდებულო)
- ✅ **Required:** დიახ
- **Where:** Google Play Console → App content → Privacy policy
- **Example:** `https://yourdomain.com/privacy-policy`

#### 2. **Data Safety Section** (სავალდებულო)
- ✅ **Required:** დიახ
- **Where:** Google Play Console → App content → Data safety
- **Required disclosures:**
  - ✅ **Data Collection** (Analytics, Location, User Content)
  - ✅ **Data Sharing** (Firebase Analytics)
  - ✅ **Data Security** (encryption, data handling)

#### 3. **Permissions Declaration**
- ✅ **Status:** დამატებულია
- **All permissions declared in `app.json`**

---

## 🔍 Firebase Analytics Permissions

### iOS
- ✅ **App Tracking Transparency (ATT)** - დამატებულია
- ✅ **NSUserTrackingUsageDescription** - დამატებულია
- ✅ **Implementation** - დამატებულია

### Android
- ✅ **No special permission needed**
- ✅ **INTERNET permission** - default-ად არის
- ✅ **Firebase Analytics works without additional permissions**

---

## 📝 App Store Connect Checklist

### iOS App Store Connect

1. ✅ **App Tracking Transparency** - დამატებულია
2. ⚠️ **Privacy Policy URL** - დასამატებელია
3. ⚠️ **Data Collection Disclosure** - დასამატებელია App Store Connect-ში
4. ✅ **Permissions declared** - დამატებულია

### Google Play Console

1. ✅ **Permissions declared** - დამატებულია
2. ⚠️ **Privacy Policy URL** - დასამატებელია
3. ⚠️ **Data Safety Section** - დასამატებელია Google Play Console-ში

---

## 🚀 Next Steps

### 1. Create Privacy Policy
- შექმენი Privacy Policy page
- დამატე link App Store Connect-ში
- დამატე link Google Play Console-ში

### 2. App Store Connect Setup
- App Store Connect → App Privacy
- დაამატე Data Collection types:
  - Analytics Data
  - Location Data
  - User Content
  - Device ID
  - Usage Data

### 3. Google Play Console Setup
- Google Play Console → Data safety
- დაამატე Data Collection information
- დაამატე Privacy Policy URL

---

## ✅ Summary

### Permissions Status:
- ✅ iOS ATT - დამატებულია
- ✅ iOS Camera/Photo - დამატებულია
- ✅ iOS Location - დამატებულია
- ✅ Android Permissions - დამატებულია
- ✅ Firebase Analytics - დამატებულია

### Required Actions:
- ⚠️ Privacy Policy - დასამატებელია
- ⚠️ App Store Connect Data Disclosure - დასამატებელია
- ⚠️ Google Play Data Safety - დასამატებელია

**ყველა technical permission დამატებულია!** 
მხოლოდ App Store Connect-ში და Google Play Console-ში Privacy Policy და Data Collection disclosure-ები დასამატებელია.


