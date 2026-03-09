#!/bin/bash
# სატესტოდ მაღაზიის დამატება curl-ით (ფოტოთი)
# გამოყენება: ./scripts/add-test-store.sh [user_id]

API_URL="${API_URL:-http://localhost:3000}"
USER_ID="${1:-usr_1771418839301}"

if [ "$USER_ID" = "YOUR_USER_ID" ]; then
  echo "⚠️  გამოიყენე: ./scripts/add-test-store.sh <tvoj_user_id>"
  echo "   ან: USER_ID=xxx ./scripts/add-test-store.sh"
  exit 1
fi

# ფოტო URL (სატესტოდ - ღია სურათი)
PHOTO_URL="https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=800"

curl -s -X POST "$API_URL/stores" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"სატესტო ავტომაღაზია\",
    \"name\": \"სატესტო მაღაზია\",
    \"description\": \"სატესტო მაღაზია curl-ით, ფოტოთი. ავტონაწილები, საბურავები, ზეთები.\",
    \"type\": \"მაღაზიები\",
    \"location\": \"თბილისი\",
    \"address\": \"ვარკეთილი, ქ. თბილისი\",
    \"phone\": \"+995557422634\",
    \"workingHours\": \"09:00 - 19:00\",
    \"ownerId\": \"$USER_ID\",
    \"images\": [\"$PHOTO_URL\"]
  }" | jq .

# jq არ არის საჭირო; თუ არ გაქვს: წაშალე "| jq ."
