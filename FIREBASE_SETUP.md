# 🔥 Firebase Admin SDK Setup ინსტრუქცია

## 📋 რა უნდა გააკეთო:

### 1. Firebase Console-ში Service Account Key გადმოიტანე:

1. **გადადი Firebase Console-ში:**
   ```
   https://console.firebase.google.com/
   ```

2. **აირჩიე შენი Project:**
   - თუ არ გაქვს, შექმენი ახალი project

3. **გადადი Project Settings-ში:**
   ```
   ⚙️ Settings → Project settings
   ```

4. **აირჩიე Service Accounts ტაბი:**
   ```
   Service Accounts → Generate new private key
   ```

5. **აირჩიე Node.js და Generate:**
   - დააჭირე "Generate new private key"
   - აირჩიე "Node.js"
   - დააჭირე "Generate"

6. **გადმოიტანე JSON ფაილი:**
   - ფაილს ერქვება რაღაც მაგ: `your-project-name-firebase-adminsdk-xxxxx.json`
   - შეინახე ეს ფაილი `backend-v2/` ფოლდერში
   - გადაარქვის სახელი: `firebase-adminsdk.json`

---

### 2. გადააკეთე ფაილის სახელი:

```bash
# გადაარქვი ფაილს
mv your-project-name-firebase-adminsdk-xxxxx.json firebase-adminsdk.json
```

---

### 3. გადაადგილე ფაილი სწორ ადგილას:

```
backend-v2/
├── src/
├── firebase-adminsdk.json  ← აქ უნდა იყოს!
├── package.json
└── ...
```

---

### 4. გაუშვი Backend-ს:

```bash
cd backend-v2
npm run start:dev
```

თუ ყველაფერი სწორია, უნდა ნახო:

```
✅ Firebase Admin SDK initialized successfully!
```

---

## 🔧 Alternative: Environment Variable

თუ არ გინდა ფაილის ფოლდერში შენახვა:

```bash
# .env ფაილში �აამატე:
FIREBASE_SERVICE_ACCOUNT_PATH=./path/to/your/firebase-adminsdk.json
```

---

## ✅ როგორ შეამოწმო:

### 1. გაუშვი და ნახე ლოგები:
```bash
npm run start:dev
```

**Success:**
```
✅ Firebase Admin SDK initialized successfully!
```

**Error:**
```
⚠️ Firebase service account key not found at: ./firebase-adminsdk.json
📋 To enable push notifications:
   1. Go to Firebase Console → Project Settings → Service Accounts
   2. Generate new private key
   3. Save as firebase-adminsdk.json in backend-v2 root
```

### 2. შეამოწმე თუ მუშაობს Push Notifications:

```bash
# შექმენი test part (Postman/curl)
curl -X POST http://localhost:3000/parts \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ძრავა",
    "vehicle": {
      "make": "BMW",
      "model": "X5",
      "year": "2020"
    },
    "price": 2500
  }'
```

თუ ყველაფერი სწორია, უნდა ნახო:

```
🤖 [AI-NOTIFY] Checking matching requests for new part...
✅ FCM sent: 1 success, 0 failed
```

---

## 🔒 Security Notes:

### ✅ რას იყენებს Firebase Admin SDK:
- **OAuth 2.0** - უფრო უსაფრთხოვანია ვიდრე API keys
- **Service Account** - მხოლოდ server-ზე გამოიყენება
- **No FCM_SERVER_KEY** - აღარ გჭირდება environment variables

### ⚠️ რას არ გააკეთო:
- **არ ატვირთო firebase-adminsdk.json GitHub-ზე!**
- **არ გააზიარო key სხვებთან!**
- **დაამატე .gitignore-ში:**
  ```
  firebase-adminsdk.json
  ```

---

## 🚀 Ready!

როცა დაასრულებ, გექნება:

1. ✅ **Firebase Admin SDK** - HTTP v1 API
2. ✅ **AI-Based Notifications** - 60%+ confidence
3. ✅ **Auto Token Cleanup** - invalid tokens იშლება
4. ✅ **Platform Support** - Android/iOS განსხვავებული settings

---

## 📱 Test on Real Device:

1. **გაუშვი React Native App-ს**
2. **შექმენი Request ან Part**
3. **დაელოდე Push Notification-ს!** 📱

---

გილოცავ! 🔥 Firebase Admin SDK მზადაა!
