# CarApp Backend v2 🚗

## აღწერა

CarApp-ის განახლებული backend სერვისი NestJS framework-ზე დაფუძნებული. მხარს უჭერს:

- 🚗 **Carwash სერვისები** - პოპულარული ლოკაციების ინტელექტუალური ალგორითმი
- 🔧 **Garage მართვა** - მანქანების და შეხსენებების სისტემა  
- 💬 **Real-time Chat** - WebSocket მხარდაჭერით
- 🤖 **AI რეკომენდაციები** - ნაწილებისა და სერვისებისთვის
- 📱 **მობილური API** - React Native აპლიკაციისთვის

## 🚀 გაშვება

### 1. Dependencies-ის ინსტალაცია
\`\`\`bash
npm install
\`\`\`

### 2. Environment Variables-ის კონფიგურაცია
შექმენით `.env` ფაილი `marte-backend` დირექტორიაში:
\`\`\`env
# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/carapp-v2?retryWrites=true&w=majority

# SMS Service (Sender.ge)
SENDER_GE_API_KEY=your_api_key_here

# Port
PORT=3000

# Node Environment
NODE_ENV=development
\`\`\`

### 3. Development რეჟიმში გაშვება
\`\`\`bash
# Port 3000-ზე
npm run start:dev
\`\`\`

### 4. Production რეჟიმში გაშვება
\`\`\`bash
npm run build
npm run start:prod
\`\`\`

## 🔧 მთავარი ფუნქციები

### პოპულარული სერვისების ალგორითმი
- **რეიტინგი (40%)** - მაღალი რეიტინგი = პოპულარული
- **რევიუების რაოდენობა (25%)** - მეტი რევიუ = უფრო პოპულარული
- **ღიაა თუ არა (15%)** - ღია სერვისები პრიორიტეტულია
- **ფასის კონკურენტუნარიანობა (10%)** - საშუალო ფასის მახლობლად
- **სერვისების რაოდენობა (10%)** - მეტი სერვისი = უკეთესი

### კეშირება
- პოპულარული ლოკაციები კეშირდება 5 წუთით
- ოპტიმიზირებული MongoDB queries

## 📡 API Endpoints

### Carwash
- `GET /carwash/locations/popular?limit=6` - პოპულარული ლოკაციები
- `GET /carwash/locations` - ყველა ლოკაცია
- `POST /carwash/locations` - ახალი ლოკაციის დამატება

### Garage  
- `GET /garage/cars` - მანქანების სია
- `POST /garage/cars` - ახალი მანქანის დამატება
- `GET /garage/reminders` - შეხსენებები

### Messages
- WebSocket: `/messages` - Real-time chat

### SMS Service
- `POST /sms/send` - SMS-ის გაგზავნა (Sender.ge API)
  - Body: `{ phoneNumber: string, message: string, smsno?: number }`
  - `smsno`: 1 = with SmsNo (advertising), 2 = without SmsNo (informational, default)

### Authentication
- `POST /auth/start` - OTP კოდის გაგზავნა
- `POST /auth/verify` - OTP კოდის ვერიფიკაცია

## 🗄️ Database

MongoDB Atlas-ზე დაფუძნებული:
- **Database:** `carapp-v2`
- **Collections:** cars, carwash-locations, users, reminders, etc.

## 🔍 Debugging

\`\`\`bash
# Linting
npm run lint:fix

# Tests
npm run test

# Debug mode
npm run start:debug
\`\`\`

## 📱 SMS Service (Sender.ge)

Backend იყენებს Sender.ge API-ს SMS-ის გასაგზავნად. OTP კოდები ავტომატურად იგზავნება authentication-ის დროს.

### კონფიგურაცია:
1. მიიღეთ API key [sender.ge](https://sender.ge)-დან
2. დაამატეთ `.env` ფაილში: `SENDER_GE_API_KEY=your_api_key`
3. Development რეჟიმში SMS არ იგზავნება, კოდი console-ში იჩვენება

### გამოყენება:
- **OTP გაგზავნა**: ავტომატურად `/auth/start` endpoint-ზე
- **სხვა SMS**: `POST /sms/send` endpoint-ის გამოყენებით

## 📝 ცვლილებები v1-დან

1. ✅ **პორტი 3000** - სტანდარტული NestJS პორტი
2. ✅ **პოპულარული სერვისების ალგორითმი** - რთული scoring system
3. ✅ **კეშირება** - performance გაუმჯობესებისთვის
4. ✅ **CORS მხარდაჭერა** - frontend integration-ისთვის
5. ✅ **WebSocket** - real-time ფუნქციონალობისთვის
6. ✅ **SMS Service** - Sender.ge API ინტეგრაცია OTP-ისთვის

## 🤝 Development

Backend-v2 არის მთავარი სერვისი რომელსაც იყენებს frontend. ძველი backend საცავი მხოლოდ reference-ისთვის რჩება.
