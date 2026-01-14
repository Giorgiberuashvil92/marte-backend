#!/bin/bash

# Notification Test Script
# გამოიყენე: ./test-notifications.sh <userId> [partnerId]

BASE_URL="http://localhost:3000"
# ან production-ზე: BASE_URL="https://marte-backend-production.up.railway.app"

USER_ID=${1:-"usr_1768307687941"}
PARTNER_ID=${2:-"partner_test_123"}

echo "🧪 Testing notifications for userId: $USER_ID"
echo ""

# 1. Garage Reminder
echo "1️⃣ Testing Garage Reminder..."
curl -X POST "$BASE_URL/notifications/test/garage-reminder" \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"$USER_ID\"}"
echo -e "\n"

# 2. Chat Message
echo "2️⃣ Testing Chat Message..."
curl -X POST "$BASE_URL/notifications/test/chat-message" \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"$USER_ID\", \"offerId\": \"test_offer_123\"}"
echo -e "\n"

# 3. Carwash Booking
echo "3️⃣ Testing Carwash Booking..."
curl -X POST "$BASE_URL/notifications/test/carwash-booking" \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"$USER_ID\", \"carwashId\": \"test_carwash_123\"}"
echo -e "\n"

# 4. New Request
echo "4️⃣ Testing New Request..."
curl -X POST "$BASE_URL/notifications/test/new-request" \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"$USER_ID\", \"requestId\": \"test_request_123\"}"
echo -e "\n"

# 5. New Offer
echo "5️⃣ Testing New Offer..."
curl -X POST "$BASE_URL/notifications/test/new-offer" \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"$USER_ID\"}"
echo -e "\n"

# 6. Subscription
echo "6️⃣ Testing Subscription..."
curl -X POST "$BASE_URL/notifications/test/subscription" \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"$USER_ID\"}"
echo -e "\n"

# 7. AI Recommendation
echo "7️⃣ Testing AI Recommendation..."
curl -X POST "$BASE_URL/notifications/test/ai-recommendation" \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"$USER_ID\", \"requestId\": \"test_request_123\"}"
echo -e "\n"

# 8. Business Offer
echo "8️⃣ Testing Business Offer..."
curl -X POST "$BASE_URL/notifications/test/business-offer" \
  -H "Content-Type: application/json" \
  -d "{\"partnerId\": \"$PARTNER_ID\", \"requestId\": \"test_request_123\", \"offerId\": \"test_offer_123\"}"
echo -e "\n"

# 9. Business Request
echo "9️⃣ Testing Business Request..."
curl -X POST "$BASE_URL/notifications/test/business-request" \
  -H "Content-Type: application/json" \
  -d "{\"partnerId\": \"$PARTNER_ID\", \"requestId\": \"test_request_123\"}"
echo -e "\n"

echo "✅ All test notifications sent!"
echo ""
echo "📱 Check your mobile app to verify navigation for each notification type:"
echo "   1. Garage Reminder → /(tabs)/garage"
echo "   2. Chat Message → /chat/[offerId]"
echo "   3. Carwash Booking → /bookings/[carwashId]"
echo "   4. New Request → /offers/[requestId]"
echo "   5. New Offer → /all-requests"
echo "   6. Subscription → / (with premium modal)"
echo "   7. AI Recommendation → /all-requests"
echo "   8. Business Offer → /partner-chat/[requestId]"
echo "   9. Business Request → /partner-chat/[requestId]"

