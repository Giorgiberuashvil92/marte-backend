# EAS-იდან Keystore-ის ჩამოტვირთვა - სწრაფი გზა

## Command:

```bash
eas credentials
```

## ნაბიჯები:

1. **Platform:**
   ```
   ✔ Select platform › Android
   ```

2. **Build Profile:**
   ```
   ✔ Which build profile do you want to configure? › production
   ```

3. **Action:**
   ```
   ✔ What do you want to do? › Keystore: Manage everything needed to build your project
   ```

4. **Download:**
   ```
   ✔ What do you want to do? › Download existing keystore
   ```

5. **Select Credentials:**
   - **Build Credentials JsmQmXGXYB** (ახალი, default)
   - **Build Credentials xMnPzPtWgx** (ძველი)

6. **Show Sensitive Info:**
   ```
   ✔ Do you want to display the sensitive information of the Android Keystore? … yes
   ```

## რა მიიღებთ:

- **Keystore ფაილი:** `@martegeo__marte.jks` (პროექტის root-ში)
- **Keystore Password:** (EAS აჩვენებს)
- **Key Alias:** (EAS აჩვენებს)
- **Key Password:** (EAS აჩვენებს)
- **Fingerprints:** SHA1, SHA256 (EAS აჩვენებს)

## Fingerprint-ის შემოწმება:

```bash
keytool -list -v -keystore "@martegeo__marte.jks" -storepass "<password>" | grep SHA1
```

## ⚠️ მნიშვნელოვანი:

- Keystore password და key password **ინახეთ უსაფრთხოდ**
- Keystore ფაილი **არასოდეს არ commit-თ** git-ში
- გააკეთეთ **backup** keystore-ის
