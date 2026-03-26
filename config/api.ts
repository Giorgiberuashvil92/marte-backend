import Constants from 'expo-constants';

const getLanIpFromHost = (): string | undefined => {
  // მოიძიე Expo hostUri-დან (საიმედოა dev-ში)
  const hostUri =
    (Constants as any)?.expoConfig?.hostUri ||
    (Constants as any)?.manifest2?.extra?.expoClient?.hostUri ||
    (Constants as any)?.manifest?.hostUri ||
    '';
  // ფორმატი: "192.168.1.23:8081" → გვინდა მხოლოდ IP
  if (hostUri && typeof hostUri === 'string') {
    const ip = hostUri.split(':')[0];
    return ip && ip !== 'localhost' ? ip : undefined;
  }
  return undefined;
};

const RAILWAY_URL = 'https://marte-backend-production.up.railway.app';

const FORCE_RAILWAY = false;

const getApiUrl = () => {
  const override = process.env.EXPO_PUBLIC_API_URL;
  if (override) {
    return override;
  }
  if (FORCE_RAILWAY) {
    console.log('🌐 Using Railway API (forced):', RAILWAY_URL);
    return RAILWAY_URL;
  }

  // Development-ზე localhost, production-ზე Railway
  if (__DEV__) {
    const lanIp = getLanIpFromHost();
    const localUrl = lanIp ? `http://${lanIp}:3000` : 'http://localhost:3000';
    console.log('🌐 Using Local API (DEV):', localUrl);
    return localUrl;
  }

  console.log('🌐 Using Railway API:', RAILWAY_URL);
  return RAILWAY_URL;
};

const API_BASE_URL = getApiUrl();

console.log('🚀 API Base URL:', API_BASE_URL);

export { API_BASE_URL };
export default API_BASE_URL;
