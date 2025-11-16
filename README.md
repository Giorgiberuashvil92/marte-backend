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

### 2. Development რეჟიმში გაშვება
\`\`\`bash
# Port 4000-ზე (frontend-თან შესაბამისობისთვის)
npm run start:dev
\`\`\`

### 3. Production რეჟიმში გაშვება
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

## 📝 ცვლილებები v1-დან

1. ✅ **პორტი 4000** - frontend-თან შესაბამისობისთვის
2. ✅ **პოპულარული სერვისების ალგორითმი** - რთული scoring system
3. ✅ **კეშირება** - performance გაუმჯობესებისთვის
4. ✅ **CORS მხარდაჭერა** - frontend integration-ისთვის
5. ✅ **WebSocket** - real-time ფუნქციონალობისთვის

## 🤝 Development

Backend-v2 არის მთავარი სერვისი რომელსაც იყენებს frontend. ძველი backend საცავი მხოლოდ reference-ისთვის რჩება.
