# EAS-იდან Keystore-ის ჩამოტვირთვა

## ნაბიჯები:

### 1. EAS Credentials-ის გახსნა:

```bash
eas credentials
```

### 2. პლატფორმის არჩევა:

```
✔ Select platform › Android
```

### 3. Build Profile-ის არჩევა:

```
✔ Which build profile do you want to configure? › production
```

### 4. Keystore-ის ჩამოტვირთვა:

```
✔ What do you want to do? › Download existing keystore
```

### 5. Build Credentials-ის არჩევა:


შეამოწმეთ ორივე keystore:
- **Build Credentials JsmQmXGXYB** (ახალი, default)
- **Build Credentials xMnPzPtWgx** (ძველი)

ჯერ ჩამოტვირთეთ **Build Credentials xMnPzPtWgx** (ძველი) და შეამოწმეთ fingerprint.

### 6. Sensitive Information-ის ჩვენება:

```
✔ Do you want to display the sensitive information of the Android Keystore? … yes
```

ეს აჩვენებს:
- Keystore password
- Key alias
- Key password
- Certificate fingerprints

### 7. Fingerprint-ის შემოწმება:

შეამოწმეთ SHA1 fingerprint - უნდა იყოს:
```
BE:30:25:FB:07:79:91:E0:89:40:B6:F8:2F:D6:95:48:1F:09:44:DA
```

## სრული Command Sequence:

```bash
# 1. EAS credentials-ის გახსნა
eas credentials

# შემდეგ აირჩიეთ:
# - Android
# - production
# - Download existing keystore
# - Build Credentials xMnPzPtWgx (ძველი)
# - yes (sensitive information-ის ჩვენება)
```

## Fingerprint-ის შემოწმება ჩამოტვირთული Keystore-ისთვის:

```bash
keytool -list -v -keystore "<downloaded-keystore.jks>" -storepass "<password>" | grep SHA1
```

## თუ Fingerprint ემთხვევა:

თუ SHA1 fingerprint არის `BE:30:25:FB:07:79:91:E0:89:40:B6:F8:2F:D6:95:48:1F:09:44:DA`:
1. ეს არის სწორი keystore!
2. EAS-ში შეცვალეთ default keystore ამ keystore-ზე
3. გაუშვით ახალი build

## თუ Fingerprint არ ემთხვევა:

გააგრძელეთ Upload Key Reset პროცესი Google Play Console-ში.
