# 🔧 BOG Environment Variables Setup

## Environment Variables კონფიგურაცია

შექმენით `.env` ფაილი `backend-v2` დირექტორიაში და დაამატეთ შემდეგი ცვლადები:

```env
# Database Configuration
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/carapp-v2?retryWrites=true&w=majority

# BOG Payment Gateway Configuration
BOG_CLIENT_ID=your_bog_client_id_here
BOG_CLIENT_SECRET=your_bog_client_secret_here
BOG_MERCHANT_ID=your_bog_merchant_id_here
BOG_API_BASE_URL=https://api.bog.ge

# API Configuration
API_BASE_URL=https://carappx.onrender.com
PORT=4000

# JWT Configuration
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=7d

# Firebase Configuration (if using)
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_PRIVATE_KEY=your_firebase_private_key
FIREBASE_CLIENT_EMAIL=your_firebase_client_email

# Other configurations
NODE_ENV=development
```

## BOG Credentials-ის მიღება

### 1. BOG Business Manager-ში რეგისტრაცია
- დარეგისტრირდით BOG Business Manager-ში
- შეავსეთ ყველა საჭირო ბიზნეს ინფორმაცია
- მიიღეთ Merchant ID

### 2. API Credentials-ის მიღება
- BOG-ისგან მიიღეთ `client_id` და `client_secret`
- ეს credentials გამოიყენება OAuth 2.0 ავთენტიფიკაციისთვის

### 3. Callback URL-ის კონფიგურაცია
- Development-ისთვის: `https://carappx.onrender.com/bog/callback` (BOG API მოითხოვს HTTPS-ს)
- Production-ისთვის: `https://your-domain.com/payments/bog/callback`
- ეს URL გამოიყენება BOG-ისგან callback-ების მისაღებად

## ტესტირება

### Development რეჟიმი
```bash
# Backend გაშვება
cd backend-v2
npm run start:dev

# Frontend გაშვება
npm start
```

### Production რეჟიმი
```bash
# Backend build
cd backend-v2
npm run build
npm run start:prod
```

## უსაფრთხოება

⚠️ **მნიშვნელოვანი**: 
- `BOG_CLIENT_SECRET` არასდროს არ უნდა იყოს hardcoded კოდში
- გამოიყენეთ environment variables
- Production-ში გამოიყენეთ HTTPS
- რეგულარულად განაახლეთ credentials

## ტესტირების სკრიპტი

```bash
# BOG ინტეგრაციის ტესტირება
cd backend-v2
node test-bog-integration.js
```
