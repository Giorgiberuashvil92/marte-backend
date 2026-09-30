import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';

const GASBRO_PRICES_URL = 'https://gasbro.ge/data/prices.json';
const CACHE_TTL_MS = 5 * 60 * 1000;

type GasBroFuelType = 'super' | 'premium' | 'regular' | 'diesel' | 'lpg' | 'cng' | string;

interface GasBroPriceRecord {
  brand: string;
  product: string;
  fuel_type: GasBroFuelType;
  price_type: 'standard' | 'self_service' | string;
  price_gel: string;
  effective_at?: string;
  observed_at?: string;
}

interface GasBroSource {
  slug: string;
  name: string;
  source_url: string;
  last_success_at?: string;
  last_attempt_at?: string;
  status?: string;
}

interface GasBroResponse {
  generated_at: string;
  data: GasBroPriceRecord[];
  sources?: GasBroSource[];
}

interface CachedPrices {
  fetchedAt: number;
  payload: GasBroResponse;
}

let pricesCache: CachedPrices | null = null;

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
  price_type?: string;
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
  private async getGasBroPayload(): Promise<GasBroResponse> {
    if (pricesCache && Date.now() - pricesCache.fetchedAt < CACHE_TTL_MS) {
      return pricesCache.payload;
    }

    try {
      const response = await axios.get<GasBroResponse>(GASBRO_PRICES_URL, {
        timeout: 15_000,
        headers: { Accept: 'application/json' },
      });

      if (!response.data?.generated_at || !Array.isArray(response.data.data)) {
        throw new Error('GasBro-ს პასუხის ფორმატი არასწორია');
      }

      pricesCache = { fetchedAt: Date.now(), payload: response.data };
      return response.data;
    } catch (error) {
      if (pricesCache) {
        return pricesCache.payload;
      }
      throw error;
    }
  }

  private normalizeProviderName(brand: string): string {
    const names: Record<string, string> = {
      gulf: 'Gulf',
      wissol: 'Wissol',
      socar: 'SOCAR',
      rompetrol: 'Rompetrol',
      connect: 'Connect',
      lukoil: 'Lukoil',
      portal: 'Portal',
    };
    return names[brand.toLowerCase()] || brand;
  }

  private normalizeFuelName(record: GasBroPriceRecord): string {
    const suffix = record.price_type === 'self_service' ? ' • თვითმომსახურება' : '';
    return `${record.product}${suffix}`.replace(/\s+/g, ' ').trim();
  }

  private normalizeCurrentPrices(payload: GasBroResponse): ProviderPrices[] {
    const grouped = new Map<string, ProviderPrices>();

    for (const record of payload.data || []) {
      const price = Number(record.price_gel);
      if (!record.brand || !record.product || !Number.isFinite(price)) continue;

      const provider = this.normalizeProviderName(record.brand);
      const observedAt = record.observed_at || payload.generated_at;
      const effectiveAt = record.effective_at || observedAt;
      const existing = grouped.get(provider) || {
        provider,
        last_updated: observedAt,
        fuel: [],
      };

      existing.last_updated = [existing.last_updated, observedAt].sort().at(-1) || observedAt;
      existing.fuel.push({
        name: this.normalizeFuelName(record),
        type_alt: record.fuel_type,
        price,
        change_rate: 0,
        date: effectiveAt,
        last_updated: observedAt,
        price_type: record.price_type,
      });
      grouped.set(provider, existing);
    }

    return Array.from(grouped.values()).map((provider) => ({
      ...provider,
      fuel: provider.fuel.sort((a, b) => a.type_alt.localeCompare(b.type_alt)),
    }));
  }

  /**
   * მიმდინარე ფასების მიღება ყველა პროვაიდერისთვის
   */
  async getCurrentPrices(): Promise<ProviderPrices[]> {
    try {
      return this.normalizeCurrentPrices(await this.getGasBroPayload());
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
      const prices = await this.getCurrentPrices();
      const lowest = new Map<string, LowestPrice>();

      for (const provider of prices) {
        for (const fuel of provider.fuel) {
          const current = lowest.get(fuel.type_alt);
          if (!current || fuel.price < current.price) {
            lowest.set(fuel.type_alt, {
              fuel_type: fuel.type_alt,
              price: fuel.price,
              providers: [provider.provider],
            });
          } else if (fuel.price === current.price && !current.providers.includes(provider.provider)) {
            current.providers.push(provider.provider);
          }
        }
      }

      return Array.from(lowest.values());
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
      const names: Record<string, string> = {
        super: 'სუპერი',
        premium: 'პრემიუმი',
        regular: 'რეგულარი',
        diesel: 'დიზელი',
        lpg: 'თხევადი აირი',
        cng: 'ბუნებრივი აირი',
      };
      const payload = await this.getGasBroPayload();
      return Array.from(new Set(payload.data.map((item) => item.fuel_type))).map((type) => ({
        name: names[type] || type,
        type_alt: type,
      }));
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
      const prices = await this.getProviderPrices(provider);
      const label = prices?.last_updated || new Date().toISOString();
      return {
        provider: prices?.provider || provider,
        data_labels: [label],
        fuel: (prices?.fuel || []).map((fuel) => ({
          name: fuel.name,
          data: [fuel.price.toFixed(3)],
        })),
      };
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
