import {
  Controller,
  Get,
  Post,
  Delete,
  Query,
  Param,
  Body,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { FinesService } from './fines.service';
import { CheckPenaltiesDto } from './dto/check-penalties.dto';
import { GetMediaFilesDto } from './dto/get-media-files.dto';
import { RegisterVehicleDto } from './dto/register-vehicle.dto';

@Controller('fines')
export class FinesController {
  constructor(private readonly finesService: FinesService) {}

  /**
   * ჯარიმების შემოწმება
   * GET /fines/penalties?vehicleNumber=TB-123-AB&techPassportNumber=123456789
   */
  @Get('penalties')
  async getPenalties(@Query() query: CheckPenaltiesDto) {
    try {
      console.log('📥 [FINES CONTROLLER] getPenalties request:', {
        vehicleNumber: query.vehicleNumber,
        techPassportNumber: query.techPassportNumber
          ? `${query.techPassportNumber.substring(0, 4)}...`
          : undefined,
      });

      const result = await this.finesService.getPenalties(
        query.vehicleNumber,
        query.techPassportNumber,
      );

      console.log('✅ [FINES CONTROLLER] getPenalties success:', {
        count: Array.isArray(result) ? result.length : 0,
      });

      return result;
    } catch (error) {
      console.error('❌ [FINES CONTROLLER] getPenalties error:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'ჯარიმების მოპოვება ვერ მოხერხდა',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * ვიდეო ჯარიმების ნახვა
   * GET /fines/media/:protocolId?vehicleNumber=TB-123-AB&techPassportNumber=123456789
   */
  @Get('media/:protocolId')
  async getMediaFiles(
    @Param('protocolId') protocolId: string,
    @Query() query: Omit<GetMediaFilesDto, 'protocolId'>,
  ) {
    try {
      return await this.finesService.getPenaltyMediaFiles(
        query.vehicleNumber,
        query.techPassportNumber,
        parseInt(protocolId, 10),
      );
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'ვიდეო ჯარიმების მოპოვება ვერ მოხერხდა',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * მანქანის რეგისტრაცია
   * POST /fines/vehicles/register
   */
  @Post('vehicles/register')
  async registerVehicle(@Body() dto: RegisterVehicleDto) {
    try {
      const id = await this.finesService.registerVehicle(
        dto.userId,
        dto.vehicleNumber,
        dto.techPassportNumber,
        dto.mediaFile || false,
      );
      return { id };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      // უცნობი შეცდომა (DB, ქსელი და ა.შ.) – ლოგი Railway-ზე დიაგნოსტიკისთვის
      console.error('[FINES] registerVehicle error:', error);
      throw new HttpException(
        'მანქანის რეგისტრაცია ვერ მოხერხდა',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * მანქანის გადამოწმება
   * GET /fines/vehicles/validate?vehicleNumber=TB-123-AB&techPassportNumber=123456789
   */
  @Get('vehicles/validate')
  async validateVehicle(
    @Query('vehicleNumber') vehicleNumber: string,
    @Query('techPassportNumber') techPassportNumber: string,
  ) {
    try {
      const isValid = await this.finesService.validateVehicle(
        vehicleNumber,
        techPassportNumber,
      );
      return { isValid };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'მანქანის გადამოწმება ვერ მოხერხდა',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * აქტიური მანქანების სია (SA.gov.ge API-დან)
   * GET /fines/vehicles/active
   */
  @Get('vehicles/active')
  async getActiveVehicles() {
    try {
      return await this.finesService.getActiveVehicles();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'აქტიური მანქანების მოპოვება ვერ მოხერხდა',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * ჩვენს ბაზაში დარეგისტრირებული მანქანების სია (იუზერებით)
   * GET /fines/vehicles/registered
   */
  @Get('vehicles/registered')
  async getRegisteredVehicles() {
    try {
      return await this.finesService.getRegisteredVehicles();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'დარეგისტრირებული მანქანების მოპოვება ვერ მოხერხდა',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * დარეგისტრირებული მანქანები + მფლობელი (join User) — ადმინ პანელისთვის
   * GET /fines/vehicles/registered-with-owners
   */
  @Get('vehicles/registered-with-owners')
  async getRegisteredVehiclesWithOwners() {
    try {
      return await this.finesService.getRegisteredVehiclesWithOwners();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'დარეგისტრირებული მანქანების მოპოვება ვერ მოხერხდა',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * SA-ში რეგისტრაციის ლოგი — ვინ დაარეგისტრირა (saVehicleId → იუზერის სახელი), ადმინისთვის
   * GET /fines/vehicles/sa-registrations
   */
  @Get('vehicles/sa-registrations')
  async getSaRegistrationsWithOwners() {
    try {
      return await this.finesService.getSaRegistrationsWithOwners();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'SA რეგისტრაციების ლოგის მოპოვება ვერ მოხერხდა',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * ადმინის გვერდისთვის ყველა მონაცემი ერთი request-ით (active + vehicles + saRegistrations)
   * GET /fines/vehicles/admin-dashboard
   */
  @Get('vehicles/admin-dashboard')
  async getFinesAdminDashboard() {
    try {
      return await this.finesService.getFinesAdminDashboardData();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'ჯარიმების ადმინ მონაცემების მოპოვება ვერ მოხერხდა',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * saVehicleId = 0/NULL ჩანაწერების მასობრივი გასწორება SA Active სიიდან
   * POST /fines/vehicles/reconcile-sa-ids
   * body: { limit?: number }
   */
  @Post('vehicles/reconcile-sa-ids')
  async reconcileMissingSaIds(@Body() body: { limit?: number } = {}) {
    try {
      const limit =
        typeof body.limit === 'number' && body.limit > 0 ? body.limit : 500;
      const result =
        await this.finesService.reconcileMissingSaVehicleIds(limit);
      return { success: true, ...result };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'SA ID-ების reconcile ვერ შესრულდა',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * მანქანის ამოღება ჯარიმების სისტემიდან
   * POST /fines/vehicles/remove
   */
  @Post('vehicles/remove')
  async removeVehicleFromFines(
    @Body() body: { userId: string; vehicleNumber: string },
  ) {
    try {
      const result = await this.finesService.removeVehicleFromFines(
        body.userId,
        body.vehicleNumber,
      );
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'მანქანის ამოღება ვერ მოხერხდა',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * ადმინისთვის: SA Vehicle ID-ით წაშლა
   * DELETE /fines/vehicles/sa/:saVehicleId
   */
  @Delete('vehicles/sa/:saVehicleId')
  async removeVehicleBySaId(@Param('saVehicleId') saVehicleId: string) {
    try {
      return await this.finesService.removeVehicleBySaIdForAdmin(
        Number(saVehicleId),
      );
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'SA ID-ით მანქანის წაშლა ვერ მოხერხდა',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * კონკრეტული იუზერის დარეგისტრირებული მანქანები
   * GET /fines/vehicles/user/:userId
   */
  @Get('vehicles/user/:userId')
  async getUserRegisteredVehicles(@Param('userId') userId: string) {
    try {
      return await this.finesService.getUserRegisteredVehicles(userId);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'იუზერის მანქანების მოპოვება ვერ მოხერხდა',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * იუზერის ჯარიმების მანქანების ლიმიტის ინფორმაცია
   * GET /fines/vehicles/limit/:userId
   */
  @Get('vehicles/limit/:userId')
  async getUserFinesCarLimit(@Param('userId') userId: string) {
    try {
      return await this.finesService.getUserFinesCarLimit(userId);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'ლიმიტის ინფორმაციის მოპოვება ვერ მოხერხდა',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ==========================================
  // CarFinesSubscription ენდპოინტები
  // ==========================================

  /**
   * მანქანაზე ჯარიმების გამოწერის შექმნა
   * POST /fines/car-subscription
   */
  @Post('car-subscription')
  async createCarFinesSubscription(
    @Body()
    body: {
      userId: string;
      carId: string;
      vehicleNumber: string;
      techPassportNumber: string;
    },
  ) {
    try {
      const sub = await this.finesService.createCarFinesSubscription(
        body.userId,
        body.carId,
        body.vehicleNumber,
        body.techPassportNumber,
      );
      return {
        success: true,
        data: sub,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'მანქანის გამოწერის შექმნა ვერ მოხერხდა',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * იუზერის მანქანის გამოწერები
   * GET /fines/car-subscriptions/:userId
   */
  @Get('car-subscriptions/:userId')
  async getUserCarFinesSubscriptions(@Param('userId') userId: string) {
    try {
      return await this.finesService.getUserCarFinesSubscriptions(userId);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'მანქანის გამოწერების მოპოვება ვერ მოხერხდა',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * შევამოწმოთ კონკრეტულ მანქანას აქვს თუ არა აქტიური გამოწერა
   * GET /fines/car-subscription/check/:userId/:carId
   */
  @Get('car-subscription/check/:userId/:carId')
  async checkCarFinesSubscription(
    @Param('userId') userId: string,
    @Param('carId') carId: string,
  ) {
    try {
      return await this.finesService.isCarFinesActive(userId, carId);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'გამოწერის შემოწმება ვერ მოხერხდა',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * გამოწერის გადახდის დადასტურება
   * POST /fines/car-subscription/confirm-payment
   */
  @Post('car-subscription/confirm-payment')
  async confirmCarFinesPayment(
    @Body()
    body: {
      subscriptionId: string;
      transactionId?: string;
      bogCardToken?: string;
    },
  ) {
    try {
      const sub = await this.finesService.confirmCarFinesPayment(
        body.subscriptionId,
        body.transactionId,
        body.bogCardToken,
      );
      return {
        success: true,
        data: sub,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'გადახდის დადასტურება ვერ მოხერხდა',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * გამოწერის გაუქმება
   * POST /fines/car-subscription/cancel/:subscriptionId
   */
  @Post('car-subscription/cancel/:subscriptionId')
  async cancelCarFinesSubscription(
    @Param('subscriptionId') subscriptionId: string,
  ) {
    try {
      const sub =
        await this.finesService.cancelCarFinesSubscription(subscriptionId);
      return {
        success: true,
        data: sub,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'გამოწერის გაუქმება ვერ მოხერხდა',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * ჯარიმების reminder push-ის ხელით გაშვება (admin/debug)
   * POST /fines/reminders/send-now
   * body: { userId?: string }
   */
  @Post('reminders/send-now')
  async sendFinesRemindersNow(@Body() body: { userId?: string } = {}) {
    try {
      const result =
        await this.finesService.sendGarageUnpaidFinesReminderPushes(
          true,
          body?.userId?.trim() || undefined,
        );
      return {
        success: true,
        message: 'Fines reminder push გაშვებულია ხელით',
        ...result,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Fines reminder push-ის ხელით გაშვება ვერ მოხერხდა',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * ყველა აქტიური fines მანქანის cache-sync (admin/debug)
   * POST /fines/cache/sync-all
   */
  @Post('cache/sync-all')
  async syncAllFinesCache() {
    try {
      const result = await this.finesService.syncAllActiveFinesUsersCache();
      const users = await this.finesService.getUnpaidUsersFromCache();
      return {
        success: true,
        ...result,
        totalUsers: users.length,
        users,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        'Fines cache sync ვერ შესრულდა',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * ყველა იუზერი, ვისაც cache-ში unpaid აქვს
   * GET /fines/cache/unpaid-users
   */
  @Get('cache/unpaid-users')
  async getUnpaidUsersFromCache() {
    try {
      const users = await this.finesService.getUnpaidUsersFromCache();
      return {
        success: true,
        totalUsers: users.length,
        users,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        'Fines unpaid users ვერ მოიძებნა',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * იუზერის ჯარიმების cache (debug/admin)
   * GET /fines/cache/:userId
   */
  @Get('cache/:userId')
  async getPenaltyCacheByUser(@Param('userId') userId: string) {
    try {
      // Safety fallback: ზოგ გარემოში dynamic route შეიძლება static-ს გადააჯდეს.
      // ასეთ შემთხვევაში მაინც დავაბრუნოთ unpaid-users endpoint-ის სწორი პასუხი.
      if (userId === 'unpaid-users') {
        const users = await this.finesService.getUnpaidUsersFromCache();
        return {
          success: true,
          totalUsers: users.length,
          users,
        };
      }
      return await this.finesService.getPenaltyCacheByUser(userId);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'ჯარიმების cache-ის წამოღება ვერ მოხერხდა',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * ერთი ტექსტის გაგზავნა ყველა unpaid იუზერზე (admin/manual)
   * POST /fines/reminders/send-custom
   */
  @Post('reminders/send-custom')
  async sendCustomFinesPush(
    @Body() body: { title?: string; body?: string } = {},
  ) {
    try {
      const title = String(body.title || '').trim();
      const text = String(body.body || '').trim();
      if (!title || !text) {
        throw new HttpException(
          'title და body სავალდებულოა',
          HttpStatus.BAD_REQUEST,
        );
      }

      const result = await this.finesService.sendCustomPushToUnpaidUsers(
        title,
        text,
      );
      return { success: true, ...result };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        'Custom fines push გაგზავნა ვერ მოხერხდა',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
