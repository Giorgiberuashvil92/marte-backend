# 🧪 Notification Testing Guide

ეს გზამკვლევი გეხმარება ყველა notification type-ის ტესტირებაში და navigation-ის შემოწმებაში.

## 📋 Test Endpoints

ყველა test endpoint მდებარეობს `/notifications/test/` path-ზე:

### User Notifications

1. **Garage Reminder** - `POST /notifications/test/garage-reminder`
   - Navigation: `/(tabs)/garage`
   - Data: `{ userId: string }`

2. **Chat Message** - `POST /notifications/test/chat-message`
   - Navigation: `/chat/[offerId]`
   - Data: `{ userId: string, offerId?: string }`

3. **Carwash Booking** - `POST /notifications/test/carwash-booking`
   - Navigation: `/bookings/[carwashId]`
   - Data: `{ userId: string, carwashId?: string }`

4. **New Request** - `POST /notifications/test/new-request`
   - Navigation: `/offers/[requestId]`
   - Data: `{ userId: string, requestId?: string }`

5. **New Offer** - `POST /notifications/test/new-offer`
   - Navigation: `/all-requests`
   - Data: `{ userId: string }`

6. **Subscription** - `POST /notifications/test/subscription`
   - Navigation: `/` (with premium modal)
   - Data: `{ userId: string }`

7. **AI Recommendation** - `POST /notifications/test/ai-recommendation`
   - Navigation: `/all-requests`
   - Data: `{ userId: string, requestId?: string }`

### Business Notifications

8. **Business Offer** - `POST /notifications/test/business-offer`
   - Navigation: `/partner-chat/[requestId]`
   - Data: `{ partnerId: string, requestId?: string, offerId?: string }`

9. **Business Request** - `POST /notifications/test/business-request`
   - Navigation: `/partner-chat/[requestId]`
   - Data: `{ partnerId: string, requestId?: string }`

## 🚀 Quick Test

### Option 1: Script-ის გამოყენება

```bash
cd marte-backend
./test-notifications.sh <userId> [partnerId]
```

მაგალითი:
```bash
./test-notifications.sh usr_1768307687941 partner_test_123
```

### Option 2: Manual curl commands

```bash
# Garage Reminder
curl -X POST "http://localhost:3000/notifications/test/garage-reminder" \
  -H "Content-Type: application/json" \
  -d '{"userId": "usr_1768307687941"}'

# Chat Message
curl -X POST "http://localhost:3000/notifications/test/chat-message" \
  -H "Content-Type: application/json" \
  -d '{"userId": "usr_1768307687941", "offerId": "test_offer_123"}'

# Carwash Booking
curl -X POST "http://localhost:3000/notifications/test/carwash-booking" \
  -H "Content-Type: application/json" \
  -d '{"userId": "usr_1768307687941", "carwashId": "test_carwash_123"}'

# New Request
curl -X POST "http://localhost:3000/notifications/test/new-request" \
  -H "Content-Type: application/json" \
  -d '{"userId": "usr_1768307687941", "requestId": "test_request_123"}'

# New Offer
curl -X POST "http://localhost:3000/notifications/test/new-offer" \
  -H "Content-Type: application/json" \
  -d '{"userId": "usr_1768307687941"}'

# Subscription
curl -X POST "http://localhost:3000/notifications/test/subscription" \
  -H "Content-Type: application/json" \
  -d '{"userId": "usr_1768307687941"}'

# AI Recommendation
curl -X POST "http://localhost:3000/notifications/test/ai-recommendation" \
  -H "Content-Type: application/json" \
  -d '{"userId": "usr_1768307687941", "requestId": "test_request_123"}'

# Business Offer
curl -X POST "http://localhost:3000/notifications/test/business-offer" \
  -H "Content-Type: application/json" \
  -d '{"partnerId": "partner_test_123", "requestId": "test_request_123", "offerId": "test_offer_123"}'

# Business Request
curl -X POST "http://localhost:3000/notifications/test/business-request" \
  -H "Content-Type: application/json" \
  -d '{"partnerId": "partner_test_123", "requestId": "test_request_123"}'
```

## 📱 Testing Checklist

ყოველი notification-ისთვის შეამოწმე:

- [ ] Notification მოდის მობილურზე
- [ ] Notification-ზე დაკლიკებისას სწორ გვერდზე გადადის
- [ ] URL-ები სწორია
- [ ] Data-ები სწორად გადაეცემა
- [ ] Navigation logic მუშაობს

## 🔍 Expected Navigation Routes

| Notification Type | Expected Route |
|------------------|----------------|
| garage_reminder | `/(tabs)/garage` |
| chat_message | `/chat/[offerId]` |
| carwash_booking_reminder | `/bookings/[carwashId]` |
| new_request | `/offers/[requestId]` |
| new_offer | `/all-requests` |
| subscription_activated | `/` (with premium modal) |
| ai_recommendation | `/all-requests` |
| offer (business) | `/partner-chat/[requestId]` |
| request (business) | `/partner-chat/[requestId]` |

## 🐛 Troubleshooting

თუ notification-ები არ მოდის:
1. შეამოწმე, რომ device token დარეგისტრირებულია
2. შეამოწმე Firebase configuration
3. შეამოწმე backend logs
4. შეამოწმე, რომ userId/partnerId სწორია

თუ navigation არ მუშაობს:
1. შეამოწმე console logs frontend-ში
2. შეამოწმე notification data structure
3. შეამოწმე navigation logic NotificationsModal-ში

