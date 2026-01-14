import { Injectable, Logger } from '@nestjs/common';
import * as https from 'https';
import * as querystring from 'querystring';

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
    const data = querystring.stringify({
      apikey: this.apiKey,
      smsno: smsno,
      destination: formattedPhone,
      content: message,
    });

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
      const options = {
        hostname: this.baseUrl,
        path: path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(data),
        },
        timeout: 30000, // 30 seconds
      };

      const req = https.request(options, (res) => {
        let responseBody = '';

        res.on('data', (chunk) => {
          responseBody += chunk;
        });

        res.on('end', () => {
          try {
            const result = JSON.parse(responseBody) as SenderAPIResponse;

            // Handle different HTTP response codes
            if (res.statusCode === 200) {
              // Success: {"data":[{"messageId":"123KUxuhiGyDN3","statusId":1,"qnt":1}]}
              resolve(result);
            } else if (res.statusCode === 401) {
              reject(new Error('Invalid API key'));
            } else if (res.statusCode === 402) {
              reject(new Error('Insufficient balance'));
            } else if (res.statusCode === 403) {
              reject(new Error('Access denied'));
            } else if (res.statusCode === 503) {
              reject(new Error('Service temporarily unavailable'));
            } else {
              const errorMessage =
                result.message || `HTTP ${res.statusCode || 'Unknown'}`;
              reject(new Error(errorMessage));
            }
          } catch {
            reject(new Error(`Invalid JSON response: ${responseBody}`));
          }
        });
      });

      req.on('error', (e) => {
        reject(new Error(`HTTP request failed: ${e.message}`));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.write(data);
      req.end();
    });
  }
}
