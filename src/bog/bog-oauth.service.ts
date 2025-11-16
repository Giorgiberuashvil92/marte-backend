import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface BOGTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number; // BOG-ი აბრუნებს timestamp-ს, არა წამების რაოდენობას
}

export interface BOGTokenCache {
  token: string;
  expiresAt: number;
}

@Injectable()
export class BOGOAuthService {
  private readonly logger = new Logger(BOGOAuthService.name);
  private tokenCache: BOGTokenCache | null = null;

  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly tokenUrl: string;

  constructor(private configService: ConfigService) {
    this.clientId = this.configService.get<string>('BOG_CLIENT_ID') || '';
    this.clientSecret =
      this.configService.get<string>('BOG_CLIENT_SECRET') || '';
    this.tokenUrl =
      'https://oauth2.bog.ge/auth/realms/bog/protocol/openid-connect/token';

    if (!this.clientId || !this.clientSecret) {
      this.logger.error(
        '❌ BOG_CLIENT_ID ან BOG_CLIENT_SECRET არ არის კონფიგურირებული',
      );
      throw new Error('BOG credentials არ არის კონფიგურირებული');
    }

    this.logger.log('✅ BOG OAuth Service ინიციალიზებულია');
  }

  /**
   * BOG OAuth 2.0 token-ის მიღება
   * გამოიყენება client_credentials grant type
   */
  async getAccessToken(): Promise<string> {
    try {
      // შემოწმება არის თუ არა token ვალიდური cache-ში
      if (this.tokenCache && this.tokenCache.expiresAt > Date.now()) {
        this.logger.debug('🔄 გამოიყენება cached token');
        return this.tokenCache.token;
      }

      this.logger.log('🔐 BOG OAuth token-ის მიღება...');

      // Base64 encoding client_id:client_secret
      const credentials = Buffer.from(
        `${this.clientId}:${this.clientSecret}`,
      ).toString('base64');

      const response = await fetch(this.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${credentials}`,
        },
        body: 'grant_type=client_credentials',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const responseData = (await response.json()) as BOGTokenResponse;

      if (!responseData.access_token) {
        throw new Error('Token არ მივიღეთ response-ში');
      }
      const expiresAt = responseData.expires_in;
      this.tokenCache = {
        token: responseData.access_token,
        expiresAt: expiresAt,
      };

      const expiresInSeconds = Math.floor((expiresAt - Date.now()) / 1000);
      this.logger.log(
        `✅ BOG OAuth token წარმატებით მიღებულია (expires in ${expiresInSeconds}s)`,
      );

      return responseData.access_token;
    } catch (error: any) {
      this.logger.error(
        '❌ BOG OAuth token-ის მიღების შეცდომა:',
        error.message || 'Unknown error',
      );

      if (error.message?.includes('401')) {
        throw new BadRequestException('BOG credentials არასწორია');
      } else if (error.message?.includes('400')) {
        throw new BadRequestException('BOG API request არასწორია');
      } else {
        throw new BadRequestException('BOG OAuth service-თან კავშირის შეცდომა');
      }
    }
  }

  /**
   * Token cache-ის გასუფთავება
   * გამოიყენება error-ების შემთხვევაში
   */
  clearTokenCache(): void {
    this.tokenCache = null;
    this.logger.log('🗑️ BOG token cache გასუფთავებულია');
  }

  /**
   * Token-ის სტატუსის შემოწმება
   */
  async isTokenValid(): Promise<boolean> {
    // თუ token არ არსებობს, ვცდილობთ მივიღოთ
    if (!this.tokenCache || this.tokenCache.expiresAt <= Date.now()) {
      try {
        await this.getAccessToken();
        return true;
      } catch (error) {
        this.logger.error(
          '❌ BOG OAuth token-ის მიღების შეცდომა:',
          error?.message || 'Unknown error',
        );
        return false;
      }
    }
    return true;
  }

  /**
   * Token-ის ვადის გასვლის დრო
   */
  getTokenExpiryTime(): number | null {
    return this.tokenCache?.expiresAt || null;
  }

  /**
   * BOG API-სთვის Authorization header-ის მომზადება
   */
  async getAuthorizationHeader(): Promise<string> {
    const token = await this.getAccessToken();
    return `Bearer ${token}`;
  }

  /**
   * BOG API-სთვის headers-ის მომზადება
   */
  async getApiHeaders(): Promise<Record<string, string>> {
    return {
      Authorization: await this.getAuthorizationHeader(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }
}
