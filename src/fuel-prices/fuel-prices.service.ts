import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';

const PETROL_API_BASE = 'https://api.petrol.com.ge';

export interface FuelType {
  name: string;
  type_alt: string;
}

export interface FuelPrice {
  name: string;
  type_alt: string;
  price: number;
  change_rate: number;
  date: string;
  last_updated: string;
}

export interface ProviderPrices {
  provider: string;
  last_updated: string;
  fuel: FuelPrice[];
}

export interface LowestPrice {
  fuel_type: string;
  price: number;
  providers: string[];
}

export interface PriceHistory {
  provider: string;
  data_labels: string[];
  fuel: Array<{
    name: string;
    data: string[];
  }>;
}

@Injectable()
export class FuelPricesService {
  /**
   * მიმდინარე ფასების მიღება ყველა პროვაიდერისთვის
   */
  async getCurrentPrices(): Promise<ProviderPrices[]> {
    try {
      const response = await axios.get<ProviderPrices[]>(
        `${PETROL_API_BASE}/current/`,
      );
      return response.data;
    } catch (error) {
      throw new HttpException(
        'ფასების მიღება ვერ მოხერხდა',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * ყველაზე იაფი ფასების მიღება
   */
  async getLowestPrices(): Promise<LowestPrice[]> {
    try {
      const response = await axios.get<LowestPrice[]>(
        `${PETROL_API_BASE}/lowest/`,
      );
      return response.data;
    } catch (error) {
      throw new HttpException(
        'ყველაზე იაფი ფასების მიღება ვერ მოხერხდა',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * საწვავის ტიპების მიღება
   */
  async getFuelTypes(): Promise<FuelType[]> {
    try {
      const response = await axios.get<FuelType[]>(
        `${PETROL_API_BASE}/utils/fuel-types`,
      );
      return response.data;
    } catch (error) {
      throw new HttpException(
        'საწვავის ტიპების მიღება ვერ მოხერხდა',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * კონკრეტული პროვაიდერის ისტორიული ფასები
   */
  async getPriceHistory(provider: string): Promise<PriceHistory> {
    try {
      const response = await axios.get<PriceHistory>(
        `${PETROL_API_BASE}/price-history/${provider}`,
      );
      return response.data;
    } catch (error) {
      throw new HttpException(
        `პროვაიდერის ${provider} ისტორიული ფასების მიღება ვერ მოხერხდა`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * კონკრეტული საწვავის ტიპისთვის ყველაზე იაფი ფასი
   */
  async getBestPriceForFuelType(fuelType: string): Promise<LowestPrice | null> {
    try {
      const lowestPrices = await this.getLowestPrices();
      return lowestPrices.find((p) => p.fuel_type === fuelType) || null;
    } catch (error) {
      throw new HttpException(
        'საუკეთესო ფასის მიღება ვერ მოხერხდა',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * კონკრეტული პროვაიდერის მიმდინარე ფასები
   */
  async getProviderPrices(provider: string): Promise<ProviderPrices | null> {
    try {
      const allPrices = await this.getCurrentPrices();
      return (
        allPrices.find(
          (p) => p.provider.toLowerCase() === provider.toLowerCase(),
        ) || null
      );
    } catch (error) {
      throw new HttpException(
        `პროვაიდერის ${provider} ფასების მიღება ვერ მოხერხდა`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * ფასების შედარება კონკრეტული საწვავის ტიპისთვის
   */
  async comparePricesByFuelType(fuelTypeAlt: string): Promise<{
    fuelType: string;
    prices: Array<{
      provider: string;
      name: string;
      price: number;
    }>;
    cheapest: {
      provider: string;
      name: string;
      price: number;
    };
  }> {
    try {
      const currentPrices = await this.getCurrentPrices();
      const fuelTypes = await this.getFuelTypes();
      const fuelType = fuelTypes.find((ft) => ft.type_alt === fuelTypeAlt);

      const prices = currentPrices
        .flatMap((provider) =>
          provider.fuel
            .filter((f) => f.type_alt === fuelTypeAlt)
            .map((f) => ({
              provider: provider.provider,
              name: f.name,
              price: f.price,
            })),
        )
        .sort((a, b) => a.price - b.price);

      return {
        fuelType: fuelType?.name || fuelTypeAlt,
        prices,
        cheapest: prices[0] || null,
      };
    } catch (error) {
      throw new HttpException(
        'ფასების შედარება ვერ მოხერხდა',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * ყველა პროვაიდერის სია
   */
  async getProviders(): Promise<string[]> {
    try {
      const currentPrices = await this.getCurrentPrices();
      return currentPrices.map((p) => p.provider);
    } catch (error) {
      throw new HttpException(
        'პროვაიდერების სიის მიღება ვერ მოხერხდა',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
