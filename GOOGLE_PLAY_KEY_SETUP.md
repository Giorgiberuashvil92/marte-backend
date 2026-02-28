# Google Play Console - Upload Key Setup

## მიმდინარე სიტუაცია

**Google Play Console-ში Expected Upload Key SHA1:**
```
BE:30:25:FB:07:79:91:E0:89:40:B6:F8:2F:D6:95:48:1F:09:44:DA
```

**EAS-ში ახალი Keystore SHA1:**
```
1C:C2:99:23:7D:87:79:D5:04:51:22:68:1E:71:88:1D:7D:F4:C9:9F
```

## ნაბიჯები

### 1. Keystore-ის ჩამოტვირთვა EAS-დან

```bash
eas credentials
# აირჩიეთ: Android → production
# აირჩიეთ: Download existing keystore
# აირჩიეთ: Build Credentials JsmQmXGXYB (ახალი keystore)
```

### 2. Certificate-ის გამოტანა keystore-დან

Keystore-ის ჩამოტვირთვის შემდეგ, გამოიტანეთ certificate:

```bash
keytool -export -rfc -keystore <downloaded-keystore.jks> -alias 202a37172548dad169deca918644e02c -file upload_certificate.pem
```

**შენიშვნა:** 
- `<downloaded-keystore.jks>` - ჩამოტვირთული keystore ფაილის სახელი
- `202a37172548dad169deca918644e02c` - Key Alias (EAS-ში ნაჩვენები)
- Password-ს მოგთხოვთ - ეს არის keystore password რომელიც EAS-მა მოგცათ keystore-ის ჩამოტვირთვისას

### 3. Google Play Console-ში Upload Key Certificate-ის ატვირთვა

1. გადადით **Google Play Console** → თქვენი app
2. გადადით **Release** → **Setup** → **App signing**
3. გადადით **"Upload key certificate"** განყოფილებაში
4. აირჩიეთ **"Request upload key reset"** ან **"Add upload key certificate"**
5. ატვირთეთ `upload_certificate.pem` ფაილი
6. დაადასტურეთ

### 4. ახალი Build-ის გაშვება

Upload key-ის setup-ის შემდეგ, გაუშვით ახალი build:

```bash
npm run build:android
```

## ალტერნატიული მეთოდი (თუ Upload Key Reset არ მუშაობს)

თუ Google Play Console-ში არ გაქვთ "Request upload key reset" ოფცია:

1. გადადით **Release** → **Setup** → **App signing**
2. აირჩიეთ **"Upload key certificate"** tab
3. აირჩიეთ **"Add certificate"** ან **"Register new upload key"**
4. ატვირთეთ `upload_certificate.pem` ფაილი

## შემოწმება

Build-ის შემდეგ, Google Play Console-ში:
- **Release** → **Production** → **Create new release**
- ატვირთეთ ახალი AAB ფაილი
- უნდა მუშაობდეს შეცდომის გარეშე

## მნიშვნელოვანი

- **App Signing Key** (რომელიც Google ინახავს) - ეს არის production signing key
- **Upload Key** (რომელიც developer იყენებს) - ეს არის key რომლითაც sign-დება build build-ისას
- Google Play Console ავტომატურად re-sign-ს upload key-ით sign-ილი build-ს App Signing Key-ით
