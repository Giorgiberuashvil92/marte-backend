import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { SenderAPIService } from './sender-api.service';

@Controller('sms')
export class SmsController {
  constructor(private readonly senderAPIService: SenderAPIService) {}

  @Post('send')
  async sendSMS(
    @Body()
    body: {
      phoneNumber: string;
      message: string;
      smsno?: number;
    },
  ) {
    const result = await this.senderAPIService.sendSMS(
      body.phoneNumber,
      body.message,
      body.smsno || 2,
    );

    if (!result.success) {
      throw new BadRequestException({
        success: false,
        message: 'SMS გაგზავნა ვერ მოხერხდა',
        error: result.error,
      });
    }

    return {
      success: true,
      message: 'SMS წარმატებით გაიგზავნა',
      data: {
        messageId: result.messageId,
        statusId: result.statusId,
      },
    };
  }
}
