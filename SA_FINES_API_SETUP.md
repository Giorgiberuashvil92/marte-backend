# 🚨 საქართველოს სახელმწიფო სერვისების API - ჯარიმების ინტეგრაცია

## 📋 Environment Variables

### Backend (NestJS)

`marte-backend` დირექტორიაში შექმენით `.env` ფაილი (ან დაამატეთ არსებულში) და დაამატეთ შემდეგი ცვლადები:

```env
# საქართველოს სახელმწიფო სერვისების API Credentials
SA_CLIENT_ID=your_client_id_here
SA_CLIENT_SECRET=your_client_secret_here
```

**⚠️ მნიშვნელოვანი:** Client ID და Secret ინახება backend-ში და არ არის exposed frontend-ში. ეს უზრუნველყოფს უსაფრთხოებას.

## 🔑 Credentials-ის მიღება

1. დაუკავშირდით საქართველოს სახელმწიფო სერვისებს
2. მიიღეთ `Client ID` და `Client Secret`
3. დაამატეთ ისინი `.env` ფაილში

## 📡 API Endpoints

### Token მოპოვება
- **URL:** `https://api-identity.sa.gov.ge/connect/token`
- **Method:** POST
- **Content-Type:** `application/x-www-form-urlencoded`
- **Body:**
  - `client_id` (required)
  - `client_secret` (required)
  - `grant_type`: `client_credentials`

### ჯარიმების შემოწმება
- **URL:** `https://api-public.sa.gov.ge/api/v1/patrolpenalties`
- **Method:** GET
- **Headers:** `Authorization: Bearer {access_token}`
- **Query Parameters:**
  - `AutomobileNumber` (optional) - ავტომობილის ნომერი
  - `TechPassportNumber` (optional) - ტექ. პასპორტის ნომერი

### სხვა Endpoints

დეტალური API დოკუმენტაცია: https://api-public.sa.gov.ge/index.html#/PatrolPenalties

## 🚀 გამოყენება

### 1. API სერვისის იმპორტი

```typescript
import { finesApi } from '../../services/finesApi';
```

### 2. ჯარიმების შემოწმება

```typescript
const penalties = await finesApi.getPenalties(
  'TB-123-AB',  // საბარათე ნომერი
  '123456789'   // ტექ. პასპორტის ნომერი
);
```

### 3. მანქანის რეგისტრაცია

```typescript
const vehicleId = await finesApi.registerVehicle(
  'TB-123-AB',
  '123456789',
  true  // MediaFile - ვიდეო ჯარიმებისთვის
);
```

### 4. ვიდეო ჯარიმების ნახვა

```typescript
const mediaFiles = await finesApi.getPenaltyMediaFiles(
  'TB-123-AB',
  '123456789',
  12345  // protocolId
);
```

## 📝 შენიშვნები

- Token ავტომატურად იხსნება და ინახება მეხსენებლოში
- Token ავტომატურად განახლდება expiration-ის წინ
- ყველა request ავტომატურად იყენებს Bearer token authentication-ს

## ⚠️ მნიშვნელოვანი

- **არ გააზიაროთ** Client ID და Client Secret
- **არ დაამატოთ** `.env` ფაილი Git-ში (უკვე არის .gitignore-ში)
- Production-ში გამოიყენეთ secure environment variables
