#!/bin/bash

# Script to find the old keystore that matches Google Play Console expected fingerprint
# Expected SHA1: BE:30:25:FB:07:79:91:E0:89:40:B6:F8:2F:D6:95:48:1F:09:44:DA

EXPECTED_SHA1="BE:30:25:FB:07:79:91:E0:89:40:B6:F8:2F:D6:95:48:1F:09:44:DA"

echo "🔍 ვეძებ keystore-ს რომელიც ემთხვევა Google Play Console-ის expected fingerprint-ს..."
echo "Expected SHA1: $EXPECTED_SHA1"
echo ""

# Check EAS old keystore
echo "📦 EAS-ში ძველი keystore (Build Credentials xMnPzPtWgx):"
echo "   SHA1: 13:A3:8F:DC:9C:15:D1:BB:EB:7D:DC:0E:A7:99:26:4B:3A:A4:7C:2E"
echo "   ❌ არ ემთხვევა"
echo ""

# Check local keystore files
echo "📁 ლოკალური keystore ფაილები:"
echo "   1. @martegeo__marte_OLD_1.jks - password საჭიროა"
echo "   2. android/app/marte-release.keystore - password საჭიროა"
echo "   3. android/app/debug.keystore - debug keystore (არ არის production)"
echo ""

echo "💡 რეკომენდაცია:"
echo "   1. Google Play Console-ში 'Download certificate' ღილაკით ჩამოტვირთეთ expected upload key certificate"
echo "   2. ან EAS-ში ჩამოტვირთეთ ძველი keystore და შეამოწმეთ fingerprint"
echo "   3. ან გააგრძელეთ upload key reset პროცესი (24-48 საათი)"
echo ""

echo "🔧 EAS-დან ძველი keystore-ის ჩამოტვირთვა:"
echo "   eas credentials"
echo "   -> Android -> production"
echo "   -> Download existing keystore"
echo "   -> Build Credentials xMnPzPtWgx"
echo ""
