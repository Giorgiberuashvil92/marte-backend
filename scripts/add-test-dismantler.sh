#!/bin/bash
# სატესტოდ დაშლილის განცხადების დამატება curl-ით (ფოტოთი)
# გამოყენება: ./scripts/add-test-dismantler.sh [user_id]

API_URL="${API_URL:-http://localhost:3000}"
USER_ID="${1:-usr_1771418839301}"

if [ "$USER_ID" = "YOUR_USER_ID" ]; then
  echo "⚠️  გამოიყენე: ./scripts/add-test-dismantler.sh <tvoj_user_id>"
  echo "   ან: USER_ID=xxx ./scripts/add-test-dismantler.sh"
  exit 1
fi

# ფოტო URL (სატესტოდ)
PHOTO_URL="https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800"

curl -s -X POST "$API_URL/dismantlers" \
  -H "Content-Type: application/json" \
  -H "x-user-id: $USER_ID" \
  -d "{
    \"brand\": \"Toyota\",
    \"model\": \"Camry\",
    \"yearFrom\": 2015,
    \"yearTo\": 2020,
    \"name\": \"სატესტო დაშლილი Toyota Camry\",
    \"description\": \"სატესტო დაშლილის განცხადება curl-ით. Toyota Camry 2015-2020, ნაწილები.\",
    \"location\": \"თბილისი\",
    \"phone\": \"+995557422634\",
    \"photos\": [\"$PHOTO_URL\"],
    \"ownerId\": \"$USER_ID\"
  }" | jq .

# ბექენდი x-user-id ჰედერიდან იღებს ownerId-ს, მაგრამ body-შიც ვაგზავნით.
