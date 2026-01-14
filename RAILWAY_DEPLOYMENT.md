# 🚂 Railway Deployment Guide

## 📋 Railway-ზე Deployment-ისთვის საჭირო Environment Variables:

### 1. Database
```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/carapp-v2?retryWrites=true&w=majority
```

### 2. CORS Configuration
```env
# Admin Panel Origin (Vercel)
ADMIN_ORIGIN=https://free-nextjs-admin-dashboard-omega-green.vercel.app

# Additional allowed origins (comma-separated)
ALLOWED_ORIGINS=https://your-frontend-domain.com,https://another-domain.com
```

### 3. BOG Payment Gateway
```env
BOG_CLIENT_ID=your_bog_client_id
BOG_CLIENT_SECRET=your_bog_client_secret
BOG_MERCHANT_ID=your_merchant_id
BOG_API_BASE_URL=https://api.bog.ge
BOG_IPAY_BASE_URL=https://ipay.ge/opay/api/v1
```

### 4. SMS Service (Sender.ge)
```env
SENDER_GE_API_KEY=your_sender_ge_api_key
```

### 5. Firebase (Optional - Push Notifications)
```env
# Option 1: Base64 encoded JSON
FIREBASE_SERVICE_ACCOUNT_JSON=base64_encoded_json_string

# Option 2: Individual variables
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_PRIVATE_KEY=your_private_key
FIREBASE_CLIENT_EMAIL=your_client_email
```

### 6. Port (Railway automatically sets this)
```env
PORT=3000  # Railway automatically sets this, but you can override
```

## 🔧 Railway Configuration:

### 1. Build Command:
```bash
npm install && npm run build
```

### 2. Start Command:
```bash
npm run start:prod
```

### 3. Health Check:
Railway automatically uses the root endpoint `/` for health checks.

## ✅ CORS Origins (Auto-configured):

Backend automatically allows:
- ✅ `https://free-nextjs-admin-dashboard-omega-green.vercel.app` (Admin Panel)
- ✅ `ADMIN_ORIGIN` env variable
- ✅ `ALLOWED_ORIGINS` env variable (comma-separated)

## 📝 Railway Environment Variables Setup:

1. **Railway Dashboard-ში:**
   - გადადი Project → Variables
   - დაამატე ყველა environment variable

2. **ან Railway CLI-ით:**
   ```bash
   railway variables set MONGODB_URI="your_mongodb_uri"
   railway variables set SENDER_GE_API_KEY="your_sender_ge_api_key"
   railway variables set ADMIN_ORIGIN="https://free-nextjs-admin-dashboard-omega-green.vercel.app"
   railway variables set ALLOWED_ORIGINS="https://your-domain.com"
   ```

## 🚀 Deployment Steps:

1. **Connect Repository:**
   - Railway Dashboard → New Project → Deploy from GitHub
   - აირჩიე `marte-backend` repository

2. **Set Environment Variables:**
   - დაამატე ყველა env variable (იხილე ზემოთ)

3. **Configure Build:**
   - Build Command: `npm install && npm run build`
   - Start Command: `npm run start:prod`

4. **Deploy:**
   - Railway ავტომატურად გააკეთებს deployment-ს

## 🔍 Troubleshooting:

### CORS Issues:
- შეამოწმე რომ `ADMIN_ORIGIN` და `ALLOWED_ORIGINS` სწორად არის დაყენებული
- Backend logs-ში ნახე: `CORS enabled for origins: [...]`

### Port Issues:
- Railway ავტომატურად აყენებს `PORT` env variable-ს
- Backend logs-ში ნახე: `🚀 Backend running on port {port}`

### Database Connection:
- შეამოწმე `MONGODB_URI` სწორად არის დაყენებული
- MongoDB Atlas-ში შეამოწმე IP whitelist

## 📊 Monitoring:

Railway automatically provides:
- ✅ Logs
- ✅ Metrics
- ✅ Health checks
- ✅ Automatic restarts

## 🔗 Useful Links:

- Railway Dashboard: https://railway.app
- Backend URL: `https://marte-backend-production.up.railway.app`
- Admin Panel: `https://free-nextjs-admin-dashboard-omega-green.vercel.app`

