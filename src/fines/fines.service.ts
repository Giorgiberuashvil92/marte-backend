import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
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
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

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

const SA_CLIENT_ID = 'martegeo';
const SA_CLIENT_SECRET = 'VJ.e35U~9M6£zQY';

@Injectable()
export class FinesService {
  private readonly logger = new Logger(FinesService.name);
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(
    private configService: ConfigService,
    @InjectModel(FinesVehicle.name)
    private finesVehicleModel: Model<FinesVehicleDocument>,
    @InjectModel(CarFinesSubscription.name)
    private carFinesSubscriptionModel: Model<CarFinesSubscriptionDocument>,
    private subscriptionsService: SubscriptionsService,
  ) {}

  /**
   * Format vehicle number: MI999SS -> MI-999-SS
   */
  private formatVehicleNumber(plate: string): string {
    const cleaned = plate
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
    // Pattern: 2 letters, 3 digits, 2 letters (e.g., MI999SS -> MI-999-SS)
    if (cleaned.length >= 7) {
      const letters1 = cleaned.substring(0, 2);
      const digits = cleaned.substring(2, 5);
      const letters2 = cleaned.substring(5, 7);
      return `${letters1}-${digits}-${letters2}`;
    }
    return cleaned;
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
   * Authenticated request helper
   */
  private async authenticatedRequest<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const token = await this.getAccessToken();
    const fullUrl = `${SA_PUBLIC_API_URL}${endpoint}`;

    this.logger.debug(`🌐 API Request: ${options.method || 'GET'} ${fullUrl}`);
    this.logger.debug(`   Authorization: Bearer ${token.substring(0, 20)}...`);
    if (options.body) {
      const bodyStr =
        typeof options.body === 'string'
          ? options.body
          : JSON.stringify(options.body);
      this.logger.debug(`   Body: ${bodyStr.substring(0, 200)}...`);
    }

    const response = await fetch(fullUrl, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`, // სრული token, არა substring!
        ...options.headers,
      },
    });

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

    // Request body exactly as per Swagger documentation
    const data = {
      VehicleNumber: formattedVehicleNumber,
      TechPassportNumber: techPassportNumber.trim(),
      MediaFile: mediaFile,
    };

    this.logger.debug(
      `🚗 Registering vehicle: ${formattedVehicleNumber} for user ${userId}, MediaFile: ${mediaFile}`,
    );
    this.logger.debug(`   Request body: ${JSON.stringify(data)}`);

    try {
      // რეგისტრაცია SA.gov.ge API-ში
      const response = await this.authenticatedRequest<{ id: number }>(
        '/patrolpenalties/vehicles',
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
      );

      const saVehicleId = response.id;

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
          existing.saVehicleId = saVehicleId;
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
            saVehicleId,
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

      this.logger.log(`✅ Vehicle registered with SA ID: ${saVehicleId}`);
      return saVehicleId;
    } catch (error) {
      this.logger.error(
        `❌ Vehicle registration failed for ${formattedVehicleNumber}: ${error}`,
      );
      throw error;
    }
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
   * კონკრეტული იუზერის დარეგისტრირებული მანქანები
   */
  async getUserRegisteredVehicles(
    userId: string,
  ): Promise<FinesVehicleDocument[]> {
    this.logger.debug(`📋 Getting vehicles for user: ${userId}`);
    return this.finesVehicleModel
      .find({ userId, isActive: true })
      .sort({ createdAt: -1 })
      .exec();
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
          // TODO: push notification-ის გაგზავნა
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
