import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../schemas/user.schema';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

interface EuroinsTokenResponse {
  accessToken: string;
  tokenType?: string;
  expiresIn?: number;
}

interface EuroinsPoliciesResponse {
  personalId: string;
  holderName?: string;
  phone?: string | null;
  asOf?: string;
  vehicles?: Array<{
    policyNumber?: string;
    plateNumber?: string;
    carMark?: string;
    carModel?: string;
    productionYear?: string;
    vinCode?: string;
    policyFrom?: string;
    policyTo?: string;
  }>;
}

@Injectable()
export class EuroinsService {
  private readonly logger = new Logger(EuroinsService.name);
  private readonly baseUrl = 'https://apiservice.euroins.ge/api/v1/partner';
  private token: { value: string; expiresAt: number } | null = null;
  private readonly cacheMs = 24 * 60 * 60 * 1000;

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  private get clientId(): string {
    return process.env.EUROINS_CLIENT_ID?.trim() || '';
  }

  private get clientSecret(): string {
    return process.env.EUROINS_CLIENT_SECRET?.trim() || '';
  }

  private isConfigured(): boolean {
    return process.env.EUROINS_PARTNER_ENABLED !== 'false' && Boolean(this.clientId && this.clientSecret);
  }

  private normalizePersonalId(value: string): string {
    return String(value || '').replace(/\D/g, '').slice(0, 11);
  }

  private async getToken(forceRefresh = false): Promise<string> {
    if (!forceRefresh && this.token && this.token.expiresAt > Date.now() + 60_000) {
      return this.token.value;
    }

    const response = await fetch(`${this.baseUrl}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: this.clientId, clientSecret: this.clientSecret }),
    });

    if (!response.ok) {
      throw new Error(`Euroins token request failed: ${response.status}`);
    }

    const data = (await response.json()) as EuroinsTokenResponse;
    if (!data.accessToken) throw new Error('Euroins token response has no accessToken');

    this.token = {
      value: data.accessToken,
      expiresAt: Date.now() + Math.max(60, Number(data.expiresIn || 1800) - 60) * 1000,
    };
    return data.accessToken;
  }

  private async request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
    const token = await this.getToken();
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        ...(init.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 401 && retry) {
      this.token = null;
      return this.request<T>(path, init, false);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      const error = new Error(`Euroins request failed: ${response.status}`);
      (error as Error & { status?: number; body?: string }).status = response.status;
      (error as Error & { status?: number; body?: string }).body = body;
      throw error;
    }

    return (await response.json()) as T;
  }

  private async getPolicies(personalId: string): Promise<EuroinsPoliciesResponse | null> {
    try {
      return await this.request<EuroinsPoliciesResponse>(`/policies/${encodeURIComponent(personalId)}`);
    } catch (error) {
      const status = (error as { status?: number }).status;
      if (status === 404) return null;
      throw error;
    }
  }

  private async reportSubscription(
    personalId: string,
    active: boolean,
    userId: string,
  ): Promise<void> {
    const occurredOn = new Date().toISOString().slice(0, 10);
    await this.request('/subscriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalId,
        active,
        occurredOn,
        partnerReference: `marte-${userId}`,
      }),
    });
  }

  /**
   * Euroins-ის eligible მომხმარებელს აძლევს MARTE Premium-ს.
   * ეს არის fire-and-forget ინტეგრაცია: Euroins-ის დროებითი ხარვეზი auth-ს არ აჩერებს.
   */
  async syncUser(userId: string, personalId?: string): Promise<void> {
    if (!this.isConfigured()) return;

    const normalizedPersonalId = this.normalizePersonalId(personalId || '');
    if (normalizedPersonalId.length !== 11) return;

    const user = await this.userModel.findOne({ id: userId }).exec();
    if (!user) return;

    if (
      user.euroinsCheckedAt &&
      Date.now() - new Date(user.euroinsCheckedAt).getTime() < this.cacheMs
    ) {
      return;
    }

    try {
      const policies = await this.getPolicies(normalizedPersonalId);
      const eligible = Boolean(policies?.vehicles?.length);

      if (eligible) {
        await this.subscriptionsService.grantPremium({ userId }, 'monthly');
        if (!user.euroinsSubscriptionReported) {
          await this.reportSubscription(normalizedPersonalId, true, userId);
        }
      } else if (user.euroinsSubscriptionReported) {
        await this.reportSubscription(normalizedPersonalId, false, userId);
      }

      await this.userModel.updateOne(
        { id: userId },
        {
          $set: {
            personalId: normalizedPersonalId,
            euroinsEligible: eligible,
            euroinsSubscriptionReported: eligible,
            euroinsCheckedAt: new Date(),
            euroinsPolicyCount: policies?.vehicles?.length || 0,
          },
        },
      ).exec();

      this.logger.log(`Euroins sync completed for ${userId}: eligible=${eligible}`);
    } catch (error) {
      this.logger.warn(
        `Euroins sync skipped for ${userId}: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }
}
