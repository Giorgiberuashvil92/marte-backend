import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { IoAdapter } from '@nestjs/platform-socket.io';
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import { json, urlencoded } from 'body-parser';

function initializeFirebase() {
  try {
    let serviceAccount: admin.ServiceAccount | null = null;

    // Option 1: Read from .env as Base64 encoded JSON (recommended)
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      try {
        const base64String = process.env.FIREBASE_SERVICE_ACCOUNT_JSON.trim();
        const jsonString = Buffer.from(base64String, 'base64').toString('utf8');
        const parsed: unknown = JSON.parse(jsonString);
        if (
          parsed &&
          typeof parsed === 'object' &&
          ('project_id' in parsed || 'projectId' in parsed)
        ) {
          serviceAccount = parsed as admin.ServiceAccount;
        } else {
          throw new Error('Invalid service account format');
        }
      } catch {
        console.warn(
          '⚠️ Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON, trying other options...',
        );
      }
    }

    // Option 2: Read from individual env variables
    if (!serviceAccount && process.env.FIREBASE_PROJECT_ID) {
      serviceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey:
          process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') || '',
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
      } as admin.ServiceAccount;
    }

    // Option 3: Read from file (fallback)
    if (!serviceAccount) {
      const serviceAccountPath =
        process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './firebase-adminsdk.json';
      try {
        serviceAccount = JSON.parse(
          fs.readFileSync(serviceAccountPath, 'utf8'),
        ) as admin.ServiceAccount;
      } catch {
        console.log(
          '⚠️ Firebase service account key not found at:',
          serviceAccountPath,
        );
        console.log('📋 To enable push notifications:');
        console.log(
          '   1. Set FIREBASE_SERVICE_ACCOUNT_JSON env variable (Base64 encoded JSON)',
        );
        console.log('   2. Or set individual FIREBASE_* env variables');
        console.log(
          '   3. Or save as firebase-adminsdk.json in backend-v2 root',
        );
        console.log('   4. Or set FIREBASE_SERVICE_ACCOUNT_PATH env variable');
        return;
      }
    }

    // Initialize Firebase Admin
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    console.log('✅ Firebase Admin SDK initialized successfully!');
  } catch (error) {
    console.error('❌ Firebase Admin initialization failed:', error);
  }
}

async function bootstrap() {
  // 🔥 Initialize Firebase first
  initializeFirebase();

  const app = await NestFactory.create(AppModule);

  // Increase body size limits (for CarFAX HTML -> PDF)
  app.use(json({ limit: '2mb' }));
  app.use(urlencoded({ limit: '2mb', extended: true }));

  // Enable Socket.IO
  app.useWebSocketAdapter(new IoAdapter(app));

  // Enable CORS for admin localhost
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      process.env.ADMIN_ORIGIN || '',
    ].filter(Boolean),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
