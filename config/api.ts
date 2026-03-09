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

const getApiUrl = () => {
  const override = process.env.EXPO_PUBLIC_API_URL;
  if (override) {
    return override;
  }

  // Development-ზე localhost, production-ზე Railway
  if (__DEV__) {
    const lanIp = getLanIpFromHost();
    const localUrl = lanIp ? `http://${lanIp}:3000` : 'http://localhost:3000';
    console.log('🌐 Using Local API (DEV):', localUrl);
    return localUrl;78
  }

  // Production-ზე Railway
  const railwayUrl = 'https://marte-backend-production.up.railway.app';
  console.log('🌐 Using Railway API (PROD):', railwayUrl);
  return railwayUrl;
};

const API_BASE_URL = getApiUrl();

console.log('🚀 API Base URL:', API_BASE_URL);

export { API_BASE_URL };
export default API_BASE_URL;
