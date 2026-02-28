# Keystore-ის შემოწმება

## მიმდინარე სიტუაცია

**Google Play Console-ში Expected Upload Key SHA1:**
```
BE:30:25:FB:07:79:91:E0:89:40:B6:F8:2F:D6:95:48:1F:09:44:DA
```

**EAS-ში ძველი Keystore SHA1:**
```
13:A3:8F:DC:9C:15:D1:BB:EB:7D:DC:0E:A7:99:26:4B:3A:A4:7C:2E
```
❌ **არ ემთხვევა**

## როგორ ვიპოვოთ სწორი keystore

### ვარიანტი 1: Google Play Console-დან Certificate-ის ჩამოტვირთვა

1. Google Play Console-ში გადადით **Release** → **Setup** → **App signing**
2. **"Upload key certificate"** განყოფილებაში დააჭირეთ **"Download certificate"** ღილაკს
3. ჩამოტვირთეთ certificate ფაილი (PEM ფორმატი)
4. შეამოწმეთ fingerprint:
   ```bash
   keytool -printcert -file <downloaded-certificate.pem> | grep SHA1
   ```
5. უნდა იყოს: `BE:30:25:FB:07:79:91:E0:89:40:B6:F8:2F:D6:95:48:1F:09:44:DA`

### ვარიანტი 2: ლოკალური Keystore-ების შემოწმება

თუ გაქვთ keystore password-ები, შეამოწმეთ:

```bash
# @martegeo__marte_OLD_1.jks
keytool -list -v -keystore "@martegeo__marte_OLD_1.jks" -storepass "<password>" | grep SHA1

# android/app/marte-release.keystore
keytool -list -v -keystore "android/app/marte-release.keystore" -storepass "<password>" | grep SHA1
```

### ვარიანტი 3: Upload Key Reset (რეკომენდირებული)

თუ სწორი keystore ვერ იპოვნეთ:
1. გააგრძელეთ **Upload Key Reset** პროცესი Google Play Console-ში
2. ატვირთეთ ახალი `upload_certificate.pem` (უკვე მზადაა)
3. დაელოდეთ Google-ის approval-ს (24-48 საათი)
4. შემდეგ გაუშვით ახალი build

## რეკომენდაცია

**სწრაფი გზა:** გააგრძელეთ Upload Key Reset პროცესი - ეს არის ყველაზე საიმედო გზა.

**დროის დაზოგვა:** თუ გაქვთ keystore password-ები, შეამოწმეთ ლოკალური keystore-ები.
