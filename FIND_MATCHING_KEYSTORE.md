# სწორი Keystore-ის პოვნა

## ✅ Certificate ნაპოვნია!

**Upload Key Certificate SHA1:** `BE:30:25:FB:07:79:91:E0:89:40:B6:F8:2F:D6:95:48:1F:09:44:DA`

ეს არის Google Play Console-ში expected upload key certificate.

## როგორ ვიპოვოთ შესაბამისი keystore

### ვარიანტი 1: EAS-ში Keystore-ის შემოწმება

EAS-ში ძველი keystore (Build Credentials xMnPzPtWgx) SHA1:
```
13:A3:8F:DC:9C:15:D1:BB:EB:7D:DC:0E:A7:99:26:4B:3A:A4:7C:2E
```
❌ **არ ემთხვევა**

### ვარიანტი 2: ლოკალური Keystore-ების შემოწმება

თუ გაქვთ keystore password-ები, შეამოწმეთ:

```bash
# @martegeo__marte_OLD_1.jks
keytool -list -v -keystore "@martegeo__marte_OLD_1.jks" -storepass "<password>" | grep SHA1

# android/app/marte-release.keystore  
keytool -list -v -keystore "android/app/marte-release.keystore" -storepass "<password>" | grep SHA1
```

### ვარიანტი 3: EAS-ში Keystore-ის შეცვლა Certificate-ით

თუ keystore ვერ იპოვნეთ, შეგიძლიათ:
1. EAS-ში გადადით credentials
2. აირჩიეთ "Change default keystore"
3. ატვირთეთ certificate (upload_cert.pem)

**მაგრამ** ეს არ იმუშავებს, რადგან certificate-ს არ შეგიძლიათ keystore-ად გადაქცევა (certificate არის public key, keystore-ს სჭირდება private key).

### ვარიანტი 4: Upload Key Reset (რეკომენდირებული)

რადგან keystore-ს ვერ ვიპოვნეთ:
1. გააგრძელეთ **Upload Key Reset** პროცესი Google Play Console-ში
2. ატვირთეთ ახალი `upload_certificate.pem` (ახალი keystore-ის certificate)
3. დაელოდეთ Google-ის approval-ს (24-48 საათი)

## რეკომენდაცია

**სწრაფი გზა:** გააგრძელეთ Upload Key Reset - ეს არის ყველაზე საიმედო გზა.

**დროის დაზოგვა:** თუ გაქვთ keystore password-ები, შეამოწმეთ ლოკალური keystore-ები.
