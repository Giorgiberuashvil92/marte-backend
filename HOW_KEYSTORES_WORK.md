# Keystore-ების შექმნა და მუშაობა

## რა არის Keystore?

**Keystore** არის ფაილი რომელიც შეიცავს:
- **Private Key** - საიდუმლო გასაღები (არასოდეს არ უნდა გაზიარდეს)
- **Certificate** - public certificate (შეიძლება გაზიარება)
- **Key Alias** - key-ის სახელი keystore-ში
- **Passwords** - keystore password და key password

## Keystore-ების შექმნის გზები

### 1. EAS-ის მიერ ავტომატური შექმნა

როცა პირველად იყენებთ EAS Build-ს:

```bash
eas build --platform android --profile production
```

EAS ავტომატურად:
1. შექმნის ახალ keystore-ს
2. დააგენერირებს private key-ს
3. შექმნის certificate-ს
4. ინახავს keystore-ს EAS servers-ზე
5. აჩვენებს fingerprint-ებს (SHA1, SHA256)

**მაგალითი:**
- Build Credentials JsmQmXGXYB (ახალი) - EAS-მა შექმნა 40 წუთის წინ
- Build Credentials xMnPzPtWgx (ძველი) - EAS-მა შექმნა 3 თვის წინ

### 2. ხელით შექმნა keytool-ით

```bash
keytool -genkeypair \
  -v \
  -storetype JKS \
  -keystore my-release-key.jks \
  -alias my-key-alias \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

ეს შექმნის:
- `my-release-key.jks` - keystore ფაილი
- Private key და certificate
- მოგთხოვთ keystore password და key password

### 3. Expo CLI-ის მიერ (ძველი მეთოდი)

```bash
expo build:android
```

ძველად Expo CLI ავტომატურად შექმნიდა keystore-ს.

## Keystore-ის სტრუქტურა

```
Keystore (JKS format)
├── Private Key (საიდუმლო)
│   ├── Key Alias: "my-key-alias"
│   ├── Algorithm: RSA 2048-bit
│   └── Password: key password
├── Certificate (public)
│   ├── SHA1 Fingerprint: BE:30:25:FB:...
│   ├── SHA256 Fingerprint: 2E:37:95:08:...
│   └── Valid Until: 2053
└── Keystore Password: keystore password
```

## Android App Signing პროცესი

### 1. Build-ის Sign-ი

როცა build-ს აკეთებთ:
1. Build tool (Gradle/EAS) იყენებს keystore-ს
2. Sign-დება app-ი private key-ით
3. Certificate-ი ემატება APK/AAB-ს
4. Google Play Console ამოწმებს certificate-ს

### 2. Google Play App Signing

თუ Google Play App Signing ჩართულია:
1. **Upload Key** - developer-ი იყენებს build-ის sign-ისთვის
2. **App Signing Key** - Google ინახავს და იყენებს production-ისთვის
3. Google Play Console ავტომატურად re-sign-ს upload key-ით sign-ილი build-ს App Signing Key-ით

## რატომ არის 2 Keystore EAS-ში?

### Build Credentials JsmQmXGXYB (ახალი)
- შექმნილია: 40 წუთის წინ
- SHA1: `1C:C2:99:23:7D:87:79:D5:04:51:22:68:1E:71:88:1D:7D:F4:C9:9F`
- Status: Default (გამოიყენება ახლა)

### Build Credentials xMnPzPtWgx (ძველი)
- შექმნილია: 3 თვის წინ
- SHA1: `13:A3:8F:DC:9C:15:D1:BB:EB:7D:DC:0E:A7:99:26:4B:3A:A4:7C:2E`
- Status: არ არის default

## რატომ შეიქმნა ახალი Keystore?

როცა EAS-ში შექმენით ახალი keystore "Set up a new keystore" ოფციით, EAS-მა:
1. შექმნა ახალი keystore
2. დააგენერირა ახალი private key
3. შექმნა ახალი certificate (სხვა fingerprint-ით)
4. დააყენა default-ად

## რატომ არ ემთხვევა Google Play Console-ს?

Google Play Console-ში expected upload key SHA1:
```
BE:30:25:FB:07:79:91:E0:89:40:B6:F8:2F:D6:95:48:1F:09:44:DA
```

ეს keystore შეიქმნა:
- ან Google Play Console-ში პირველი build-ის ატვირთვისას
- ან ხელით keytool-ით
- ან სხვა build service-ით

**პრობლემა:** ეს keystore არ არის EAS-ში ან ლოკალურად ხელმისაწვდომი.

## გადაწყვეტა

### ვარიანტი 1: Upload Key Reset (რეკომენდირებული)
1. Google Play Console-ში "Request upload key reset"
2. ატვირთეთ ახალი keystore-ის certificate
3. Google დაამტკიცებს (24-48 საათი)
4. შემდეგ შეგეძლებათ ახალი keystore-ით build-ის ატვირთვა

### ვარიანტი 2: სწორი Keystore-ის პოვნა
თუ იპოვნით keystore-ს რომლის SHA1 არის `BE:30:25:FB:07:79:91:E0:89:40:B6:F8:2F:D6:95:48:1F:09:44:DA`:
1. ატვირთეთ EAS-ში
2. დააყენეთ default-ად
3. გაუშვით build

## მნიშვნელოვანი

- **Private Key** არასოდეს არ უნდა დაკარგოთ - თუ დაკარგავთ, ვერ განაახლებთ app-ს
- **Keystore Password** - ინახეთ უსაფრთხოდ
- **Backup** - გააკეთეთ keystore-ის backup
- **EAS** - EAS ინახავს keystore-ებს უსაფრთხოდ, მაგრამ რეკომენდირებულია backup-ის გაკეთება
