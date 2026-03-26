# Railway (marte-backend): ჯარიმები fines-backend-ის მეშვეობით

## 1. Environment variable

Railway-ის **marte-backend** პროექტში დაამატე:

```
FINES_BACKEND_URL=http://185.247.94.146:3100
```

- თუ fines-backend VPS-ზე **პორტ 3100**-ზე გაშვებულია: `http://185.247.94.146:3100`
- თუ nginx/caddy 80-ზე ატარებს: `http://185.247.94.146`
- HTTPS-ის შემთხვევაში: `https://tvoi-fines-domain.com`

(ბოლო slash არ სჭირდება; კოდი თვითონ ამოჭრის.)

## 2. რას აკეთებს კოდი

- **FINES_BACKEND_URL** როცა **დაყენებულია**: ყველა ჯარიმების request მიდის ამ URL-ზე, იგივე path-ებით (`/api/v1/patrolpenalties`, `/api/v1/PatrolPenalties/PenaltyMediaFiles`, და ა.შ.). **Authorization / Bearer** marte-backend აღარ აგზავნის — fines-backend თვითონ ამატებს SA-ის ტოკენს.
- **FINES_BACKEND_URL** როცა **არ არის**: marte-backend პირდაპირ იძახებს SA.gov.ge-ს და თვითონ იყენებს SA ტოკენს.

## 3. Request-ების შესატყვისი

| რას იძახებდი SA-ზე | რას იძახებ ახლა (FINES_BACKEND_URL დაყენებულისას) |
|---------------------|-----------------------------------------------------|
| GET api-public.sa.gov.ge/api/v1/patrolpenalties?... | GET ${FINES_BACKEND_URL}/api/v1/patrolpenalties?... |
| GET .../PatrolPenalties/PenaltyMediaFiles?... | GET ${FINES_BACKEND_URL}/api/v1/PatrolPenalties/PenaltyMediaFiles?... |
| POST .../patrolpenalties/vehicles + body | POST ${FINES_BACKEND_URL}/api/v1/patrolpenalties/vehicles + იგივე body |
| GET .../patrolpenalties/vehicles/validatevehicle?... | GET ${FINES_BACKEND_URL}/api/v1/patrolpenalties/vehicles/validatevehicle?... |
| GET .../patrolpenalties/vehicles/active | GET ${FINES_BACKEND_URL}/api/v1/patrolpenalties/vehicles/active |

Method, query, body — უცვლელი. Base URL მხოლოდ იცვლება: SA → FINES_BACKEND_URL.
