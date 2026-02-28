#!/bin/bash

# Script to extract upload certificate from EAS keystore
# Usage: ./get-upload-certificate.sh <keystore-file.jks> <keystore-password>

if [ -z "$1" ] || [ -z "$2" ]; then
    echo "Usage: ./get-upload-certificate.sh <keystore-file.jks> <keystore-password>"
    echo ""
    echo "Steps:"
    echo "1. Download keystore from EAS: eas credentials -> Download existing keystore"
    echo "2. Select: Build Credentials JsmQmXGXYB (new keystore)"
    echo "3. Run this script with the downloaded keystore file and password"
    exit 1
fi

KEYSTORE_FILE=$1
KEYSTORE_PASSWORD=$2
KEY_ALIAS="202a37172548dad169deca918644e02c"
OUTPUT_FILE="upload_certificate.pem"

echo "🔐 Extracting certificate from keystore..."
keytool -export -rfc \
    -keystore "$KEYSTORE_FILE" \
    -alias "$KEY_ALIAS" \
    -storepass "$KEYSTORE_PASSWORD" \
    -file "$OUTPUT_FILE"

if [ $? -eq 0 ]; then
    echo "✅ Certificate extracted successfully: $OUTPUT_FILE"
    echo ""
    echo "📋 Certificate fingerprints:"
    keytool -printcert -file "$OUTPUT_FILE" | grep -E "(SHA1|SHA-1):"
    echo ""
    echo "📤 Next step: Upload this certificate to Google Play Console:"
    echo "   Release -> Setup -> App signing -> Request upload key reset"
else
    echo "❌ Failed to extract certificate"
    exit 1
fi
