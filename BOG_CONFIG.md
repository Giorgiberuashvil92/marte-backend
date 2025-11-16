# BOG გადახდების API კონფიგურაცია

## Environment Variables

შექმენით `.env` ფაილი backend-v2 დირექტორიაში და დაამატეთ შემდეგი ცვლადები:

```env
# BOG Payment API Configuration
BOG_API_URL=https://api.bog.ge
BOG_MERCHANT_ID=your_merchant_id_here
BOG_SECRET_KEY=your_secret_key_here
```

## BOG API ინტეგრაციის ნაბიჯები

### 1. BOG-ში რეგისტრაცია
- დარეგისტრირდით BOG Business Manager-ში
- მიიღეთ Merchant ID და Secret Key
- დააყენეთ callback URL: `https://your-domain.com/bog/callback`

### 2. API Endpoints

#### Frontend (React Native)
- `bogApi.createPaymentRequest()` - გადახდის მოთხოვნის შექმნა
- `bogApi.saveCardForFuturePayments()` - ბარათის დამახსოვრება
- `bogApi.payWithSavedCard()` - დამახსოვრებული ბარათით გადახდა
- `bogApi.refundPayment()` - თანხის დაბრუნება

#### Backend (NestJS)
- `POST /bog/create-payment` - გადახდის მოთხოვნის შექმნა
- `POST /bog/callback` - BOG callback handler
- `POST /bog/save-card` - ბარათის დამახსოვრება
- `POST /bog/pay-with-saved-card` - დამახსოვრებული ბარათით გადახდა
- `POST /bog/refund` - თანხის დაბრუნება
- `GET /bog/payment-status/:orderId` - გადახდის სტატუსის შემოწმება

### 3. გადახდის პროცესი

1. **Frontend**: მომხმარებელი ირჩევს BOG გადახდას
2. **Backend**: შეიქმნება გადახდის მოთხოვნა BOG API-ში
3. **BOG**: მომხმარებელი გადამისამართდება BOG გადახდის გვერდზე
4. **BOG**: გადახდის დასრულების შემდეგ callback გაიგზავნება backend-ში
5. **Backend**: შეკვეთის სტატუსი განახლდება და შეტყობინება გაიგზავნება

### 4. ტესტირება

#### Development რეჟიმი
```bash
# Backend გაშვება
cd backend-v2
npm run start:dev

# Frontend გაშვება
npm start
```

#### Production რეჟიმი
```bash
# Backend build
cd backend-v2
npm run build
npm run start:prod
```

### 5. უსაფრთხოება

- **HTTPS**: ყველა API call უნდა იყოს HTTPS-ზე
- **Signature Validation**: ყველა BOG callback ვალიდირდება signature-ით
- **Environment Variables**: Secret keys არასდროს არ უნდა იყოს hardcoded
- **Error Handling**: ყველა API call-ს უნდა ჰქონდეს proper error handling

### 6. მონიტორინგი

- BOG API response times
- Callback success/failure rates
- Payment completion rates
- Error logs და debugging

### 7. მომავალი გაუმჯობესებები

- [ ] ბარათის დამახსოვრების UI
- [ ] გადახდების ისტორიის გვერდი
- [ ] Refund ფუნქციონალი
- [ ] Push notifications გადახდის სტატუსისთვის
- [ ] Analytics და reporting
