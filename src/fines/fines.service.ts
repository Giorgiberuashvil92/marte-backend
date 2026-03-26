import {
  Injectable,
  Logger,
  HttpException,
  HttpStatus,
  OnModuleInit,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  FinesVehicle,
  FinesVehicleDocument,
} from '../schemas/fines-vehicle.schema';
import {
  CarFinesSubscription,
  CarFinesSubscriptionDocument,
} from '../schemas/car-fines-subscription.schema';
import {
  FinesRegistrationLog,
  FinesRegistrationLogDocument,
} from '../schemas/fines-registration-log.schema';
import { User, UserDocument } from '../schemas/user.schema';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  FinesDailyReminder,
  FinesDailyReminderDocument,
} from '../schemas/fines-daily-reminder.schema';
import {
  FinesPenaltyCache,
  FinesPenaltyCacheDocument,
} from '../schemas/fines-penalty-cache.schema';
import { SubscriptionDocument } from '../schemas/subscription.schema';

const SA_IDENTITY_URL = 'https://api-identity.sa.gov.ge/connect/token';
const SA_PUBLIC_API_URL = 'https://api-public.sa.gov.ge/api/v1';

export interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export interface Penalty {
  protocolId: number;
  automobileNumber: string;
  penaltyNumber: string;
  penaltyType: number;
  penaltyTypeName: string;
  taxCode: string;
  restriction: string;
  oriniginalValue: number;
  penaltyAmountValue: number;
  penaltyDate: string;
  fineAmountValue: number;
  fineDate: string;
  finalAmount: number;
  isPayable: boolean;
  isDiscountable: boolean;
  isPayedDiscounted: boolean;
  finalDiscountDate?: string;
  finalPaymentDate?: string;
  code: number;
  codeName: string;
  raionId: number;
  regionId: number;
  raionName: string;
  regionName: string;
  stateId: number;
  stateName: string;
  publishDate?: string;
  isPublished: boolean;
  techPassportNumber: string;
  actionDate?: string;
  protocolDate: string;
  activeDate?: string;
  violationDate: string;
}

export interface VehicleRegistration {
  id: number;
  vehicleNumber: string;
  techPassportNumber: string;
  addDate?: string;
  cancelDate?: string;
}

type UnpaidAggRow = { _id: string; unpaidCount: number };
type VehiclesAggRow = { _id: string; activeVehicles: number };

const SA_CLIENT_ID = 'martegeo';
const SA_CLIENT_SECRET = 'VJ.e35U~9M6£zQY';

@Injectable()
export class FinesService implements OnModuleInit {
  private readonly logger = new Logger(FinesService.name);
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  private readonly finesReminderTz = 'Asia/Tbilisi';
  private isSendingFinesReminders = false;

  constructor(
    private configService: ConfigService,
    @InjectModel(FinesVehicle.name)
    private finesVehicleModel: Model<FinesVehicleDocument>,
    @InjectModel(CarFinesSubscription.name)
    private carFinesSubscriptionModel: Model<CarFinesSubscriptionDocument>,
    @InjectModel(FinesRegistrationLog.name)
    private finesRegistrationLogModel: Model<FinesRegistrationLogDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    @InjectModel(FinesDailyReminder.name)
    private finesDailyReminderModel: Model<FinesDailyReminderDocument>,
    @InjectModel(FinesPenaltyCache.name)
    private finesPenaltyCacheModel: Model<FinesPenaltyCacheDocument>,
    private subscriptionsService: SubscriptionsService,
    private notificationsService: NotificationsService,
  ) {}

  onModuleInit() {
    const proxyUrl = this.configService.get<string>('FINES_BACKEND_URL');
    const base = this.getFinesApiBaseUrl();
    if (proxyUrl && proxyUrl.trim()) {
      this.logger.log(
        `🚀 Fines: using proxy → ${base} (FINES_BACKEND_URL is set)`,
      );
    } else {
      this.logger.warn(
        `⚠️ Fines: FINES_BACKEND_URL not set → calling SA directly (${SA_PUBLIC_API_URL}). ` +
          `Set FINES_BACKEND_URL on Railway to use VPS proxy.`,
      );
    }
  }

  /**
   * Format vehicle number: MI999SS -> MI-999-SS (ჩვენს ბაზაში/UI-ში)
   */
  private formatVehicleNumber(plate: string): string {
    const cleaned = this.normalizeVehicleNumber(plate);
    if (cleaned.length >= 7) {
      const letters1 = cleaned.substring(0, 2);
      const digits = cleaned.substring(2, 5);
      const letters2 = cleaned.substring(5, 7);
      return `${letters1}-${digits}-${letters2}`;
    }
    return cleaned;
  }

  /** SA API იღებს ნომერს დეშების გარეშე (JU303UU). */
  private normalizeVehicleNumber(plate: string): string {
    return plate
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
  }

  private getTbilisiYmdAndMinutes(d: Date): {
    ymd: string;
    minutesSinceMidnight: number;
  } {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: this.finesReminderTz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = fmt.formatToParts(d);
    const g = (t: Intl.DateTimeFormatPart['type']) =>
      parts.find((p) => p.type === t)?.value ?? '0';
    const hour = parseInt(g('hour'), 10);
    const minute = parseInt(g('minute'), 10);
    return {
      ymd: `${g('year')}-${g('month')}-${g('day')}`,
      minutesSinceMidnight: hour * 60 + minute,
    };
  }

  private tbilisiDayStartUtcMs(ymd: string): number {
    const [y, m, d] = ymd.split('-').map(Number);
    return Date.UTC(y, m - 1, d) - 4 * 60 * 60 * 1000;
  }

  private tbilisiDayEndUtcMs(ymd: string): number {
    return this.tbilisiDayStartUtcMs(ymd) + 24 * 60 * 60 * 1000 - 1;
  }

  private shouldFireFinesReminderWindow(
    nowMs: number,
    targetUtcMs: number,
    catchupEndUtcMs: number,
  ): boolean {
    const winBefore = targetUtcMs - 5 * 60 * 1000;
    const winAfter = targetUtcMs + 5 * 60 * 1000;
    if (nowMs >= winBefore && nowMs <= winAfter) return true;
    return nowMs > winAfter && nowMs <= catchupEndUtcMs;
  }

  /** დღეში ორჯერ: 10:00 და 19:00 თბილისი; დილის catch-up 14:00-მდე, საღამოს — დღის ბოლომდე. */
  private finesReminderSlotKey(nowMs: number): '10' | '19' | null {
    const { ymd } = this.getTbilisiYmdAndMinutes(new Date(nowMs));
    const dayStart = this.tbilisiDayStartUtcMs(ymd);
    const t10 = dayStart + 10 * 60 * 60 * 1000;
    const catchMorningEnd = dayStart + 14 * 60 * 60 * 1000 - 1;
    if (this.shouldFireFinesReminderWindow(nowMs, t10, catchMorningEnd)) {
      return '10';
    }
    const t19 = dayStart + 19 * 60 * 60 * 1000;
    const catchEveningEnd = this.tbilisiDayEndUtcMs(ymd);
    if (this.shouldFireFinesReminderWindow(nowMs, t19, catchEveningEnd)) {
      return '19';
    }
    return null;
  }

  private userHasPremiumForFinesReminders(
    sub: SubscriptionDocument | null,
  ): boolean {
    if (!sub || sub.status !== 'active') return false;
    const p = String(sub.planId || '').toLowerCase();
    return p === 'premium' || p.startsWith('premium-');
  }

  /**
   * Token-ის მოპოვება OAuth 2.0 client credentials flow-ით
   */
  private async getAccessToken(): Promise<string> {
    // თუ token ჯერ არ არის expired, დავაბრუნოთ არსებული
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const clientId = SA_CLIENT_ID;
    const clientSecret = SA_CLIENT_SECRET;

    // Debug logging
    this.logger.debug('🔍 Environment variables check:');
    this.logger.debug(
      `  SA_CLIENT_ID: ${clientId ? `${clientId.substring(0, 4)}...` : 'NOT SET'}`,
    );
    this.logger.debug(
      `  SA_CLIENT_SECRET: ${clientSecret ? `${clientSecret.substring(0, 4)}...` : 'NOT SET'}`,
    );

    if (!clientId || !clientSecret) {
      this.logger.error(
        '❌ SA_CLIENT_ID და SA_CLIENT_SECRET არ არის კონფიგურირებული',
      );
      this.logger.error(
        '   გთხოვთ დაამატოთ ეს ცვლადები .env ფაილში marte-backend დირექტორიაში',
      );
      throw new HttpException(
        'SA_CLIENT_ID და SA_CLIENT_SECRET უნდა იყოს კონფიგურირებული',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    try {
      const formData = new URLSearchParams();
      formData.append('client_id', clientId);
      formData.append('client_secret', clientSecret);
      formData.append('grant_type', 'client_credentials');

      this.logger.debug(`🔐 Token request to: ${SA_IDENTITY_URL}`);
      this.logger.debug(
        `   client_id: ${clientId.substring(0, 4)}..., grant_type: client_credentials`,
      );

      const response = await fetch(SA_IDENTITY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      this.logger.debug(
        `📥 Token response status: ${response.status} ${response.statusText}`,
      );

      const responseText = await response.text();
      this.logger.debug(
        `📥 Token response body: ${responseText.substring(0, 200)}...`,
      );

      if (!response.ok) {
        this.logger.error(
          `❌ Token request failed: ${response.status} ${responseText}`,
        );
        throw new HttpException(
          `Token მოპოვება ვერ მოხერხდა: ${response.status} - ${responseText}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      // Parse JSON response
      let data: TokenResponse;
      try {
        data = JSON.parse(responseText) as TokenResponse;
      } catch {
        this.logger.error(`❌ Failed to parse token response: ${responseText}`);
        throw new HttpException(
          'Token response-ის parsing ვერ მოხერხდა',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      // Validate required fields
      if (!data.access_token) {
        this.logger.error(
          `❌ Token response missing access_token: ${JSON.stringify(data)}`,
        );
        throw new HttpException(
          'Token response-ში არ არის access_token',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      if (!data.expires_in || typeof data.expires_in !== 'number') {
        this.logger.error(
          `❌ Token response missing or invalid expires_in: ${JSON.stringify(data)}`,
        );
        throw new HttpException(
          'Token response-ში არ არის expires_in ან არასწორი ტიპი',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      this.accessToken = data.access_token;
      // expires_in არის წამებში, ვაკლებთ 60 წამს buffer-ისთვის
      this.tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;

      this.logger.log(
        `✅ Token მოპოვებულია წარმატებით (expires in ${data.expires_in}s)`,
      );
      this.logger.debug(
        `   token_type: ${data.token_type || 'N/A'}, scope: ${data.scope || 'N/A'}`,
      );
      return this.accessToken;
    } catch (error) {
      this.logger.error('Token მოპოვების შეცდომა:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Token მოპოვებისას მოხდა შეცდომა',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * ბაზის URL: თუ FINES_BACKEND_URL არის (VPS proxy), ვიყენებთ მას; წინააღმდეგ შემთხვევაში პირდაპირ SA API.
   */
  private getFinesApiBaseUrl(): string {
    const proxyUrl = this.configService.get<string>('FINES_BACKEND_URL');
    if (proxyUrl && proxyUrl.trim()) {
      const base = proxyUrl.replace(/\/$/, '');
      return `${base}/api/v1`;
    }
    return SA_PUBLIC_API_URL;
  }

  /**
   * Authenticated request helper
   * თუ FINES_BACKEND_URL არის დაყენებული, request მიდის fines-backend (VPS)-ზე, რომელიც SA-ს პროქსირებს.
   * @param timeoutMs - optional timeout. SA API-ს ზოგჯერ დიდი დრო სჭირდება, განსაკუთრებით Railway-დან.
   */
  private async authenticatedRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    timeoutMs: number = 15000,
  ): Promise<T> {
    const baseUrl = this.getFinesApiBaseUrl();
    const useProxy = baseUrl !== SA_PUBLIC_API_URL;
    const fullUrl = `${baseUrl}${endpoint}`;

    const token = useProxy ? null : await this.getAccessToken();

    this.logger.debug(
      `🌐 API Request: ${options.method || 'GET'} ${fullUrl}${useProxy ? ' (via fines-backend proxy)' : ''}`,
    );
    if (token) {
      this.logger.debug(
        `   Authorization: Bearer ${token.substring(0, 20)}...`,
      );
    }
    if (options.body) {
      const bodyStr =
        typeof options.body === 'string'
          ? options.body
          : JSON.stringify(options.body);
      this.logger.debug(`   Body: ${bodyStr.substring(0, 200)}...`);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    let response: Response;
    try {
      response = await fetch(fullUrl, {
        ...options,
        signal: controller.signal,
        headers,
      });
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      const e = err as {
        message?: string;
        cause?: { code?: string; message?: string };
      };
      const causeStr = e?.cause
        ? ` cause: ${e.cause?.code ?? e.cause?.message ?? 'unknown'}`
        : '';
      this.logger.error(
        `❌ SA API fetch failed: ${e?.message ?? String(err)}${causeStr}`,
      );
      throw new HttpException(
        `SA.gov.ge API-ს მიღება ვერ მოხერხდა (ქსელი/დრო). სცადეთ თავიდან.`,
        HttpStatus.BAD_GATEWAY,
      );
    }
    clearTimeout(timeoutId);

    this.logger.debug(
      `📥 API Response: ${response.status} ${response.statusText}`,
    );

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(
        `❌ API request failed: ${response.status} ${errorText}`,
      );
      this.logger.error(`   Request URL: ${fullUrl}`);
      throw new HttpException(
        `API შეცდომა: ${response.status} - ${errorText}`,
        response.status,
      );
    }

    return response.json() as Promise<T>;
  }

  /**
   * ჯარიმების სია
   * URL: https://api-public.sa.gov.ge/api/v1/patrolpenalties
   * პარამეტრების გადაცემის შემთხვევაში სავალდებულოა ორივე პარამეტრის გადაცემა
   */
  async getPenalties(
    vehicleNumber?: string,
    techPassportNumber?: string,
  ): Promise<Penalty[]> {
    // თუ ერთ-ერთი პარამეტრი გადაცემულია, ორივე უნდა იყოს
    if (vehicleNumber && !techPassportNumber) {
      throw new HttpException(
        'ორივე პარამეტრი სავალდებულოა: AutomobileNumber და TechPassportNumber',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (techPassportNumber && !vehicleNumber) {
      throw new HttpException(
        'ორივე პარამეტრი სავალდებულოა: AutomobileNumber და TechPassportNumber',
        HttpStatus.BAD_REQUEST,
      );
    }

    const params = new URLSearchParams();
    if (vehicleNumber && techPassportNumber) {
      params.append('AutomobileNumber', vehicleNumber);
      params.append('TechPassportNumber', techPassportNumber);
    }

    const queryString = params.toString();
    // Endpoint არის /patrolpenalties (არა /penalties)
    const endpoint = queryString
      ? `/patrolpenalties?${queryString}`
      : '/patrolpenalties';

    this.logger.debug(
      `🔍 Getting penalties: ${vehicleNumber ? 'for specific vehicle' : 'all active vehicles'}`,
    );

    return this.authenticatedRequest<Penalty[]>(endpoint);
  }

  /**
   * ვიდეო ჯარიმების ნახვა
   * URL: https://api-public.sa.gov.ge/api/v1/PatrolPenalties/PenaltyMediaFiles
   */
  async getPenaltyMediaFiles(
    vehicleNumber: string,
    techPassportNumber: string,
    protocolId: number,
  ): Promise<string[]> {
    const params = new URLSearchParams({
      AutomobileNumber: vehicleNumber,
      TechPassportNumber: techPassportNumber,
      ProtocolId: protocolId.toString(),
    });

    this.logger.debug(
      `📹 Getting media files for penalty: ${protocolId}, vehicle: ${vehicleNumber}`,
    );

    return this.authenticatedRequest<string[]>(
      `/PatrolPenalties/PenaltyMediaFiles?${params.toString()}`,
    );
  }

  /**
   * იუზერის ჯარიმების მანქანების ლიმიტის ინფორმაცია
   */
  async getUserFinesCarLimit(userId: string): Promise<{
    maxCars: number;
    registeredCars: number;
    canRegisterMore: boolean;
    additionalCarPrice: number;
    isPremium: boolean;
  }> {
    try {
      // მოვიტანოთ subscription
      const subscription =
        await this.subscriptionsService.getUserSubscription(userId);
      const isPremium =
        subscription?.planId === 'premium' && subscription?.status === 'active';
      const maxCars: number = subscription?.maxFinesCars ?? 1;

      // მოვიტანოთ რეგისტრირებული მანქანების რაოდენობა
      const registeredCars = await this.finesVehicleModel.countDocuments({
        userId,
        isActive: true,
      });

      return {
        maxCars,
        registeredCars,
        canRegisterMore: isPremium && registeredCars < maxCars,
        additionalCarPrice: 1, // 1 ლარი ყოველი დამატებითი მანქანისთვის თვეში
        isPremium,
      };
    } catch (error) {
      this.logger.error(`❌ Failed to get user fines car limit: ${error}`);
      throw error;
    }
  }

  /**
   * მანქანის რეგისტრაცია
   * URL: https://api-public.sa.gov.ge/api/v1/patrolpenalties/vehicles
   */
  async registerVehicle(
    userId: string,
    vehicleNumber: string,
    techPassportNumber: string,
    mediaFile: boolean = false,
  ): Promise<number> {
    // შევამოწმოთ ლიმიტი რეგისტრაციამდე
    const limitInfo = await this.getUserFinesCarLimit(userId);

    if (!limitInfo.isPremium) {
      throw new HttpException(
        'მანქანის რეგისტრაციისთვის საჭიროა პრემიუმ გამოწერა',
        HttpStatus.FORBIDDEN,
      );
    }

    // შევამოწმოთ ეს მანქანა უკვე ხომ არ არის დარეგისტრირებული ამ იუზერისთვის
    const formattedVehicleNumber = this.formatVehicleNumber(vehicleNumber);
    const existingVehicle = await this.finesVehicleModel.findOne({
      userId,
      vehicleNumber: formattedVehicleNumber,
      isActive: true,
    });

    // თუ ეს მანქანა უკვე დარეგისტრირებულია, ხელახლა რეგისტრაცია ნებადართულია (განახლება)
    if (!existingVehicle && !limitInfo.canRegisterMore) {
      throw new HttpException(
        `მანქანების ლიმიტი ამოიწურა (${limitInfo.registeredCars}/${limitInfo.maxCars}). დამატებითი მანქანისთვის საჭიროა გამოწერის განახლება.`,
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    // SA API იღებს VehicleNumber დეშების გარეშე (JU303UU), წინააღმდეგ შემთხვევაში 500
    const vehicleNumberForApi = this.normalizeVehicleNumber(vehicleNumber);
    const data: Record<string, unknown> = {
      VehicleNumber: vehicleNumberForApi,
      TechPassportNumber: techPassportNumber.trim(),
      MediaFile: mediaFile,
    };
    data['FilterDate'] = new Date().toISOString().split('T')[0];

    this.logger.debug(
      `🚗 Registering vehicle: ${formattedVehicleNumber} for user ${userId}, MediaFile: ${mediaFile}`,
    );
    this.logger.debug(`   Request body: ${JSON.stringify(data)}`);

    const doRegister = () =>
      this.authenticatedRequest<Record<string, unknown>>(
        '/patrolpenalties/vehicles',
        { method: 'POST', body: JSON.stringify(data) },
        30000, // 30s timeout – Railway → SA.gov.ge ზოგჯერ ნელა პასუხობს
      );

    let rawResponse: Record<string, unknown>;
    try {
      rawResponse = await doRegister();
    } catch (err: any) {
      const isRetryable =
        err instanceof HttpException && err.getStatus() === 502;
      if (isRetryable) {
        this.logger.warn('🔄 Retrying vehicle registration once...');
        await new Promise((r) => setTimeout(r, 2000));
        rawResponse = await doRegister();
      } else {
        throw err;
      }
    }

    this.logger.debug(
      `📥 SA register vehicle raw response: ${JSON.stringify(rawResponse)}`,
    );
    const resp = rawResponse as { id?: number; Id?: number };
    const saVehicleId =
      typeof resp.id === 'number'
        ? resp.id
        : typeof resp.Id === 'number'
          ? resp.Id
          : undefined;
    let saVehicleIdToSave =
      saVehicleId !== undefined && saVehicleId !== null
        ? Number(saVehicleId)
        : 0;
    if (saVehicleIdToSave === 0) {
      const resolvedSaId = await this.resolveSaVehicleIdFromActiveList(
        formattedVehicleNumber,
        techPassportNumber.trim(),
      );
      if (resolvedSaId && resolvedSaId > 0) {
        saVehicleIdToSave = resolvedSaId;
      }
    }
    if (saVehicleIdToSave === 0) {
      this.logger.warn(
        `⚠️ SA API did not return vehicle id; raw response keys: ${Object.keys(rawResponse || {}).join(', ')}`,
      );
    }

    // ყოველთვის ვწერთ ლოგში ვინ დაარეგისტრირა (გარაჟში არ უნდა ჰქონდეს მანქანა)
    try {
      await this.finesRegistrationLogModel.create({
        userId,
        vehicleNumber: formattedVehicleNumber,
        techPassportNumber: techPassportNumber.trim(),
        saVehicleId: saVehicleIdToSave,
        addDate: new Date().toISOString(),
      });
    } catch (logErr) {
      this.logger.warn(`⚠️ Fines registration log save failed: ${logErr}`);
    }

    // შენახვა ჩვენს ბაზაში
    try {
      // შევამოწმოთ არის თუ არა უკვე დარეგისტრირებული
      const existing = await this.finesVehicleModel.findOne({
        userId,
        vehicleNumber: formattedVehicleNumber,
        techPassportNumber: techPassportNumber.trim(),
        isActive: true,
      });

      if (existing) {
        // განვაახლოთ არსებული ჩანაწერი
        existing.saVehicleId = saVehicleIdToSave;
        existing.addDate = new Date().toISOString();
        existing.mediaFile = mediaFile;
        await existing.save();
        this.logger.log(
          `✅ Vehicle updated in database: ${String(existing._id)}`,
        );
      } else {
        // შევქმნათ ახალი ჩანაწერი
        const newVehicle = new this.finesVehicleModel({
          userId,
          vehicleNumber: formattedVehicleNumber,
          techPassportNumber: techPassportNumber.trim(),
          saVehicleId: saVehicleIdToSave,
          addDate: new Date().toISOString(),
          isActive: true,
          mediaFile,
        });
        await newVehicle.save();
        this.logger.log(
          `✅ Vehicle saved to database: ${String(newVehicle._id)}`,
        );
      }
    } catch (dbError) {
      this.logger.error(`⚠️ Failed to save vehicle to database: ${dbError}`);
      // არ ვაგდებთ error-ს, რადგან API რეგისტრაცია წარმატებული იყო
    }

    this.logger.log(`✅ Vehicle registered with SA ID: ${saVehicleIdToSave}`);
    return saVehicleIdToSave;
  }

  /**
   * მანქანის გადამოწმება
   * URL: https://api-public.sa.gov.ge/api/v1/patrolpenalties/vehicles/validatevehicle
   */
  async validateVehicle(
    vehicleNumber: string,
    techPassportNumber: string,
  ): Promise<boolean> {
    const params = new URLSearchParams({
      AutomobileNumber: vehicleNumber,
      TechPassportNumber: techPassportNumber,
    });

    this.logger.debug(`🔍 Validating vehicle: ${vehicleNumber}`);

    return this.authenticatedRequest<boolean>(
      `/patrolpenalties/vehicles/validatevehicle?${params.toString()}`,
    );
  }

  /**
   * აქტიური მანქანების სია
   * URL: https://api-public.sa.gov.ge/api/v1/patrolpenalties/vehicles/active
   */
  async getActiveVehicles(): Promise<VehicleRegistration[]> {
    this.logger.debug('📋 Getting active vehicles list');
    return this.authenticatedRequest<VehicleRegistration[]>(
      '/patrolpenalties/vehicles/active',
    );
  }

  private async resolveSaVehicleIdFromActiveList(
    vehicleNumberRaw: string,
    techPassportNumberRaw: string,
  ): Promise<number | null> {
    const vehicleNumber = this.normalizeVehicleNumber(vehicleNumberRaw);
    const techPassportNumber = String(techPassportNumberRaw || '').trim();
    if (!vehicleNumber || !techPassportNumber) return null;
    try {
      const active = await this.getActiveVehicles();
      const hit = active.find((v) => {
        const n = this.normalizeVehicleNumber(v.vehicleNumber || '');
        const tp = String(v.techPassportNumber || '').trim();
        return n === vehicleNumber && tp === techPassportNumber;
      });
      return hit?.id ? Number(hit.id) : null;
    } catch (error) {
      this.logger.warn(
        `⚠️ resolveSaVehicleIdFromActiveList failed (${vehicleNumber}): ${error}`,
      );
      return null;
    }
  }

  /**
   * ჩვენს ბაზაში დარეგისტრირებული მანქანების სია (იუზერებით)
   */
  async getRegisteredVehicles(): Promise<FinesVehicleDocument[]> {
    this.logger.debug('📋 Getting registered vehicles from database');
    return this.finesVehicleModel
      .find({ isActive: true })
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * ჩვენს ბაზაში დარეგისტრირებული მანქანები + მფლობელის ინფორმაცია (join User) — ადმინისთვის
   */
  async getRegisteredVehiclesWithOwners(): Promise<
    (FinesVehicleDocument & {
      owner?: {
        id: string;
        phone: string;
        firstName?: string;
        lastName?: string;
        email?: string;
      } | null;
    })[]
  > {
    this.logger.debug('📋 Getting registered vehicles with owners');
    const vehicles = await this.finesVehicleModel
      .find({ isActive: true })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    const userIds = [
      ...new Set(
        (vehicles as { userId?: string }[])
          .map((v) => v.userId)
          .filter(Boolean),
      ),
    ] as string[];
    const users = await this.userModel
      .find({ id: { $in: userIds } })
      .select('id phone firstName lastName email')
      .lean()
      .exec();

    const userMap = new Map<
      string,
      {
        id: string;
        phone: string;
        firstName?: string;
        lastName?: string;
        email?: string;
      }
    >();
    users.forEach(
      (u: {
        id: string;
        phone: string;
        firstName?: string;
        lastName?: string;
        email?: string;
      }) => userMap.set(String(u.id), u),
    );

    return (vehicles as { userId?: string }[]).map((v) => ({
      ...v,
      owner: v.userId ? (userMap.get(String(v.userId)) ?? null) : null,
    })) as (FinesVehicleDocument & {
      owner?: {
        id: string;
        phone: string;
        firstName?: string;
        lastName?: string;
        email?: string;
      } | null;
    })[];
  }

  /**
   * SA-ში რეგისტრაციის ლოგი — ვინ დაარეგისტრირა (ადმინისთვის, გარაჟის გარეშეც)
   * ყოველი saVehicleId-სთვის ბოლო ჩანაწერი + იუზერის სახელი
   */
  async getSaRegistrationsWithOwners(): Promise<
    {
      saVehicleId: number;
      userId: string;
      vehicleNumber: string;
      techPassportNumber: string;
      addDate?: string;
      owner?: { firstName?: string; lastName?: string } | null;
    }[]
  > {
    const logs = await this.finesRegistrationLogModel
      .find({})
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    const bySaId = new Map<
      number,
      {
        userId: string;
        vehicleNumber: string;
        techPassportNumber: string;
        addDate?: string;
      }
    >();
    for (const row of logs as {
      saVehicleId: number;
      userId: string;
      vehicleNumber: string;
      techPassportNumber: string;
      addDate?: string;
    }[]) {
      if (row.saVehicleId != null && !bySaId.has(row.saVehicleId)) {
        bySaId.set(row.saVehicleId, {
          userId: row.userId,
          vehicleNumber: row.vehicleNumber,
          techPassportNumber: row.techPassportNumber,
          addDate: row.addDate,
        });
      }
    }

    // ძველი ჩანაწერები (ლოგის გარეშე): FinesVehicle-იდან
    const fromDb = await this.finesVehicleModel
      .find({ isActive: true, saVehicleId: { $gt: 0 } })
      .lean()
      .exec();
    for (const v of fromDb as {
      saVehicleId: number;
      userId: string;
      vehicleNumber: string;
      techPassportNumber: string;
      addDate?: string;
    }[]) {
      if (v.saVehicleId != null && !bySaId.has(v.saVehicleId)) {
        bySaId.set(v.saVehicleId, {
          userId: v.userId,
          vehicleNumber: v.vehicleNumber,
          techPassportNumber: v.techPassportNumber,
          addDate: v.addDate,
        });
      }
    }

    const userIds = [
      ...new Set([...bySaId.values()].map((v) => v.userId).filter(Boolean)),
    ];
    const users = await this.userModel
      .find({ id: { $in: userIds } })
      .select('id firstName lastName')
      .lean()
      .exec();

    const userMap = new Map<
      string,
      { firstName?: string; lastName?: string }
    >();
    users.forEach(
      (u: { id: string; firstName?: string; lastName?: string }) => {
        userMap.set(String(u.id), {
          firstName: u.firstName,
          lastName: u.lastName,
        });
      },
    );

    return [...bySaId.entries()].map(([saVehicleId, v]) => ({
      saVehicleId,
      userId: v.userId,
      vehicleNumber: v.vehicleNumber,
      techPassportNumber: v.techPassportNumber,
      addDate: v.addDate,
      owner: v.userId ? (userMap.get(String(v.userId)) ?? null) : null,
    }));
  }

  /**
   * ადმინის გვერდისთვის ყველა მონაცემი ერთი request-ით
   */
  async getFinesAdminDashboardData(): Promise<{
    active: VehicleRegistration[];
    vehicles: (FinesVehicleDocument & {
      owner?: {
        id: string;
        phone: string;
        firstName?: string;
        lastName?: string;
        email?: string;
      } | null;
    })[];
    saRegistrations: {
      saVehicleId: number;
      userId: string;
      vehicleNumber: string;
      techPassportNumber: string;
      addDate?: string;
      owner?: { firstName?: string; lastName?: string } | null;
    }[];
  }> {
    const [active, vehicles, saRegistrations] = await Promise.all([
      this.getActiveVehicles(),
      this.getRegisteredVehiclesWithOwners(),
      this.getSaRegistrationsWithOwners(),
    ]);
    return { active, vehicles, saRegistrations };
  }

  /**
   * ჯარიმების cache (debug/admin):
   * - კონკრეტული იუზერისთვის ინახული penalties
   * - აქტიური და არქივიც (resolved) ერთად
   */
  async getPenaltyCacheByUser(userId: string): Promise<{
    userId: string;
    total: number;
    active: number;
    unpaidActive: number;
    items: FinesPenaltyCacheDocument[];
  }> {
    const items = await this.finesPenaltyCacheModel
      .find({ userId })
      .sort({ isActive: -1, isPayable: -1, lastSeenAt: -1, createdAt: -1 })
      .lean()
      .exec();

    const total = items.length;
    const active = items.filter((i) => i.isActive).length;
    const unpaidActive = items.filter((i) => i.isActive && i.isPayable).length;

    return {
      userId,
      total,
      active,
      unpaidActive,
      items: items as unknown as FinesPenaltyCacheDocument[],
    };
  }

  async reconcileMissingSaVehicleIds(limit = 500): Promise<{
    scanned: number;
    updated: number;
    unresolved: number;
  }> {
    const docs = await this.finesVehicleModel
      .find({ isActive: true, saVehicleId: { $in: [0, null] } })
      .limit(Math.max(1, Math.min(limit, 5000)))
      .exec();

    let updated = 0;
    let unresolved = 0;
    for (const d of docs) {
      const resolvedSaId = await this.resolveSaVehicleIdFromActiveList(
        d.vehicleNumber,
        d.techPassportNumber,
      );
      if (resolvedSaId && resolvedSaId > 0) {
        d.saVehicleId = resolvedSaId;
        await d.save();
        updated++;
      } else {
        unresolved++;
      }
    }

    this.logger.log(
      `🔧 reconcileMissingSaVehicleIds: scanned=${docs.length}, updated=${updated}, unresolved=${unresolved}`,
    );
    return { scanned: docs.length, updated, unresolved };
  }

  async syncAllActiveFinesUsersCache(): Promise<{
    usersScanned: number;
    usersWithUnpaid: number;
    totalUnpaid: number;
  }> {
    const vehicles = await this.finesVehicleModel
      .find({ isActive: true })
      .lean()
      .exec();

    if (vehicles.length === 0) {
      return { usersScanned: 0, usersWithUnpaid: 0, totalUnpaid: 0 };
    }

    const byUser = new Map<string, (typeof vehicles)[number][]>();
    for (const v of vehicles) {
      const uid = String(v.userId || '').trim();
      if (!uid) continue;
      const list = byUser.get(uid) ?? [];
      list.push(v);
      byUser.set(uid, list);
    }

    let usersScanned = 0;
    for (const [userId, userVehicles] of byUser) {
      usersScanned++;
      for (const v of userVehicles) {
        try {
          await this.syncPenaltyCacheForVehicle(
            userId,
            this.normalizeVehicleNumber(v.vehicleNumber),
            String(v.techPassportNumber || '').trim(),
          );
        } catch (e) {
          this.logger.warn(
            `Cache sync failed for user=${userId}, vehicle=${v.vehicleNumber}: ${e}`,
          );
        }
      }
    }

    const rows = await this.finesPenaltyCacheModel.aggregate<UnpaidAggRow>([
      { $match: { isActive: true, isPayable: true } },
      { $group: { _id: '$userId', unpaidCount: { $sum: 1 } } },
    ]);

    const usersWithUnpaid = rows.length;
    const totalUnpaid = rows.reduce(
      (acc: number, r: { unpaidCount?: number }) =>
        acc + Number(r.unpaidCount || 0),
      0,
    );

    return { usersScanned, usersWithUnpaid, totalUnpaid };
  }

  async getUnpaidUsersFromCache(): Promise<
    { userId: string; unpaidCount: number; activeVehicles: number }[]
  > {
    const rows = await this.finesPenaltyCacheModel.aggregate<UnpaidAggRow>([
      { $match: { isActive: true, isPayable: true } },
      { $group: { _id: '$userId', unpaidCount: { $sum: 1 } } },
      { $sort: { unpaidCount: -1 } },
    ]);

    const vehicleRows = await this.finesVehicleModel.aggregate<VehiclesAggRow>([
      { $match: { isActive: true } },
      { $group: { _id: '$userId', activeVehicles: { $sum: 1 } } },
    ]);
    const vehicleMap = new Map<string, number>(
      vehicleRows.map((r: { _id: string; activeVehicles?: number }) => [
        String(r._id),
        Number(r.activeVehicles || 0),
      ]),
    );

    return rows.map((r: { _id: string; unpaidCount?: number }) => ({
      userId: String(r._id),
      unpaidCount: Number(r.unpaidCount || 0),
      activeVehicles: vehicleMap.get(String(r._id)) || 0,
    }));
  }

  async sendCustomPushToUnpaidUsers(
    title: string,
    body: string,
  ): Promise<{ targets: number; sent: number }> {
    const unpaidUsers = await this.getUnpaidUsersFromCache();
    const targets = unpaidUsers.map((u) => ({ userId: u.userId }));
    if (targets.length === 0) return { targets: 0, sent: 0 };

    await this.notificationsService.sendPushToTargets(
      targets,
      {
        title,
        body,
        data: {
          type: 'garage_fines_reminder',
          screen: 'GarageFines',
          source: 'admin_manual',
          timestamp: new Date().toISOString(),
        },
        sound: 'default',
        badge: 1,
      },
      'system',
    );

    return { targets: targets.length, sent: targets.length };
  }

  /**
   * მანქანის ამოღება ჯარიმების სისტემიდან (ბაზაში deactivate + გამოწერის გაუქმება, SA-ში DELETE თუ id არსებობს)
   */
  async removeVehicleFromFines(
    userId: string,
    vehicleNumber: string,
  ): Promise<{ success: boolean; message: string }> {
    const formatted = this.formatVehicleNumber(vehicleNumber);

    const vehicle = await this.finesVehicleModel.findOne({
      userId,
      vehicleNumber: formatted,
      isActive: true,
    });

    if (vehicle) {
      vehicle.isActive = false;
      vehicle.cancelDate = new Date().toISOString();
      await vehicle.save();
      this.logger.log(
        `🗑️ Vehicle deactivated in DB: ${formatted} (user: ${userId})`,
      );

      if (vehicle.saVehicleId && vehicle.saVehicleId > 0) {
        try {
          await this.authenticatedRequest<void>(
            `/patrolpenalties/vehicles/${vehicle.saVehicleId}`,
            { method: 'DELETE' },
            10000,
          );
          this.logger.log(
            `🗑️ Vehicle removed from SA: id=${vehicle.saVehicleId}`,
          );
        } catch (err) {
          this.logger.warn(
            `⚠️ SA DELETE vehicle failed (id=${vehicle.saVehicleId}), vehicle still deactivated in our DB: ${err}`,
          );
        }
      }
    }

    const subs = await this.carFinesSubscriptionModel
      .find({
        userId,
        vehicleNumber: formatted,
        status: { $in: ['active', 'pending'] },
      })
      .exec();

    for (const sub of subs) {
      sub.status = 'cancelled';
      sub.endDate = new Date();
      await sub.save();
      this.logger.log(
        `🚫 Car fines subscription cancelled: ${String(sub._id)} (${formatted})`,
      );
    }

    return {
      success: true,
      message:
        vehicle || subs.length > 0
          ? 'მანქანა სისტემიდან ამოღებულია'
          : 'მანქანა ვერ მოიძებნა',
    };
  }

  /**
   * კონკრეტული იუზერის დარეგისტრირებული მანქანები (ბაზიდან — ნებისმიერი მოწყობილობიდან ჩანს)
   * დააბრუნებს VehicleRegistration[] ფორმატში, რომ ფრონტი ნებისმიერ დივაისზე იმუშაოს.
   */
  async getUserRegisteredVehicles(
    userId: string,
  ): Promise<VehicleRegistration[]> {
    this.logger.debug(`📋 Getting vehicles for user: ${userId}`);
    const docs = await this.finesVehicleModel
      .find({ userId, isActive: true })
      .sort({ createdAt: -1 })
      .exec();
    return docs.map((d) => ({
      id: d.saVehicleId,
      vehicleNumber: d.vehicleNumber,
      techPassportNumber: d.techPassportNumber,
      addDate: d.addDate,
      cancelDate: d.cancelDate,
    }));
  }

  // ==========================================
  // CarFinesSubscription მეთოდები
  // ==========================================

  /**
   * მანქანაზე ჯარიმების გამოწერის შექმნა
   * პრემიუმის პირველი მანქანა უფასოა, დამატებითი = 1₾/თვე
   */
  async createCarFinesSubscription(
    userId: string,
    carId: string,
    vehicleNumber: string,
    techPassportNumber: string,
  ): Promise<CarFinesSubscriptionDocument> {
    // შევამოწმოთ პრემიუმ სტატუსი
    const subscription =
      await this.subscriptionsService.getUserSubscription(userId);
    const isPremium =
      subscription?.planId === 'premium' && subscription?.status === 'active';

    if (!isPremium) {
      throw new HttpException(
        'მანქანის გამოწერისთვის საჭიროა პრემიუმ პაკეტი',
        HttpStatus.FORBIDDEN,
      );
    }

    const formattedVehicleNumber = this.formatVehicleNumber(vehicleNumber);

    // შევამოწმოთ ეს მანქანა უკვე ხომ არ არის გამოწერილი
    const existing = await this.carFinesSubscriptionModel.findOne({
      userId,
      carId,
      status: { $in: ['active', 'pending'] },
    });

    if (existing) {
      this.logger.log(
        `ℹ️ Car ${carId} already has subscription, returning existing`,
      );
      return existing;
    }

    // რამდენი აქტიური გამოწერა აქვს?
    const activeCount = await this.carFinesSubscriptionModel.countDocuments({
      userId,
      status: 'active',
    });

    // პირველი მანქანა უფასოა (პრემიუმში ჩათვლილი)
    const isFirstCar = activeCount === 0;

    const now = new Date();
    const nextBilling = new Date(now);
    nextBilling.setMonth(nextBilling.getMonth() + 1);

    const newSub = new this.carFinesSubscriptionModel({
      userId,
      carId,
      vehicleNumber: formattedVehicleNumber,
      techPassportNumber: techPassportNumber.trim(),
      price: isFirstCar ? 0 : 1, // პირველი უფასო, დანარჩენი 1₾
      status: isFirstCar ? 'active' : 'pending', // პირველი ავტომატურად აქტიური
      startDate: now,
      nextBillingDate: isFirstCar ? nextBilling : undefined,
      isPaid: isFirstCar, // პირველი გადახდილია (უფასო)
      isFirstCar,
      totalPaid: 0,
      billingCycles: 0,
    });

    const saved = await newSub.save();
    this.logger.log(
      `✅ Car fines subscription created: ${String(saved._id)} (car: ${formattedVehicleNumber}, isFirst: ${isFirstCar})`,
    );

    return saved;
  }

  /**
   * მანქანის გამოწერის გადახდის დადასტურება
   */
  async confirmCarFinesPayment(
    subscriptionId: string,
    transactionId?: string,
    bogCardToken?: string,
  ): Promise<CarFinesSubscriptionDocument> {
    const sub = await this.carFinesSubscriptionModel.findById(subscriptionId);

    if (!sub) {
      throw new HttpException('გამოწერა ვერ მოიძებნა', HttpStatus.NOT_FOUND);
    }

    const now = new Date();
    const nextBilling = new Date(now);
    nextBilling.setMonth(nextBilling.getMonth() + 1);

    sub.isPaid = true;
    sub.status = 'active';
    sub.lastPaymentDate = now;
    sub.nextBillingDate = nextBilling;
    sub.billingCycles += 1;
    sub.totalPaid += sub.price;
    if (transactionId) {
      sub.paymentTransactionId = transactionId;
    }
    if (bogCardToken) {
      sub.bogCardToken = bogCardToken;
    }

    const updated = await sub.save();
    this.logger.log(
      `✅ Car fines payment confirmed: ${String(updated._id)} (car: ${updated.vehicleNumber}, bogCardToken: ${bogCardToken || 'N/A'})`,
    );

    // გადახდის შემდეგ subscription-ის maxFinesCars ლიმიტი გავზარდოთ +1-ით
    // მხოლოდ თუ ეს არ არის პირველი მანქანა (პირველი პრემიუმში შედის უფასოდ)
    if (!updated.isFirstCar) {
      try {
        await this.subscriptionsService.upgradeFinesCarsLimit(
          updated.userId,
          1,
        );
        this.logger.log(
          `✅ maxFinesCars ლიმიტი გაიზარდა +1-ით user: ${updated.userId}`,
        );
      } catch (upgradeError) {
        this.logger.error(
          `❌ maxFinesCars ლიმიტის გაზრდა ვერ მოხერხდა: ${upgradeError instanceof Error ? upgradeError.message : 'Unknown error'}`,
        );
      }
    }

    return updated;
  }

  /**
   * CarFinesSubscription-ის მოძებნა carId-ით (pending ან active)
   */
  async findCarFinesSubscriptionByCarId(
    carId: string,
  ): Promise<CarFinesSubscriptionDocument | null> {
    return this.carFinesSubscriptionModel
      .findOne({ carId, status: { $in: ['pending', 'active'] } })
      .exec();
  }

  /**
   * შევამოწმოთ მანქანას აქვს თუ არა აქტიური გადახდილი გამოწერა
   */
  async isCarFinesActive(
    userId: string,
    carId: string,
  ): Promise<{
    isActive: boolean;
    subscription: CarFinesSubscriptionDocument | null;
  }> {
    const sub = await this.carFinesSubscriptionModel.findOne({
      userId,
      carId,
      status: 'active',
      isPaid: true,
    });

    return {
      isActive: !!sub,
      subscription: sub,
    };
  }

  /**
   * მანქანას აქვს თუ არა აქტიური გამოწერა vehicleNumber-ით
   */
  async isCarFinesActiveByPlate(
    userId: string,
    vehicleNumber: string,
  ): Promise<boolean> {
    const formattedVehicleNumber = this.formatVehicleNumber(vehicleNumber);
    const sub = await this.carFinesSubscriptionModel.findOne({
      userId,
      vehicleNumber: formattedVehicleNumber,
      status: 'active',
      isPaid: true,
    });
    return !!sub;
  }

  /**
   * იუზერის ყველა მანქანის გამოწერა
   */
  async getUserCarFinesSubscriptions(
    userId: string,
  ): Promise<CarFinesSubscriptionDocument[]> {
    return this.carFinesSubscriptionModel
      .find({ userId, status: { $in: ['active', 'pending'] } })
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * გამოწერის გაუქმება
   */
  async cancelCarFinesSubscription(
    subscriptionId: string,
  ): Promise<CarFinesSubscriptionDocument> {
    const sub = await this.carFinesSubscriptionModel.findById(subscriptionId);

    if (!sub) {
      throw new HttpException('გამოწერა ვერ მოიძებნა', HttpStatus.NOT_FOUND);
    }

    sub.status = 'cancelled';
    sub.endDate = new Date();
    const updated = await sub.save();

    this.logger.log(
      `🚫 Car fines subscription cancelled: ${String(updated._id)} (car: ${updated.vehicleNumber})`,
    );

    return updated;
  }

  /**
   * ვადაგასული გამოწერების შემოწმება და deactivation
   * (შეიძლება cron job-ით გაეშვას ყოველდღე)
   */
  async checkExpiredSubscriptions(): Promise<number> {
    const now = new Date();
    const expired = await this.carFinesSubscriptionModel.updateMany(
      {
        status: 'active',
        isPaid: true,
        isFirstCar: false,
        nextBillingDate: { $lt: now },
      },
      {
        $set: { isPaid: false, status: 'expired' },
      },
    );

    if (expired.modifiedCount > 0) {
      this.logger.log(
        `⏰ ${expired.modifiedCount} car fines subscriptions expired`,
      );
    }

    return expired.modifiedCount;
  }

  private async syncPenaltyCacheForVehicle(
    userId: string,
    vehicleNumberRaw: string,
    techPassportNumber: string,
  ): Promise<number> {
    const vehicleNumber = this.normalizeVehicleNumber(vehicleNumberRaw);
    const tp = String(techPassportNumber || '').trim();
    if (!vehicleNumber || !tp) return 0;

    const now = new Date();
    const penalties = await this.getPenalties(vehicleNumber, tp);
    const currentProtocolIds = new Set<number>();

    if (penalties.length > 0) {
      const ops = penalties.map((p) => {
        const protocolId = Number(p.protocolId);
        currentProtocolIds.add(protocolId);
        return {
          updateOne: {
            filter: { userId, vehicleNumber, protocolId },
            update: {
              $setOnInsert: { firstSeenAt: now },
              $set: {
                techPassportNumber: tp,
                penaltyNumber: p.penaltyNumber,
                penaltyTypeName: p.penaltyTypeName,
                finalAmount: p.finalAmount,
                isPayable: Boolean(p.isPayable),
                violationDate: p.violationDate,
                fineDate: p.fineDate,
                penaltyDate: p.penaltyDate,
                raw: p as unknown as Record<string, unknown>,
                isActive: true,
                lastSeenAt: now,
                resolvedAt: null,
              },
            },
            upsert: true,
          },
        };
      });
      if (ops.length > 0) {
        await this.finesPenaltyCacheModel.bulkWrite(ops, { ordered: false });
      }
    }

    const protocolIds = [...currentProtocolIds];
    if (protocolIds.length > 0) {
      await this.finesPenaltyCacheModel.updateMany(
        {
          userId,
          vehicleNumber,
          isActive: true,
          protocolId: { $nin: protocolIds },
        },
        { $set: { isActive: false, isPayable: false, resolvedAt: now } },
      );
    } else {
      await this.finesPenaltyCacheModel.updateMany(
        { userId, vehicleNumber, isActive: true },
        { $set: { isActive: false, isPayable: false, resolvedAt: now } },
      );
    }

    return penalties.filter((p) => p.isPayable).length;
  }

  private async getCachedUnpaidCountForUser(userId: string): Promise<number> {
    return this.finesPenaltyCacheModel.countDocuments({
      userId,
      isActive: true,
      isPayable: true,
    });
  }

  /**
   * გარაჟში დარეგისტრირებული მანქანების გადასახდელი ჯარიმების შეხსენება.
   * ჯარიმების ინფო (push) მხოლოდ აქტიური პრემიუმისას: (1) SA-ზე შემოწმებამდე,
   * (2) გაგზავნამდე ხელახლა — რომ გაუქმებული პრემიუმისას არ გაეგზავნოს.
   * დღეში 2x — ~10:00 და ~19:00 თბილისი (+ იმავე ფანჯრის catch-up).
   */
  @Cron('*/5 * * * *', { timeZone: 'Asia/Tbilisi' })
  async sendGarageUnpaidFinesReminderPushes(
    forceRun = false,
    targetUserId?: string,
  ): Promise<{ usersProcessed: number; pushes: number; slotKey: string }> {
    const now = Date.now();
    const slotKey = forceRun
      ? `manual_${new Date(now).toISOString()}`
      : this.finesReminderSlotKey(now);
    if (!slotKey) return { usersProcessed: 0, pushes: 0, slotKey: '' };
    if (this.isSendingFinesReminders) {
      return { usersProcessed: 0, pushes: 0, slotKey };
    }

    this.isSendingFinesReminders = true;
    const todayStr = this.getTbilisiYmdAndMinutes(new Date(now)).ymd;
    let usersProcessed = 0;
    let pushes = 0;

    try {
      const vehicles = await this.finesVehicleModel
        .find({ isActive: true })
        .lean()
        .exec();

      if (vehicles.length === 0) {
        return { usersProcessed: 0, pushes: 0, slotKey };
      }

      const byUser = new Map<string, (typeof vehicles)[number][]>();
      for (const v of vehicles) {
        const uid = String(v.userId);
        const list = byUser.get(uid) ?? [];
        list.push(v);
        byUser.set(uid, list);
      }

      for (const [userId, userVehicles] of byUser) {
        if (targetUserId && userId !== targetUserId) continue;
        if (!forceRun) {
          const sent = await this.finesDailyReminderModel
            .findOne({ userId, ymd: todayStr })
            .select('slots')
            .lean()
            .exec();
          if (sent?.slots?.includes(slotKey)) continue;
        }

        const sub = await this.subscriptionsService.getUserSubscription(userId);
        if (!this.userHasPremiumForFinesReminders(sub)) {
          if (forceRun) continue;
          await this.finesDailyReminderModel.updateOne(
            { userId, ymd: todayStr },
            { $addToSet: { slots: slotKey } },
            { upsert: true },
          );
          continue;
        }

        let syncHadSuccess = false;
        for (const v of userVehicles) {
          const plateSa = this.normalizeVehicleNumber(v.vehicleNumber);
          const tp = String(v.techPassportNumber || '').trim();
          if (!plateSa || !tp) continue;
          try {
            await this.syncPenaltyCacheForVehicle(userId, plateSa, tp);
            syncHadSuccess = true;
          } catch (e) {
            this.logger.warn(
              `Fines reminder: cache sync failed for ${plateSa} (user ${userId}): ${e}`,
            );
          }
          await new Promise((r) => setTimeout(r, 120));
        }

        const totalPayable = await this.getCachedUnpaidCountForUser(userId);

        usersProcessed++;

        if (totalPayable > 0) {
          const subNow =
            await this.subscriptionsService.getUserSubscription(userId);
          if (!this.userHasPremiumForFinesReminders(subNow)) {
            this.logger.debug(
              `Garage fines reminder: ჯარიმების push არ გაიგზავნა (userId=${userId}) — აქტიური პრემიუმი არ არის`,
            );
          } else {
            const body =
              totalPayable === 1
                ? 'გაქვს 1 გადასახდელი ჯარიმა — შეამოწმე გარაჟში.'
                : `გაქვს ${totalPayable} გადასახდელი ჯარიმა — შეამოწმე გარაჟში.`;

            await this.notificationsService.sendPushToTargets(
              [{ userId }],
              {
                title: 'ჯარიმები',
                body,
                data: {
                  type: 'garage_fines_reminder',
                  screen: 'GarageFines',
                  unpaidCount: String(totalPayable),
                },
              },
              'system',
            );
            pushes++;
          }
        }

        if (!syncHadSuccess) {
          this.logger.debug(
            `Fines reminder: user ${userId} - sync სრულად ჩავარდა, გამოყენებულია არსებული cache`,
          );
        }

        if (!forceRun) {
          await this.finesDailyReminderModel.updateOne(
            { userId, ymd: todayStr },
            { $addToSet: { slots: slotKey } },
            { upsert: true },
          );
        }
      }

      if (usersProcessed > 0) {
        this.logger.log(
          `📣 Garage fines reminders [slot ${slotKey}]: users=${usersProcessed}, pushes=${pushes}`,
        );
      }
      return { usersProcessed, pushes, slotKey };
    } finally {
      this.isSendingFinesReminders = false;
    }
  }

  /**
   * ყოველდღიური ჯარიმების შემოწმება აქტიური გამოწერებისთვის
   * (cron job-ისთვის)
   */
  async checkFinesForActiveSubscriptions(): Promise<{
    checked: number;
    withFines: number;
  }> {
    const activeSubs = await this.carFinesSubscriptionModel
      .find({ status: 'active', isPaid: true })
      .exec();

    this.logger.log(
      `🔍 Checking fines for ${activeSubs.length} active subscriptions`,
    );

    let checked = 0;
    let withFines = 0;

    for (const sub of activeSubs) {
      try {
        const penalties = await this.getPenalties(
          sub.vehicleNumber,
          sub.techPassportNumber,
        );
        checked++;
        if (penalties.length > 0) {
          withFines++;
          this.logger.log(
            `⚠️ Found ${penalties.length} fines for ${sub.vehicleNumber} (user: ${sub.userId})`,
          );
          // Push: გარაჟის FinesVehicle + sendGarageUnpaidFinesReminderPushes
        }
      } catch (error) {
        this.logger.error(
          `❌ Failed to check fines for ${sub.vehicleNumber}: ${error}`,
        );
      }
    }

    this.logger.log(
      `✅ Daily fines check complete: ${checked} checked, ${withFines} with fines`,
    );

    return { checked, withFines };
  }
}
