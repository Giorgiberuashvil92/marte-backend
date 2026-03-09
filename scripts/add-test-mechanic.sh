#!/bin/bash
# სატესტოდ მექანიკოსის დამატება curl-ით
# შეცვალე YOUR_USER_ID ჩემს იუზერის ID-ით (აპიდან: პროფილი ან DevTools/console - user.id)

API_URL="${API_URL:-http://localhost:3000}"
USER_ID="${1:-usr_1771418839301}"

if [ "$USER_ID" = "YOUR_USER_ID" ]; then
  echo "⚠️  გამოიყენე: ./scripts/add-test-mechanic.sh <tvoj_user_id>"
  echo "   ან: USER_ID=xxx ./scripts/add-test-mechanic.sh"
  echo "   user.id შეგიძლია იხილო აპიდან (პროფილი/კონსოლი)."
  exit 1
fi

curl -s -X POST "$API_URL/mechanics" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"სატესტო მექანიკოსი\",
    \"specialty\": \"საბურავების შეცვლა და ბალანსირება\",
    \"location\": \"თბილისი\",
    \"phone\": \"+995557422634\",
    \"address\": \"ვარკეთილი, ქ. თბილისი\",
    \"description\": \"სატესტო განცხადება curl-ით\",
    \"ownerId\": \"$USER_ID\"
  }" | jq .

# jq არ არის საჭირო; თუ არ გაქვს: curl ... (უბრალოდ წაშალე "| jq .")

# --- ან ერთი ბრძანება (შეცვალე YOUR_USER_ID): ---
# curl -X POST http://localhost:3000/mechanics -H "Content-Type: application/json" -d '{"name":"სატესტო მექანიკოსი","specialty":"საბურავების შეცვლა","location":"თბილისი","phone":"+995555123456","ownerId":"YOUR_USER_ID"}'
