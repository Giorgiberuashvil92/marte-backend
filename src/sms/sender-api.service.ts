import { Injectable, Logger } from '@nestjs/common';
import * as https from 'https';

export interface SendSMSResult {
  success: boolean;
  messageId?: string;
  statusId?: number;
  error?: string;
}

interface SenderAPIResponse {
  data?: Array<{
    messageId?: string;
    statusId?: number;
    qnt?: number;
  }>;
  message?: string;
}

@Injectable()
export class SenderAPIService {
  private readonly logger = new Logger(SenderAPIService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'sender.ge';

  constructor() {
    this.apiKey = '65fa7f724d09ed5357688a00a643f657';
    if (!this.apiKey) {
      this.logger.warn('⚠️ SENDER_GE_API_KEY not configured');
    }
  }

  /**
   * Sends SMS via sender.ge API
   * @param phoneNumber -
   * @param message -
   * @param smsno -
   * @returns Promise<SendSMSResult>
   */
  async sendSMS(
    phoneNumber: string,
    message: string,
    smsno: number = 2,
  ): Promise<SendSMSResult> {
    // Validate input
    try {
      this.validatePhoneNumber(phoneNumber);
      this.validateMessage(message);
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : 'Validation failed';
      this.logger.error(`❌ Validation error: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }

    if (!this.apiKey) {
      const errorMsg = 'SENDER_GE_API_KEY not configured';
      this.logger.error(`❌ ${errorMsg}`);
      return { success: false, error: errorMsg };
    }

    const formattedPhone = this.formatPhoneNumber(phoneNumber);

    // Use URLSearchParams for better UTF-8 encoding support
    const params = new URLSearchParams();
    params.append('apikey', this.apiKey);
    params.append('smsno', smsno.toString());
    params.append('destination', formattedPhone);
    params.append('content', message);

    const data = params.toString();

    // Debug logging
    this.logger.debug(`📤 Sending SMS to ${formattedPhone}`);
    this.logger.debug(`📝 Message: ${message.substring(0, 50)}...`);
    this.logger.debug(`📝 Full Message: ${message}`);
    this.logger.debug(`🔑 API Key: ${this.apiKey.substring(0, 10)}...`);
    this.logger.debug(`📊 SMS Type: ${smsno}`);
    this.logger.debug(`📦 Encoded Data: ${data.substring(0, 200)}...`);

    try {
      const response = await this.makeRequest('/api/send.php', data);

      if (response.data && response.data.length > 0) {
        const result = response.data[0];
        const messageId = result.messageId || '';
        const statusId = result.statusId;
        this.logger.log(
          `✅ SMS sent successfully to ${formattedPhone} (messageId: ${messageId})`,
        );
        return {
          success: true,
          messageId: messageId,
          statusId: statusId,
        };
      }

      const errorMsg = 'Invalid response format from API';
      this.logger.error(`❌ ${errorMsg}`);
      return { success: false, error: errorMsg };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ SMS sending failed: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Validates Georgian mobile phone number
   * @param phoneNumber - Phone number to validate
   * @throws Error if phone number is invalid
   */
  validatePhoneNumber(phoneNumber: string): void {
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      throw new Error('Phone number is required');
    }

    const cleaned = phoneNumber.replace(/^(\+?995)?/, '');
    if (!/^5[0-9]{8}$/.test(cleaned)) {
      throw new Error(
        'Invalid Georgian mobile number format. Expected: 5xxxxxxxx (9 digits starting with 5)',
      );
    }
  }

  /**
   * Validates SMS message content
   * @param message - Message to validate
   * @throws Error if message is invalid
   */
  validateMessage(message: string): void {
    if (!message || message.trim() === '') {
      throw new Error('Message content is required');
    }
    if (message.length > 1000) {
      throw new Error('Message is too long (max 1000 characters)');
    }
  }

  /**
   * Formats phone number to 9-digit Georgian format (removes +995 or 995 prefix)
   * @param phoneNumber - Phone number to format
   * @returns Formatted phone number (9 digits)
   */
  formatPhoneNumber(phoneNumber: string): string {
    return phoneNumber.replace(/^(\+?995)?/, '');
  }

  /**
   * Makes HTTPS request to sender.ge API
   * @param path - API endpoint path
   * @param data - Form data to send
   * @returns Promise with API response
   */
  private makeRequest(path: string, data: string): Promise<SenderAPIResponse> {
    return new Promise((resolve, reject) => {
      const contentLength = Buffer.byteLength(data, 'utf8');
      const options = {
        hostname: this.baseUrl,
        path: path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
          'Content-Length': contentLength,
        },
        timeout: 30000, // 30 seconds
      };

      this.logger.debug(`🌐 Request to: https://${this.baseUrl}${path}`);
      this.logger.debug(`📏 Content-Length: ${contentLength}`);

      const req = https.request(options, (res) => {
        let responseBody = '';

        this.logger.debug(`📥 Response status: ${res.statusCode}`);

        res.on('data', (chunk) => {
          responseBody += chunk;
        });

        res.on('end', () => {
          this.logger.debug(`📥 Response body: ${responseBody}`);
          try {
            const result = JSON.parse(responseBody) as SenderAPIResponse;

            // Handle different HTTP response codes
            if (res.statusCode === 200) {
              // Success: {"data":[{"messageId":"123KUxuhiGyDN3","statusId":1,"qnt":1}]}
              this.logger.debug(`✅ Success response:`, JSON.stringify(result));
              resolve(result);
            } else if (res.statusCode === 401) {
              this.logger.error(`❌ 401 Unauthorized: ${result.message || 'Invalid API key'}`);
              reject(new Error(result.message || 'Invalid API key'));
            } else if (res.statusCode === 402) {
              this.logger.error(`❌ 402 Payment Required: ${result.message || 'Insufficient balance'}`);
              reject(new Error(result.message || 'Insufficient balance'));
            } else if (res.statusCode === 403) {
              this.logger.error(`❌ 403 Forbidden: ${result.message || 'Access denied'}`);
              reject(new Error(result.message || 'Access denied'));
            } else if (res.statusCode === 503) {
              this.logger.error(`❌ 503 Service Unavailable: ${result.message || 'Service temporarily unavailable'}`);
              reject(new Error(result.message || 'Service temporarily unavailable'));
            } else {
              const errorMessage =
                result.message || `HTTP ${res.statusCode || 'Unknown'}`;
              this.logger.error(`❌ HTTP ${res.statusCode}: ${errorMessage}`);
              reject(new Error(errorMessage));
            }
          } catch (parseError) {
            this.logger.error(`❌ JSON Parse Error: ${parseError}`);
            this.logger.error(`❌ Response body: ${responseBody}`);
            reject(new Error(`Invalid JSON response: ${responseBody}`));
          }
        });
      });

      req.on('error', (e) => {
        this.logger.error(`❌ HTTP request error: ${e.message}`);
        reject(new Error(`HTTP request failed: ${e.message}`));
      });

      req.on('timeout', () => {
        this.logger.error(`❌ Request timeout`);
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.write(data, 'utf8');
      req.end();
    });
  }
}
