# Upload Key Reset-ის ალტერნატივები

## მიმდინარე სიტუაცია

- **Google Play Console Expected SHA1:** `BE:30:25:FB:07:79:91:E0:89:40:B6:F8:2F:D6:95:48:1F:09:44:DA`
- **EAS-ში ძველი keystore SHA1:** `13:A3:8F:DC:9C:15:D1:BB:EB:7D:DC:0E:A7:99:26:4B:3A:A4:7C:2E` ❌
- **EAS-ში ახალი keystore SHA1:** `1C:C2:99:23:7D:87:79:D5:04:51:22:68:1E:71:88:1D:7D:F4:C9:9F` ❌
- **Google Play App Signing:** ✅ ჩართულია

## ალტერნატივები

### ❌ ვარიანტი 1: Build-ის ატვირთვა ახალი keystore-ით (არ მუშაობს)

თუ Google Play App Signing ჩართულია, Google ავტომატურად re-sign-ს build-ს App Signing Key-ით, მაგრამ:
- Google Play Console ამოწმებს **upload key** build-ის ატვირთვისას
- თუ upload key არ ემთხვევა, build-ის ატვირთვა ვერ მოხერხდება
- **შედეგი:** ❌ "Your Android App Bundle is signed with the wrong key" შეცდომა

### ✅ ვარიანტი 2: Upload Key Reset (რეკომენდირებული)

**დრო:** 24-48 საათი

**ნაბიჯები:**
1. Google Play Console → "Request upload key reset"
2. ატვირთეთ ახალი `upload_certificate.pem`
3. დაადასტურეთ email-ში
4. დაელოდეთ Google-ის approval-ს

**პლიუსები:**
- ✅ საიმედო
- ✅ ოფიციალური გზა
- ✅ ერთხელ გაკეთება, შემდეგ სამუდამოდ მუშაობს

**მინუსები:**
- ⏰ 24-48 საათი ლოდინი

### 🔍 ვარიანტი 3: სწორი Keystore-ის პოვნა

თუ იპოვნით keystore-ს რომლის SHA1 არის `BE:30:25:FB:07:79:91:E0:89:40:B6:F8:2F:D6:95:48:1F:09:44:DA`:

1. ატვირთეთ EAS-ში:
   ```bash
   eas credentials
   # -> Change default keystore
   # -> Upload keystore
   ```

2. დააყენეთ default-ად

3. გაუშვით build:
   ```bash
   npm run build:android
   ```

**პლიუსები:**
- ✅ სწრაფი (თუ keystore იპოვნება)
- ✅ არ სჭირდება Google-ის approval

**მინუსები:**
- ❓ keystore-ის პოვნა შეიძლება რთული იყოს
- ❓ შეიძლება keystore დაკარგული იყოს

### ⚠️ ვარიანტი 4: Google Play Console Support-თან დაკავშირება

თუ keystore დაკარგულია და reset request ვერ გააგზავნეთ:
1. დაუკავშირდით Google Play Console Support-ს
2. ახსენით სიტუაცია
3. მოითხოვეთ upload key reset manual approval

**პლიუსები:**
- ✅ Support-ი დაგეხმარებათ

**მინუსები:**
- ⏰ შეიძლება უფრო მეტი დრო დასჭირდეს
- 📧 Support-თან კომუნიკაცია საჭიროა

## რეკომენდაცია

**საუკეთესო გზა:** **Upload Key Reset** (ვარიანტი 2)

**რატომ:**
- ✅ საიმედო და ოფიციალური
- ✅ ერთხელ გაკეთება, შემდეგ სამუდამოდ მუშაობს
- ✅ არ სჭირდება keystore-ის პოვნა
- ⏰ 24-48 საათი ლოდინი, მაგრამ ეს არის ერთჯერადი პროცესი

## შეჯამება

**არ არის სხვა სწრაფი გზა** Upload Key Reset-ის გარეშე, რადგან:
- Google Play Console ამოწმებს upload key build-ის ატვირთვისას
- სწორი keystore არ არის ხელმისაწვდომი
- Google Play App Signing არ გადააწერს upload key-ს (მხოლოდ App Signing Key-ს)

**გადაწყვეტა:** გააგრძელეთ Upload Key Reset პროცესი - ეს არის ერთადერთი საიმედო გზა.
