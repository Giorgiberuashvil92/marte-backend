import {
  Controller,
  Get,
  Param,
  Query,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { FuelPricesService } from './fuel-prices.service';

@Controller('fuel-prices')
export class FuelPricesController {
  constructor(private readonly fuelPricesService: FuelPricesService) {}

  /**
   * GET /fuel-prices/current
   * მიმდინარე ფასები ყველა პროვაიდერისთვის
   */
  @Get('current')
  async getCurrentPrices() {
    try {
      return await this.fuelPricesService.getCurrentPrices();
    } catch (error) {
      throw new HttpException(
        error.message || 'ფასების მიღება ვერ მოხერხდა',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /fuel-prices/lowest
   * ყველაზე იაფი ფასები
   */
  @Get('lowest')
  async getLowestPrices() {
    try {
      return await this.fuelPricesService.getLowestPrices();
    } catch (error) {
      throw new HttpException(
        error.message || 'ყველაზე იაფი ფასების მიღება ვერ მოხერხდა',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /fuel-prices/fuel-types
   * საწვავის ტიპების სია
   */
  @Get('fuel-types')
  async getFuelTypes() {
    try {
      return await this.fuelPricesService.getFuelTypes();
    } catch (error) {
      throw new HttpException(
        error.message || 'საწვავის ტიპების მიღება ვერ მოხერხდა',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /fuel-prices/history/:provider
   * კონკრეტული პროვაიდერის ისტორიული ფასები
   */
  @Get('history/:provider')
  async getPriceHistory(@Param('provider') provider: string) {
    try {
      return await this.fuelPricesService.getPriceHistory(provider);
    } catch (error) {
      throw new HttpException(
        error.message || 'ისტორიული ფასების მიღება ვერ მოხერხდა',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /fuel-prices/provider/:provider
   * კონკრეტული პროვაიდერის მიმდინარე ფასები
   */
  @Get('provider/:provider')
  async getProviderPrices(@Param('provider') provider: string) {
    try {
      const prices = await this.fuelPricesService.getProviderPrices(provider);
      if (!prices) {
        throw new HttpException(
          `პროვაიდერი ${provider} ვერ მოიძებნა`,
          HttpStatus.NOT_FOUND,
        );
      }
      return prices;
    } catch (error) {
      throw new HttpException(
        error.message || 'პროვაიდერის ფასების მიღება ვერ მოხერხდა',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /fuel-prices/compare?fuelType=diesel
   * ფასების შედარება კონკრეტული საწვავის ტიპისთვის
   */
  @Get('compare')
  async comparePrices(@Query('fuelType') fuelType: string) {
    try {
      if (!fuelType) {
        throw new HttpException(
          'fuelType პარამეტრი აუცილებელია',
          HttpStatus.BAD_REQUEST,
        );
      }
      return await this.fuelPricesService.comparePricesByFuelType(fuelType);
    } catch (error) {
      throw new HttpException(
        error.message || 'ფასების შედარება ვერ მოხერხდა',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /fuel-prices/best/:fuelType
   * კონკრეტული საწვავის ტიპისთვის საუკეთესო ფასი
   */
  @Get('best/:fuelType')
  async getBestPrice(@Param('fuelType') fuelType: string) {
    try {
      return await this.fuelPricesService.getBestPriceForFuelType(fuelType);
    } catch (error) {
      throw new HttpException(
        error.message || 'საუკეთესო ფასის მიღება ვერ მოხერხდა',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /fuel-prices/providers
   * ყველა პროვაიდერის სია
   */
  @Get('providers')
  async getProviders() {
    try {
      return await this.fuelPricesService.getProviders();
    } catch (error) {
      throw new HttpException(
        error.message || 'პროვაიდერების სიის მიღება ვერ მოხერხდა',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

