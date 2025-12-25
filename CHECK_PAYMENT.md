# 🔍 Payment-ის შემოწმება

## Order ID: `108d8d1f-aa06-4575-a807-ebd0cacb45a8`

### 1. **Backend Logs-ში შემოწმება:**

Backend console-ში უნდა ხედავდე:
```
🔄 BOG CALLBACK მიღებულია - დეტალური ინფორმაცია:
📊 გადახდის დეტალები:
   • Order ID: 108d8d1f-aa06-4575-a807-ebd0cacb45a8
   • Status: completed
```

### 2. **API-დან შემოწმება:**

```bash
# Payment-ის შემოწმება Order ID-ით
curl http://localhost:3000/api/payments/order/108d8d1f-aa06-4575-a807-ebd0cacb45a8

# ან production-ზე
curl https://marte-backend-production.up.railway.app/api/payments/order/108d8d1f-aa06-4575-a807-ebd0cacb45a8
```

### 3. **MongoDB-ში შემოწმება:**

```javascript
// MongoDB Compass ან mongo shell-ში
db.payments.findOne({ orderId: "108d8d1f-aa06-4575-a807-ebd0cacb45a8" })

// ან ბოლო გადახდები
db.payments.find().sort({ createdAt: -1 }).limit(5)
```

### 4. **Callback URL-ის შემოწმება:**

BOG-მა უნდა გამოიძახოს:
```
POST https://carappx.onrender.com/bog/callback
```

ან თუ Railway-ზეა:
```
POST https://marte-backend-production.up.railway.app/bog/callback
```

## 🔍 Troubleshooting:

### თუ Payment არ ინახება:

1. **შეამოწმე Backend Logs:**
   - უნდა ხედავდე `🔄 BOG CALLBACK მიღებულია`
   - თუ არ ხედავ, callback არ მოდის

2. **შეამოწმე Callback URL BOG-ში:**
   - BOG Dashboard-ში უნდა იყოს სწორი callback URL
   - `https://carappx.onrender.com/bog/callback` ან
   - `https://marte-backend-production.up.railway.app/bog/callback`

3. **შეამოწმე MongoDB Connection:**
   - Backend logs-ში უნდა ხედავდე MongoDB connection success

4. **შეამოწმე Error Logs:**
   - Backend logs-ში ძებნა `❌` ან `ERROR`

## 📝 რა უნდა მოხდეს:

1. ✅ Frontend: გადახდა წარმატებულია (`✅ BOG Success URL detected!`)
2. ⏳ BOG: გამოიძახებს callback URL-ს
3. ⏳ Backend: იღებს callback-ს და ინახავს payment-ს
4. ⏳ Database: payment ინახება `payments` collection-ში

## 🔗 სწრაფი შემოწმება:

```bash
# 1. Backend logs-ში ძებნა
grep "108d8d1f-aa06-4575-a807-ebd0cacb45a8" backend-logs.txt

# 2. API-დან შემოწმება
curl https://marte-backend-production.up.railway.app/api/payments/order/108d8d1f-aa06-4575-a807-ebd0cacb45a8

# 3. MongoDB-ში შემოწმება
mongo "mongodb+srv://..." --eval "db.payments.findOne({ orderId: '108d8d1f-aa06-4575-a807-ebd0cacb45a8' })"
```

