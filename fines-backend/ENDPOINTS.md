# Fines-backend: endpoint-ები (გამტარი → SA.gov.ge)

ფინეს ბექენდი **გამტარია**: request-ები იგივე path-ით და method-ით გადაეცემა SA.gov.ge Public API-ს; Bearer token ბექენდი თვითონ იღებს და ყოველ request-ში ამატებს.

marte-backend (Railway) ამ endpoint-ებს იძახებს. **დეველოპერმა უნდა უზრუნველყოს, რომ ყველა ქვემოთ ჩამოთვლილი path გაივლის proxy-ში** (იგივე method, query, body) და SA-დან მოსული response იგივე status და body-ით დააბრუნოს.

---

## Base URL

- **ჩვენი (fines-backend):** `https://<tvoi-domain>/api/v1` ან `http://VPS_IP:3100/api/v1`
- **SA:** `https://api-public.sa.gov.ge/api/v1`

Request: `GET https://<fines-backend>/api/v1/patrolpenalties`  
→ Proxy უგზავნის: `GET https://api-public.sa.gov.ge/api/v1/patrolpenalties` + `Authorization: Bearer <token>`.

---

## სავალდებულო endpoint-ები (რას იძახებს marte-backend)

| # | Method | Path (api/v1-ის შემდეგ) | Query / Body | დანიშნულება |
|---|--------|--------------------------|--------------|--------------|
| 1 | **GET** | `/patrolpenalties` | Query (არასავალდებულო): `AutomobileNumber`, `TechPassportNumber` | ჯარიმების სია |
| 2 | **GET** | `/PatrolPenalties/PenaltyMediaFiles` | Query: `AutomobileNumber`, `TechPassportNumber`, `ProtocolId` | ჯარიმის მედია ფაილების ლინკები |
| 3 | **POST** | `/patrolpenalties/vehicles` | Body (JSON): `VehicleNumber`, `TechPassportNumber`, `MediaFile` (boolean) | მანქანის რეგისტრაცია SA-ში |
| 4 | **GET** | `/patrolpenalties/vehicles/validatevehicle` | Query: `AutomobileNumber`, `TechPassportNumber` | მანქანის ვალიდაცია |
| 5 | **GET** | `/patrolpenalties/vehicles/active` | — | აქტიური მანქანების სია |

---

## დეტალები

### 1. GET /api/v1/patrolpenalties
- Query (ორივე ერთად ან არც ერთი): `AutomobileNumber`, `TechPassportNumber`
- Response: JSON array of penalties.

### 2. GET /api/v1/PatrolPenalties/PenaltyMediaFiles
- Query: `AutomobileNumber`, `TechPassportNumber`, `ProtocolId` (number)
- Response: JSON array of strings (media URLs).

### 3. POST /api/v1/patrolpenalties/vehicles
- Body example:  
  `{ "VehicleNumber": "MI-999-SS", "TechPassportNumber": "12345678901", "MediaFile": false }`
- Response: JSON `{ "id": number }`.
- Timeout: მხარდაჭერა 30 წამი (marte-backend 30s იგზავნის).

### 4. GET /api/v1/patrolpenalties/vehicles/validatevehicle
- Query: `AutomobileNumber`, `TechPassportNumber`
- Response: JSON boolean.

### 5. GET /api/v1/patrolpenalties/vehicles/active
- Response: JSON array of `{ id, vehicleNumber, techPassportNumber, addDate?, cancelDate? }`.

---

## დამატებითი (ჩვენი სერვისი)

| Method | Path | დანიშნულება |
|--------|------|--------------|
| **GET** | `/health` | Health check (არ პროქსირდება SA-ზე). Response: `{ "ok": true, "service": "marte-fines-backend" }`. |

---

## იმპლემენტაციის ვარიანტი

- **ერთი ზოგადი route:** `app.all('/api/v1/*', ...)` – ყოველი request-ის path (api/v1 შემდეგ) + query + method + body უგზავნება SA-ს, ყველა response უკან იბრუნება. (ახლანდელი კოდი ასე მუშაობს.)
- **ან ცალკე route-ები:** თუ დეველოპერი ცალკე endpoint-ებს გააკეთებს, ზემოთ ჩამოთვლილი 5 path + იგივე method/query/body უნდა იყოს პროქსირებული SA-ზე.

საკმარისია ის, რომ marte-backend-ის მოთხოვნები (base URL = `FINES_BACKEND_URL`) ზუსტად ამ path-ებზე და method-ებზე იმუშაოს და SA-ს პასუხი უცვლელი დაბრუნდეს.
