# 🎉 ახალი Services API ენდფოინთები

ახალი `/services` ენდფოინთები შექმნილია რომელიც აერთიანებს ყველა ტიპის სერვისს!

## 📡 API Endpoints

### 1. ყველა სერვისი (date-ის მიხედვით)
```
GET /services/all?sortBy=date&order=desc&limit=50&type=carwash
```

**Query Parameters:**
- `sortBy`: `date` | `popularity` (default: `date`)
- `order`: `asc` | `desc` (default: `desc`) 
- `limit`: number (default: `50`)
- `type`: `carwash` | `store` | `dismantler` | `part` | `category` (optional - ყველას აბრუნებს)

### 2. ბოლო დამატებული სერვისები
```
GET /services/recent?limit=20
```

### 3. პოპულარული სერვისები
```
GET /services/popular?limit=20
```

## 🏗️ Response Format

```json
[
  {
    "id": "string",
    "title": "string",
    "description": "string", 
    "type": "carwash|store|dismantler|part|category",
    "location": "string",
    "price": "string|number",
    "images": ["string"],
    "phone": "string",
    "rating": number,
    "reviews": number,
    "createdAt": "Date",
    "updatedAt": "Date",
    "popularity": number,
    "isOpen": boolean,
    "category": "string"
  }
]
```

## 🔧 მხარდაჭერილი სერვისების ტიპები

1. **🚗 Carwash** - სამრეცხაო სერვისები
2. **🏪 Store** - მაღაზიები (ავტონაწილები, რემონტი, სხვა)
3. **🔧 Dismantler** - დაშლილი მანქანები
4. **⚙️ Part** - ავტონაწილები
5. **📂 Category** - კატეგორიები

## 🚀 მაგალითი

```bash
# ყველა სერვისი date-ის მიხედვით (ახალიდან ძველისკენ)
curl "http://localhost:4000/services/all?sortBy=date&order=desc&limit=10"

# მხოლოდ სამრეცხაო სერვისები
curl "http://localhost:4000/services/all?type=carwash&limit=5"

# პოპულარული სერვისები
curl "http://localhost:4000/services/popular?limit=15"
```

## ✨ ფუნქციები

- ✅ **5 ტიპის სერვისის** ერთად დაბრუნება
- ✅ **Date-ის მიხედვით** sorting (ახალი → ძველი)
- ✅ **Popularity-ის მიხედვით** sorting
- ✅ **ტიპის მიხედვით** ფილტრაცია
- ✅ **Parallel queries** - სწრაფი performance
- ✅ **Flexible limits** - რამდენიც გინდა
- ✅ **Unified format** - ერთნაირი response structure



