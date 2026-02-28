#!/bin/bash

# Script to convert .der certificate to .pem and check fingerprint
# Usage: ./convert_der_to_pem.sh <certificate.der>

if [ -z "$1" ]; then
    echo "Usage: ./convert_der_to_pem.sh <certificate.der>"
    echo ""
    echo "Example:"
    echo "  ./convert_der_to_pem.sh upload_certificate.der"
    exit 1
fi

DER_FILE=$1
PEM_FILE="${DER_FILE%.der}.pem"
EXPECTED_SHA1="BE:30:25:FB:07:79:91:E0:89:40:B6:F8:2F:D6:95:48:1F:09:44:DA"

if [ ! -f "$DER_FILE" ]; then
    echo "❌ ფაილი არ მოიძებნა: $DER_FILE"
    exit 1
fi

echo "🔄 .der ფაილის PEM-ში გადაქცევა..."
openssl x509 -inform DER -in "$DER_FILE" -out "$PEM_FILE" -outform PEM

if [ $? -eq 0 ]; then
    echo "✅ Certificate გადაქცეულია: $PEM_FILE"
    echo ""
    echo "📋 Certificate Fingerprints:"
    keytool -printcert -file "$PEM_FILE" | grep -E "(SHA1|SHA-1):"
    echo ""
    
    ACTUAL_SHA1=$(keytool -printcert -file "$PEM_FILE" 2>/dev/null | grep -i "SHA1:" | awk '{print $2}')
    
    if [ "$ACTUAL_SHA1" = "$EXPECTED_SHA1" ]; then
        echo "✅ ✅ ✅ FINGERPRINT ემთხვევა!"
        echo "   Expected: $EXPECTED_SHA1"
        echo "   Actual:   $ACTUAL_SHA1"
        echo ""
        echo "🎉 ეს არის სწორი certificate!"
    else
        echo "⚠️  Fingerprint არ ემთხვევა:"
        echo "   Expected: $EXPECTED_SHA1"
        echo "   Actual:   $ACTUAL_SHA1"
    fi
else
    echo "❌ გადაქცევა ვერ მოხერხდა"
    exit 1
fi
