import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Param,
  Patch,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import type { MessageCreateDto } from './messages.service';

@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  async create(@Body() body: MessageCreateDto) {
    const hasRequestId =
      typeof body?.requestId === 'string' && body.requestId.length > 0;
    const hasUserId =
      typeof body?.userId === 'string' && body.userId.length > 0;
    const hasPartnerId =
      typeof body?.partnerId === 'string' && body.partnerId.length > 0;
    const hasSender = body?.sender === 'user' || body?.sender === 'partner';
    const hasMessage =
      typeof body?.message === 'string' && body.message.trim().length > 0;

    if (
      !hasRequestId ||
      !hasUserId ||
      !hasPartnerId ||
      !hasSender ||
      !hasMessage
    ) {
      throw new BadRequestException('Invalid message payload');
    }

    return this.messagesService.create({
      requestId: body.requestId,
      userId: body.userId,
      partnerId: body.partnerId,
      sender: body.sender,
      message: body.message.trim(),
    });
  }

  @Get('chat/:requestId')
  async getChatHistory(@Param('requestId') requestId: string) {
    if (!requestId) {
      throw new BadRequestException('Request ID is required');
    }
    return this.messagesService.getChatHistory(requestId);
  }

  @Get('recent')
  async getRecentChats(
    @Query('userId') userId?: string,
    @Query('partnerId') partnerId?: string,
  ) {
    if (!userId && !partnerId) {
      throw new BadRequestException('Either userId or partnerId is required');
    }
    return this.messagesService.getRecentChats(userId || '', partnerId);
  }

  @Get('unread/:requestId')
  async getUnreadCount(
    @Param('requestId') requestId: string,
    @Query('userId') userId?: string,
    @Query('partnerId') partnerId?: string,
  ) {
    if (!requestId || (!userId && !partnerId)) {
      throw new BadRequestException(
        'Request ID and either userId or partnerId is required',
      );
    }
    // Service ითხოვს მხოლოდ userId-ს; partnerId-ს არსებობა ნიშნავს რომ ვთვლით როგორც partner-სადმი წასაკითხს
    return this.messagesService.getUnreadCount(requestId, userId || '');
  }

  @Patch('read/:requestId')
  async markAsRead(
    @Param('requestId') requestId: string,
    @Body() body: { userId?: string; partnerId?: string },
  ) {
    if (!requestId || (!body.userId && !body.partnerId)) {
      throw new BadRequestException(
        'Request ID and either userId or partnerId is required',
      );
    }
    // Service ითხოვს მხოლოდ userId-ს; თუ partner კითხულობს, გადავცემთ ცარიელს, რომ მოხდეს სწორი მხარის აღნიშვნა
    return this.messagesService.markAsRead(requestId, body.userId || '');
  }
}
