import { Injectable } from '@nestjs/common';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicBaseUrl: string;
};

type UploadInput = {
  buffer: Buffer;
  originalName?: string;
  mimeType?: string;
  folder?: string;
};

const DEFAULT_R2_PUBLIC_BASE_URL =
  'https://pub-4566e71245c844b0a872c249373a291b.r2.dev';

function sanitizePathSegment(value: string): string {
  return value
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .replace(/[^a-zA-Z0-9/_-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/\/{2,}/g, '/');
}

function extensionFromName(name?: string): string {
  const clean = (name || '').split(/[\\/]/).pop() || '';
  const match = clean.match(/\.([a-zA-Z0-9]{1,12})$/);
  return match ? match[1].toLowerCase() : 'jpg';
}

@Injectable()
export class UploadsService {
  private client?: S3Client;
  private clientKey = '';

  private getConfig(): R2Config {
    const accountId = process.env.R2_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID || '';
    const accessKeyId = process.env.R2_ACCESS_KEY_ID || '';
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '';
    const bucketName = process.env.R2_BUCKET_NAME || '';
    const publicBaseUrl =
      process.env.R2_PUBLIC_BASE_URL || DEFAULT_R2_PUBLIC_BASE_URL;

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
      throw new Error(
        'R2 config missing: set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME',
      );
    }

    return {
      accountId,
      accessKeyId,
      secretAccessKey,
      bucketName,
      publicBaseUrl: publicBaseUrl.replace(/\/+$/g, ''),
    };
  }

  private getClient(config: R2Config): S3Client {
    const nextKey = `${config.accountId}:${config.accessKeyId}`;
    if (this.client && this.clientKey === nextKey) return this.client;

    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
    this.clientKey = nextKey;
    return this.client;
  }

  private createObjectKey(input: UploadInput): string {
    const folder = sanitizePathSegment(input.folder || 'carappx');
    const ext = extensionFromName(input.originalName);
    const day = new Date().toISOString().slice(0, 10);
    return `${folder}/${day}/${Date.now()}-${randomUUID()}.${ext}`;
  }

  async uploadImage(input: UploadInput) {
    const config = this.getConfig();
    const objectKey = this.createObjectKey(input);
    const encodedKey = objectKey
      .split('/')
      .map((part) => encodeURIComponent(part))
      .join('/');
    const client = this.getClient(config);

    await client.send(
      new PutObjectCommand({
        Bucket: config.bucketName,
        Key: objectKey,
        Body: input.buffer,
        ContentType: input.mimeType || 'application/octet-stream',
      }),
    );

    return {
      key: objectKey,
      url: `${config.publicBaseUrl}/${encodedKey}`,
    };
  }
}
