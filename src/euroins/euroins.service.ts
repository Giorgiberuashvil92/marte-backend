import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
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

interface EuroinsSubscriptionComparison {
  asOf?: string;
  total?: number;
  toDeactivate?: number;
  subscribers?: Array<{
    personalId: string;
    partnerReference?: string;
    eligible: boolean;
    ineligibleSince?: string;
  }>;
}

@Injectable()
export class EuroinsService {
  private readonly logger = new Logger(EuroinsService.name);
  private readonly baseUrl = 'https://apiservice.euroins.ge/api/v1/partner';
  private token: { value: string; expiresAt: number } | null = null;
  private readonly syncInFlight = new Map<string, Promise<void>>();
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

  /** EuroIns-ის batch reconciliation: ვის აღარ აქვს მოქმედი პოლისი. */
  private async getSubscriptionComparison(): Promise<EuroinsSubscriptionComparison> {
    return this.request<EuroinsSubscriptionComparison>('/subscriptions');
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
    const inFlight = this.syncInFlight.get(userId);
    if (inFlight) return inFlight;

    const syncPromise = this.syncUserInternal(userId, personalId);
    this.syncInFlight.set(userId, syncPromise);

    try {
      await syncPromise;
    } finally {
      if (this.syncInFlight.get(userId) === syncPromise) {
        this.syncInFlight.delete(userId);
      }
    }
  }

  private async syncUserInternal(userId: string, personalId?: string): Promise<void> {
    if (!this.isConfigured()) return;

    const normalizedPersonalId = this.normalizePersonalId(personalId || '');
    if (normalizedPersonalId.length !== 11) return;

    const user = await this.userModel.findOne({ id: userId }).exec();
    if (!user) return;

    try {
      const policies = await this.getPolicies(normalizedPersonalId);
      const eligible = Boolean(policies?.vehicles?.length);

      if (eligible) {
        await this.subscriptionsService.grantPremium({ userId }, 'monthly', 'euroins');
        if (!user.euroinsSubscriptionReported) {
          await this.reportSubscription(normalizedPersonalId, true, userId);
        }
      } else {
        // Policy may have been removed even when the previous report was not
        // persisted (for example, if EuroIns was temporarily unavailable).
        // Always try to revoke only the EuroIns-owned Premium subscription;
        // revokePremium safely returns 404 when there is nothing to revoke.
        if (user.euroinsSubscriptionReported) {
          await this.reportSubscription(normalizedPersonalId, false, userId);
        }
        try {
          await this.subscriptionsService.revokePremium({ userId, source: 'euroins' });
        } catch (revokeError) {
          const status = typeof (revokeError as { getStatus?: () => number }).getStatus === 'function'
            ? (revokeError as { getStatus: () => number }).getStatus()
            : (revokeError as { response?: { status?: number }; status?: number }).response?.status
              ?? (revokeError as { status?: number }).status;
          if (status !== 404) throw revokeError;
        }
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

  /**
   * EuroIns-ის batch პასუხით აუქმებს მხოლოდ EuroIns-ის მიერ მინიჭებულ Premium-ს.
   * გადახდილ ან სხვა წყაროს subscription-ს არ ეხება.
   */
  async reconcileSubscriptions(): Promise<{
    asOf?: string;
    total: number;
    toDeactivate: number;
    processed: number;
    skipped: number;
  }> {
    if (!this.isConfigured()) {
      return { total: 0, toDeactivate: 0, processed: 0, skipped: 0 };
    }

    const comparison = await this.getSubscriptionComparison();
    const subscribers = comparison.subscribers || [];
    const toDeactivate = Number(comparison.toDeactivate || 0);

    if (toDeactivate <= 0) {
      this.logger.log(`Euroins reconciliation: nothing to deactivate (total=${comparison.total || 0})`);
      return {
        asOf: comparison.asOf,
        total: Number(comparison.total || 0),
        toDeactivate: 0,
        processed: 0,
        skipped: 0,
      };
    }

    let processed = 0;
    let skipped = 0;

    for (const subscriber of subscribers.filter((item) => item.eligible === false)) {
      const reference = String(subscriber.partnerReference || '').trim();
      const userId = reference.startsWith('marte-') ? reference.slice('marte-'.length) : '';
      const personalId = this.normalizePersonalId(subscriber.personalId);
      const user = await this.userModel
        .findOne({
          $or: [
            ...(userId ? [{ id: userId }] : []),
            ...(personalId ? [{ personalId }] : []),
          ],
        })
        .exec();

      if (!user) {
        skipped += 1;
        this.logger.warn(`Euroins reconciliation: user not found for ${reference || personalId}`);
        continue;
      }

      try {
        await this.subscriptionsService.revokePremium({ userId: user.id, source: 'euroins' });
      } catch (error) {
        const status = typeof (error as { getStatus?: () => number }).getStatus === 'function'
          ? (error as { getStatus: () => number }).getStatus()
          : (error as { response?: { status?: number }; status?: number }).response?.status
            ?? (error as { status?: number }).status;
        if (status !== 404) throw error;
      }

      await this.userModel.updateOne(
        { _id: user._id },
        {
          $set: {
            euroinsEligible: false,
            euroinsSubscriptionReported: false,
            euroinsCheckedAt: new Date(),
            euroinsPolicyCount: 0,
          },
        },
      ).exec();
      processed += 1;
      this.logger.log(`Euroins Premium revoked for ${user.id} (${personalId})`);
    }

    return {
      asOf: comparison.asOf,
      total: Number(comparison.total || 0),
      toDeactivate,
      processed,
      skipped,
    };
  }

  @Cron('15 */6 * * *', { timeZone: 'Asia/Tbilisi' })
  async scheduledSubscriptionReconciliation(): Promise<void> {
    try {
      await this.reconcileSubscriptions();
    } catch (error) {
      this.logger.warn(`Euroins reconciliation failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }
}
