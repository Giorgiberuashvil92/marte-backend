# Google Play Console - Upload Key Reset ნაბიჯები

## მიმდინარე სიტუაცია

**Google Play Console-ში Expected Upload Key SHA1:**
```
BE:30:25:FB:07:79:91:E0:89:40:B6:F8:2F:D6:95:48:1F:09:44:DA
```

**ახალი Keystore SHA1 (EAS-ში):**
```
1C:C2:99:23:7D:87:79:D5:04:51:22:68:1E:71:88:1D:7D:F4:C9:9F
```

## ნაბიჯები

### 1. Google Play Console-ში Upload Key Reset

1. გადადით **Google Play Console** → თქვენი app
2. გადადით **Release** → **Setup** → **App signing**
3. გადადით **"Upload key certificate"** განყოფილებაში
4. დააჭირეთ **"Request upload key reset"** ღილაკს
5. ატვირთეთ `upload_certificate.pem` ფაილი (პროექტის root დირექტორიაშია)
6. დაადასტურეთ request

### 2. Email Confirmation

- Google Play Console გამოაგზავნის email-ს თქვენს Google account-ზე
- დაადასტურეთ email-ში
- ეს ჩვეულებრივ რამდენიმე წუთში-საათში მოდის

### 3. Google Review

- Google ამოწმებს request-ს
- ჩვეულებრივ: **24-48 საათი**
- შეიძლება უფრო სწრაფადაც (რამდენიმე საათი)

### 4. Status შემოწმება

Google Play Console-ში:
- **App signing** გვერდზე შეამოწმეთ status
- Status განახლდება: "Reset in progress" → "Reset completed"

### 5. ახალი Build

Reset-ის დასრულების შემდეგ:

```bash
npm run build:android
```

შემდეგ ატვირთეთ Google Play Console-ში - უნდა მუშაობდეს!

## ⚠️ მნიშვნელოვანი

- **Upload Key Reset** აუცილებელია, რადგან Google Play Console-ში expected upload key არის `BE:30:25:FB:07:79:91:E0:89:40:B6:F8:2F:D6:95:48:1F:09:44:DA`
- ახალი keystore-ის SHA1 არის `1C:C2:99:23:7D:87:79:D5:04:51:22:68:1E:71:88:1D:7D:F4:C9:9F`
- ეს არ ემთხვევა, ამიტომ reset აუცილებელია

## 📁 Certificate ფაილი

`upload_certificate.pem` ფაილი პროექტის root დირექტორიაშია და მზადაა ატვირთვისთვის.
