#!/bin/bash
# 1) აიღე ტოკენი SA Identity-დან
# 2) გაუქმება DELETE /patrolpenalties/vehicles/{id}
# გამოყენება: SA_CLIENT_SECRET='თქვენი_საიდუმლო' ./curl-delete-vehicle.sh 830119

set -e
ID="${1:-830119}"
SA_CLIENT_ID="${SA_CLIENT_ID:-martegeo}"
SA_CLIENT_SECRET="${SA_CLIENT_SECRET:?დააყენე SA_CLIENT_SECRET env ან ჩაწერე ქვემოთ}"

echo "🔐 ტოკენის მოპოვება..."
RESP=$(curl -s -X POST "https://api-identity.sa.gov.ge/connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=${SA_CLIENT_ID}&client_secret=${SA_CLIENT_SECRET}&grant_type=client_credentials")

TOKEN=$(echo "$RESP" | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p')
if [ -z "$TOKEN" ]; then
  echo "❌ ტოკენი ვერ მოვიპოვეთ: $RESP"
  exit 1
fi
echo "✅ ტოკენი მიღებულია"

echo "🗑️ მანქანის გაუქმება (Id=$ID)..."
curl -s -w "\nHTTP %{http_code}\n" -X DELETE \
  "https://api-public.sa.gov.ge/api/v1/patrolpenalties/vehicles/${ID}" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}"
echo ""
