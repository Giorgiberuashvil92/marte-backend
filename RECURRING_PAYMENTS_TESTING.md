# 🔄 Recurring Payments ტესტირების ინსტრუქცია

## 📋 რა გვჭირდება:

1. **Backend გაშვებული** (`npm run start:dev`)
2. **MongoDB კავშირი**
3. **BOG API credentials** (production-ში)

---

## 🧪 ტესტირების ნაბიჯები:

### 1. Test Subscription-ის შექმნა

#### ვარიანტი A: Script-ის გამოყენება

```bash
cd marte-backend
node test-recurring-payments.js
```

ეს სკრიპტი:
- ქმნის test subscription-ს
- ამოწმებს API endpoints-ებს
- აჩვენებს subscription-ის და payment-ების სტატუსს

#### ვარიანტი B: Manual შექმნა MongoDB-ში

```javascript
// MongoDB Compass ან mongo shell-ში
db.subscriptions.insertOne({
  userId: "test_user_123",
  planId: "premium_monthly",
  planName: "Premium Plan",
  planPrice: 50.00,
  currency: "GEL",
  period: "monthly",
  status: "active",
  startDate: new Date(),
  nextBillingDate: new Date(Date.now() - 3600000), // 1 საათის წინ
  paymentMethod: "BOG",
  bogCardToken: "test_order_id_12345", // წარმატებული გადახდის order_id
  billingCycles: 0,
  totalPaid: 0,
  createdAt: new Date(),
  updatedAt: new Date()
});
```

---

### 2. API Endpoints-ების ტესტირება

#### 2.1. Recurring Payments Status

```bash
curl http://localhost:3000/api/recurring-payments/status
```

**Response:**
```json
{
  "success": true,
  "message": "რეკურინგ გადახდების სერვისი მუშაობს",
  "cronJob": {
    "enabled": true,
    "schedule": "ყოველ საათში ერთხელ",
    "timeZone": "Asia/Tbilisi"
  }
}
```

#### 2.2. Manual Trigger (ტესტირებისთვის)

```bash
curl -X POST http://localhost:3000/api/recurring-payments/process
```

**Response:**
```json
{
  "success": true,
  "message": "რეკურინგ გადახდები წარმატებით დამუშავდა",
  "data": {
    "success": 1,
    "failed": 0,
    "total": 1
  }
}
```

#### 2.3. BOG Recurring Payment Token-ის მიღება

```bash
curl http://localhost:3000/bog/recurring-payment-token/{order_id}
```

**Response:**
```json
{
  "success": true,
  "token": "order_id_12345",
  "message": "Recurring payment token წარმატებით მიღებულია"
}
```

#### 2.4. BOG Recurring Payment (სატესტოდ)

```bash
curl -X POST http://localhost:3000/bog/recurring-payment \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "წარმატებული_გადახდის_order_id",
    "amount": 50.00,
    "currency": "GEL",
    "shop_order_id": "recurring_test_123",
    "purchase_description": "Monthly subscription"
  }'
```

**Response:**
```json
{
  "order_id": "new_order_id",
  "status": "success",
  "message": "რეკურინგ გადახდა წარმატებით განხორციელდა"
}
```

---

### 3. Payment Token-ის შენახვა

როცა პირველი გადახდა წარმატებულია, უნდა შევინახოთ `order_id` როგორც `paymentToken`:

```bash
curl -X POST http://localhost:3000/api/payments/save-token \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "წარმატებული_გადახდის_order_id",
    "paymentToken": "წარმატებული_გადახდის_order_id"
  }'
```

---

### 4. User-ის Payment Token-ის მიღება

```bash
curl http://localhost:3000/api/payments/user/{userId}/token
```

**Response:**
```json
{
  "success": true,
  "message": "Payment token retrieved successfully",
  "data": {
    "paymentToken": "order_id_12345"
  }
}
```

---

### 5. Cron Job-ის ტესტირება

#### ვარიანტი A: Cron Schedule-ის შეცვლა (ტესტირებისთვის)

`recurring-payments.service.ts`-ში შეცვალე:

```typescript
// ყოველ წუთში (ტესტირებისთვის)
@Cron(CronExpression.EVERY_MINUTE, {
  name: 'process-recurring-payments',
  timeZone: 'Asia/Tbilisi',
})
```

#### ვარიანტი B: Manual Trigger

გამოიყენე `POST /api/recurring-payments/process` endpoint.

---

## 🔍 როგორ შევამოწმოთ:

### 1. Subscription-ის შემოწმება

```javascript
// MongoDB-ში
db.subscriptions.findOne({ userId: "test_user_123" })
```

შეამოწმე:
- `status` = `active`
- `nextBillingDate` - განახლებულია
- `billingCycles` - გაიზარდა
- `totalPaid` - გაიზარდა

### 2. Payment-ების შემოწმება

```javascript
// MongoDB-ში
db.payments.find({ 
  userId: "test_user_123",
  context: "subscription"
}).sort({ paymentDate: -1 })
```

### 3. Logs-ის შემოწმება

Backend console-ში უნდა ხედავდე:
```
🔄 რეკურინგ გადახდების დამუშავება დაწყებულია...
📊 ნაპოვნია 1 subscription რეკურინგ გადახდისთვის
💳 Subscription ... გადახდის დამუშავება...
✅ Subscription ... გადახდა წარმატებით განხორციელდა
```

---

## ⚠️ მნიშვნელოვანი:

1. **BOG API**: Recurring payment endpoint მხოლოდ production-ში იმუშავებს, თუ BOG-ში გაქვს აქტივირებული recurring payments.

2. **Test Token**: `bogCardToken` უნდა იყოს წარმატებული გადახდის `order_id` BOG-დან.

3. **Next Billing Date**: ტესტირებისთვის, `nextBillingDate` დაყენე წარსულში, რომ cron job-მა მაშინვე იპოვოს.

4. **Cron Schedule**: Production-ში დატოვე `EVERY_HOUR`, ტესტირებისთვის შეგიძლია გამოიყენო `EVERY_MINUTE`.

---

## 🐛 Troubleshooting:

### Cron Job არ მუშაობს:
- შეამოწმე რომ `ScheduleModule.forRoot()` დამატებულია `RecurringPaymentsModule`-ში
- შეამოწმე logs - უნდა ხედავდე cron job-ის გაშვებას

### Recurring Payment ვერ მოხერხდა:
- შეამოწმე `bogCardToken` - უნდა იყოს წარმატებული გადახდის `order_id`
- შეამოწმე BOG OAuth token - უნდა იყოს ვალიდური
- შეამოწმე BOG API credentials

### Subscription არ მოიძებნა:
- შეამოწმე `status` = `active`
- შეამოწმე `nextBillingDate` - უნდა იყოს წარსულში ან ახლა
- შეამოწმე `bogCardToken` - უნდა არსებობდეს

---

## 📝 Test Data Example:

```javascript
{
  userId: "test_user_123",
  planId: "premium_monthly",
  planName: "Premium Plan",
  planPrice: 50.00,
  currency: "GEL",
  period: "monthly",
  status: "active",
  startDate: new Date(),
  nextBillingDate: new Date(Date.now() - 3600000), // 1 საათის წინ
  paymentMethod: "BOG",
  bogCardToken: "successful_payment_order_id_from_bog",
  billingCycles: 0,
  totalPaid: 0
}
```

---

## ✅ Success Criteria:

ტესტირება წარმატებულია, თუ:
1. ✅ Manual trigger აბრუნებს `success: true`
2. ✅ Subscription-ის `billingCycles` გაიზარდა
3. ✅ `nextBillingDate` განახლდა
4. ✅ ახალი payment შეიქმნა database-ში
5. ✅ Payment-ის `status` = `completed`

---

## 🚀 Production Checklist:

- [ ] BOG recurring payments აქტივირებულია BOG-ში
- [ ] BOG API credentials სწორია
- [ ] Cron schedule = `EVERY_HOUR` (არა `EVERY_MINUTE`)
- [ ] Timezone = `Asia/Tbilisi`
- [ ] Error handling და logging მუშაობს
- [ ] Subscription-ების cleanup (cancelled/expired)

