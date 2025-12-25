# 💳 როგორ ვნახო გადახდები

## 📊 სად ინახება გადახდები:

### 1. **MongoDB Database-ში**
- Collection: `payments`
- Schema: `Payment` (იხილე `src/schemas/payment.schema.ts`)

### 2. **API Endpoints:**

#### A. User-ის გადახდების მიღება:
```bash
GET /api/payments/user/:userId
```

**Response:**
```json
[
  {
    "_id": "...",
    "userId": "user_123",
    "orderId": "bog_order_id_12345",
    "amount": 1.0,
    "currency": "GEL",
    "paymentMethod": "BOG",
    "status": "completed",
    "context": "test",
    "description": "ტესტ გადახდა - 1 ლარი",
    "paymentDate": "2025-01-23T...",
    "paymentToken": "bog_order_id_12345",
    "createdAt": "...",
    "updatedAt": "..."
  }
]
```

#### B. Payment-ის მიღება Order ID-ით:
```bash
GET /api/payments/order/:orderId
```

#### C. Payment Statistics:
```bash
GET /api/payments/stats
```

### 3. **MongoDB Compass / mongo shell-ში:**

```javascript
// ყველა გადახდა
db.payments.find().sort({ createdAt: -1 })

// კონკრეტული user-ის გადახდები
db.payments.find({ userId: "თქვენი_user_id" }).sort({ createdAt: -1 })

// ბოლო გადახდა
db.payments.findOne({}, {}, { sort: { createdAt: -1 } })

// გადახდები orderId-ით
db.payments.find({ orderId: "bog_order_id_12345" })

// გადახდები paymentToken-ით (recurring payment-ებისთვის)
db.payments.find({ paymentToken: { $exists: true, $ne: null } })
```

## 🔍 როგორ ვნახო ჩემი გადახდა:

### 1. **Backend Logs-ში:**
Backend console-ში უნდა ხედავდე:
```
✅ BOG გადახდა წარმატებულია: bog_order_id_12345
💾 Payment არ მოიძებნა, ვქმნით ახალ payment record-ს: bog_order_id_12345
✅ ახალი payment record შეიქმნა: payment_id, userId: user_123
💾 Payment token შენახულია recurring payment-ებისთვის: bog_order_id_12345
```

### 2. **MongoDB-ში:**
```javascript
// ბოლო გადახდა
db.payments.findOne({}, {}, { sort: { createdAt: -1 } })

// ან orderId-ით
db.payments.findOne({ orderId: "თქვენი_order_id" })
```

### 3. **API-დან:**
```bash
# User ID-ის მიღება (თუ იცი)
curl http://localhost:3000/api/payments/user/თქვენი_user_id

# ან orderId-ით
curl http://localhost:3000/api/payments/order/თქვენი_order_id
```

## 📝 Payment Record-ის სტრუქტურა:

```javascript
{
  _id: ObjectId("..."),
  userId: "user_123",                    // User ID
  orderId: "bog_order_id_12345",        // BOG order ID
  amount: 1.0,                          // გადახდის თანხა
  currency: "GEL",                      // ვალუტა
  paymentMethod: "BOG",                 // გადახდის მეთოდი
  status: "completed",                  // სტატუსი
  context: "test",                      // კონტექსტი (test, subscription, carwash, etc.)
  description: "ტესტ გადახდა - 1 ლარი", // აღწერა
  paymentDate: ISODate("2025-01-23..."), // გადახდის თარიღი
  paymentToken: "bog_order_id_12345",   // Recurring payment-ებისთვის token
  metadata: {
    serviceName: "ტესტ გადახდა - 1 ლარი",
    externalOrderId: "test_payment_1234567890_user_123"
  },
  createdAt: ISODate("2025-01-23..."),
  updatedAt: ISODate("2025-01-23...")
}
```

## ✅ რა ხდება გადახდის შემდეგ:

1. **BOG Callback** → `POST /bog/callback`
2. **Payment Record შენახვა** → MongoDB `payments` collection-ში
3. **Payment Token შენახვა** → `paymentToken` ველში (recurring payment-ებისთვის)
4. **Logs** → Backend console-ში ნახე დეტალები

## 🔍 Troubleshooting:

### Payment არ ინახება:
- შეამოწმე backend logs - უნდა ხედავდე callback-ის მიღებას
- შეამოწმე MongoDB connection
- შეამოწმე callback URL BOG-ში

### Payment Token არ ინახება:
- შეამოწმე რომ payment record არსებობს
- შეამოწმე `savePaymentToken` method-ი

### User ID არასწორია:
- შეამოწმე `external_order_id` format-ი
- Pattern: `test_payment_{timestamp}_{userId}` ან `carapp_{timestamp}_{userId}`

