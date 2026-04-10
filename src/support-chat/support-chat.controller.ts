import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Param,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { SupportChatService } from './support-chat.service';
import { SupportChatGateway } from './support-chat.gateway';

function normalizeEnvSecret(raw: string | undefined): string {
  if (!raw) return '';
  let s = raw.trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

function parseInAppAgentAllowlist(): string[] {
  return (process.env.SUPPORT_IN_APP_AGENT_USER_IDS || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

@Controller('support-chat')
export class SupportChatController {
  constructor(
    private readonly supportChatService: SupportChatService,
    private readonly supportChatGateway: SupportChatGateway,
  ) {}

  private assertAgentKey(agentKey: string | undefined): void {
    const expected = normalizeEnvSecret(process.env.SUPPORT_CHAT_AGENT_KEY);
    if (!expected) {
      throw new ServiceUnavailableException(
        'საპორტის agent API გამორთულია (SUPPORT_CHAT_AGENT_KEY)',
      );
    }
    const got = (agentKey ?? '').trim();
    if (!got || got !== expected) {
      throw new UnauthorizedException(
        'x-support-agent-key არ ემთხვევა .env-ის SUPPORT_CHAT_AGENT_KEY-ს (იგივე სტრინგი უნდა იყოს, პლეისჰოლდერი არა)',
      );
    }
  }

  private assertInAppAgent(requesterId: string | undefined): void {
    const id = requesterId?.trim();
    if (!id) {
      throw new UnauthorizedException('საჭიროა x-user-id');
    }
    const allowed = parseInAppAgentAllowlist();
    if (allowed.length === 0 || !allowed.includes(id)) {
      throw new ForbiddenException('საპორტის in-app კონსოლი არ გაქვს ჩართული');
    }
  }

  @Get('messages')
  async getMessages(@Headers('x-user-id') userId: string | undefined) {
    const id = userId?.trim();
    if (!id) {
      throw new BadRequestException('საჭიროა ჰედერი x-user-id');
    }
    return this.supportChatService.listMessagesDto(id);
  }

  /** აპის ბეიჯი: ნაანახი საპორტის შეტყობინებების რაოდენობა */
  @Get('unread')
  async getUnread(@Headers('x-user-id') userId: string | undefined) {
    const id = userId?.trim();
    if (!id) {
      throw new BadRequestException('საჭიროა ჰედერი x-user-id');
    }
    const count = await this.supportChatService.getUnreadAgentMessageCount(id);
    return { count };
  }

  /** საუბრის გახსნისას — ბაზაში unread 0-დება */
  @Post('read')
  async markRead(@Headers('x-user-id') userId: string | undefined) {
    const id = userId?.trim();
    if (!id) {
      throw new BadRequestException('საჭიროა ჰედერი x-user-id');
    }
    await this.supportChatService.markThreadReadByUser(id);
    return { ok: true, count: 0 };
  }

  @Post('messages')
  async postUserMessage(
    @Headers('x-user-id') userId: string | undefined,
    @Body() body: { text?: string },
  ) {
    const id = userId?.trim();
    if (!id) {
      throw new BadRequestException('საჭიროა ჰედერი x-user-id');
    }
    const dto = await this.supportChatService.createUserMessage(
      id,
      body?.text ?? '',
    );
    this.supportChatGateway.emitMessage(id, dto);
    return dto;
  }

  /** ადმინ პანელი / curl — იგივე key რაც SUPPORT_CHAT_AGENT_KEY */
  @Get('agent/threads')
  async agentThreads(
    @Headers('x-support-agent-key') agentKey: string | undefined,
  ) {
    this.assertAgentKey(agentKey);
    return this.supportChatService.listThreadsForAdmin();
  }

  @Get('agent/thread/:userId/messages')
  async agentThreadMessages(
    @Headers('x-support-agent-key') agentKey: string | undefined,
    @Param('userId') userId: string,
  ) {
    this.assertAgentKey(agentKey);
    const id = decodeURIComponent(userId || '').trim();
    if (!id) {
      throw new BadRequestException('userId სავალდებულოა');
    }
    return this.supportChatService.listMessagesDto(id);
  }

  /**
   * საპორტის პასუხი (ადმინი / სკრიპტი).
   * POST /support-chat/agent/reply
   * Headers: x-support-agent-key
   * Body: { "userId": "<იგივე id რაც აპში x-user-id>", "text": "..." }
   */
  @Post('agent/reply')
  async agentReply(
    @Headers('x-support-agent-key') agentKey: string | undefined,
    @Body() body: { userId?: string; text?: string },
  ) {
    this.assertAgentKey(agentKey);
    const target = body?.userId?.trim();
    const text = body?.text ?? '';
    if (!target) {
      throw new BadRequestException('userId სავალდებულოა');
    }
    const dto = await this.supportChatService.createAgentMessage(target, text);
    this.supportChatGateway.emitMessage(target, dto);
    return dto;
  }

  /**
   * აპში: ჩანს თუ არა „საპორტის კონსოლი“ მენიუში.
   * .env: SUPPORT_IN_APP_AGENT_USER_IDS=usr_xxx,usr_yyy
   */
  @Get('agent/in-app/eligible')
  inAppEligible(@Headers('x-user-id') requesterId: string | undefined) {
    const id = requesterId?.trim();
    if (!id) return { eligible: false };
    const allowed = parseInAppAgentAllowlist();
    return {
      eligible: allowed.length > 0 && allowed.includes(id),
    };
  }

  @Get('agent/in-app/threads')
  inAppThreads(@Headers('x-user-id') requesterId: string | undefined) {
    this.assertInAppAgent(requesterId);
    return this.supportChatService.listThreadsForAdmin();
  }

  @Get('agent/in-app/thread/:targetUserId/messages')
  inAppThreadMessages(
    @Headers('x-user-id') requesterId: string | undefined,
    @Param('targetUserId') targetUserId: string,
  ) {
    this.assertInAppAgent(requesterId);
    const tid = decodeURIComponent(targetUserId || '').trim();
    if (!tid) {
      throw new BadRequestException('targetUserId სავალდებულოა');
    }
    return this.supportChatService.listMessagesDto(tid);
  }

  @Post('agent/in-app/reply')
  async inAppReply(
    @Headers('x-user-id') requesterId: string | undefined,
    @Body() body: { userId?: string; text?: string },
  ) {
    this.assertInAppAgent(requesterId);
    const target = body?.userId?.trim();
    const text = body?.text ?? '';
    if (!target) {
      throw new BadRequestException('userId სავალდებულოა');
    }
    const dto = await this.supportChatService.createAgentMessage(target, text);
    this.supportChatGateway.emitMessage(target, dto);
    return dto;
  }
}
