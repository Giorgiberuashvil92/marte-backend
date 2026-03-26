import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { SenderAPIService } from './sender-api.service';
import { UsersService } from '../users/users.service';

@Controller('sms')
export class SmsController {
  constructor(
    private readonly senderAPIService: SenderAPIService,
    private readonly usersService: UsersService,
  ) {}

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

  @Post('bulk-send')
  async sendBulkSMS(
    @Body()
    body: {
      message: string;
      phoneNumbers?: string[];
      role?: string;
      active?: boolean;
      smsno?: number;
    },
  ) {
    console.log('📨 Bulk SMS Request received:', {
      message: body.message,
      messageLength: body.message?.length,
      role: body.role,
      active: body.active,
      smsno: body.smsno,
    });

    if (!body.message || body.message.trim() === '') {
      throw new BadRequestException('message_required');
    }

    let users: Array<{
      phone: string;
      firstName?: string;
      lastName?: string;
    }> = [];

    // თუ მოწოდებულია phoneNumbers array, გამოვიყენოთ ის
    if (body.phoneNumbers && body.phoneNumbers.length > 0) {
      users = body.phoneNumbers.map((phone) => ({ phone }));
    } else {
      // ბაზიდან მხოლოდ იმ იუზერები, ვისაც ჰქონდათ შესვლა 28 დეკემბერი 2025-ის შემდეგ
      const filter: { role?: string; active?: boolean; loginAfter?: string } = {
        loginAfter: '2025-12-28T00:00:00.000Z',
      };
      if (body.role) filter.role = body.role;
      if (typeof body.active === 'boolean') filter.active = body.active;

      users = await this.usersService.getPhoneNumbers(filter);
    }

    if (users.length === 0) {
      throw new BadRequestException('no_phone_numbers_found');
    }

    const results = {
      total: users.length,
      success: 0,
      failed: 0,
      errors: [] as Array<{ phone: string; error: string }>,
      successMessages: [] as Array<{ phone: string; messageId?: string }>,
    };

    const baseMessage = body.message.trim();

    if (!baseMessage) {
      throw new BadRequestException('message_cannot_be_empty');
    }

    console.log(`📝 Base message: "${baseMessage}"`);
    console.log(`👥 Sending to ${users.length} users`);

    for (const user of users) {
      try {
        // პერსონალიზებული შეტყობინების შექმნა
        let personalizedMessage: string;

        // თუ მომხმარებელს აქვს სახელი, დავამატოთ შეტყობინების დასაწყისში
        if (user.firstName) {
          const fullName = [user.firstName, user.lastName]
            .filter(Boolean)
            .join(' ')
            .trim();
          personalizedMessage = `გამარჯობა, ${fullName}! ${baseMessage}`;
          console.log(
            `📤 Personalized message for ${user.phone}: "${personalizedMessage}"`,
          );
          console.log(`📝 Base message in personalized: "${baseMessage}"`);
          console.log(`👤 Full name: "${fullName}"`);
        } else {
          // თუ სახელი არ აქვს, გავუგზავნოთ უსახელოდ
          personalizedMessage = baseMessage;
          console.log(
            `📤 Plain message for ${user.phone}: "${personalizedMessage}"`,
          );
        }

        const result = await this.senderAPIService.sendSMS(
          user.phone,
          personalizedMessage,
          body.smsno || 1, // default 1 (რეკლამა)
        );

        if (result.success) {
          results.success++;
          results.successMessages.push({
            phone: user.phone,
            messageId: result.messageId,
          });
        } else {
          results.failed++;
          results.errors.push({
            phone: user.phone,
            error: result.error || 'Unknown error',
          });
        }
      } catch (error) {
        results.failed++;
        results.errors.push({
          phone: user.phone,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      success: true,
      message: `SMS გაგზავნილია ${results.success} მომხმარებელზე`,
      data: results,
    };
  }
}
