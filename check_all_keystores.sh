#!/bin/bash

# Script to check all keystores for matching fingerprint
# Expected SHA1: BE:30:25:FB:07:79:91:E0:89:40:B6:F8:2F:D6:95:48:1F:09:44:DA

EXPECTED_SHA1="BE:30:25:FB:07:79:91:E0:89:40:B6:F8:2F:D6:95:48:1F:09:44:DA"

echo "🔍 ვეძებ keystore-ს რომელიც ემთხვევა fingerprint-ს:"
echo "Expected SHA1: $EXPECTED_SHA1"
echo ""

echo "📦 EAS-ში ძველი keystore (Build Credentials xMnPzPtWgx):"
echo "   SHA1: 13:A3:8F:DC:9C:15:D1:BB:EB:7D:DC:0E:A7:99:26:4B:3A:A4:7C:2E"
if [ "13:A3:8F:DC:9C:15:D1:BB:EB:7D:DC:0E:A7:99:26:4B:3A:A4:7C:2E" = "$EXPECTED_SHA1" ]; then
    echo "   ✅ ემთხვევა!"
else
    echo "   ❌ არ ემთხვევა"
fi
echo ""

echo "📁 ლოკალური keystore ფაილები:"
echo "   1. @martegeo__marte_OLD_1.jks - password საჭიროა"
echo "   2. android/app/marte-release.keystore - password საჭიროა"
echo "   3. android/app/debug.keystore - SHA1: 5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25"
if [ "5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25" = "$EXPECTED_SHA1" ]; then
    echo "      ✅ ემთხვევა!"
else
    echo "      ❌ არ ემთხვევა (debug keystore)"
fi
echo ""

echo "💡 რეკომენდაცია:"
echo "   თუ გაქვთ keystore password-ები, შეამოწმეთ:"
echo ""
echo "   keytool -list -v -keystore '@martegeo__marte_OLD_1.jks' -storepass '<password>' | grep SHA1"
echo "   keytool -list -v -keystore 'android/app/marte-release.keystore' -storepass '<password>' | grep SHA1"
echo ""
echo "   ან გააგრძელეთ Upload Key Reset პროცესი Google Play Console-ში (24-48 საათი)"
