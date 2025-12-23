# 🔧 BOG Callback URL პრობლემა და გადაწყვეტა

## ❌ პრობლემა:

Frontend-ში callback URL არის:
```
https://carappx.onrender.com/bog/callback
```

მაგრამ backend არის:
- Local: `http://localhost:3000`
- Production: `https://marte-backend-production.up.railway.app`

BOG-მა უნდა გამოიძახოს callback URL, მაგრამ:
- თუ backend localhost-ზეა → BOG ვერ მიაღწევს
- თუ backend Railway-ზეა → BOG უნდა გამოიძახოს Railway URL

## ✅ გადაწყვეტა:

### ვარიანტი 1: Development-ისთვის (Localhost)

Frontend-ში შევცვალოთ callback URL environment variable-ის მიხედვით:

```typescript
// app/(tabs)/index.tsx
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000';

const orderData = {
  callback_url: `${API_BASE_URL}/bog/callback`, // ✅ Dynamic URL
  // ...
};
```

### ვარიანტი 2: Production-ისთვის (Railway)

Frontend-ში გამოვიყენოთ Railway backend URL:

```typescript
const orderData = {
  callback_url: `https://marte-backend-production.up.railway.app/bog/callback`,
  // ...
};
```

### ვარიანტი 3: BOG Dashboard-ში Callback URL-ის დაყენება

BOG Business Manager-ში:
1. გადადი Settings → API Configuration
2. დააყენე Callback URL:
   - Development: `http://localhost:3000/bog/callback` (არ მუშაობს, BOG მოითხოვს HTTPS)
   - Production: `https://marte-backend-production.up.railway.app/bog/callback`

## 🔍 როგორ შევამოწმოთ:

### 1. BOG Dashboard-ში:
- შეამოწმე რომ callback URL დაყენებულია
- URL უნდა იყოს: `https://marte-backend-production.up.railway.app/bog/callback`

### 2. Backend Logs-ში:
- უნდა ხედავდე: `🔄 BOG CALLBACK მიღებულია`
- თუ არ ხედავ → callback არ მოდის

### 3. Railway Backend-ზე:
- შეამოწმე რომ backend მუშაობს Railway-ზე
- შეამოწმე რომ `/bog/callback` endpoint ხელმისაწვდომია

## 📝 რეკომენდაცია:

1. **Development-ისთვის:**
   - გამოიყენე ngrok ან tunnel service
   - ან გადადი Railway-ზე testing-ისთვის

2. **Production-ისთვის:**
   - Frontend-ში გამოიყენე Railway backend URL
   - BOG Dashboard-ში დააყენე Railway callback URL

## 🚀 სწრაფი Fix:

```typescript
// app/(tabs)/index.tsx - Line 396
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://marte-backend-production.up.railway.app';

const orderData = {
  callback_url: `${API_BASE_URL}/bog/callback`, // ✅ Dynamic
  // ...
};
```

