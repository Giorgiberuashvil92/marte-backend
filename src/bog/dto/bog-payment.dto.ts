import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsBoolean,
  ValidateNested,
  IsIn,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

// Buyer ინფორმაცია
export class BuyerDto {
  @IsOptional()
  @IsString()
  full_name?: string;

  @IsOptional()
  @IsString()
  masked_email?: string;

  @IsOptional()
  @IsString()
  masked_phone?: string;
}

// Basket item
export class BasketItemDto {
  @IsString()
  product_id: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsNumber()
  unit_price: number;

  @IsOptional()
  @IsNumber()
  unit_discount_price?: number;

  @IsOptional()
  @IsNumber()
  vat?: number;

  @IsOptional()
  @IsNumber()
  vat_percent?: number;

  @IsOptional()
  @IsNumber()
  total_price?: number;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsString()
  package_code?: string;

  @IsOptional()
  @IsString()
  tin?: string;

  @IsOptional()
  @IsString()
  pinfl?: string;

  @IsOptional()
  @IsString()
  product_discount_id?: string;
}

// Delivery ინფორმაცია
export class DeliveryDto {
  @IsOptional()
  @IsNumber()
  amount?: number;
}

// Purchase Units
export class PurchaseUnitsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BasketItemDto)
  basket: BasketItemDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => DeliveryDto)
  delivery?: DeliveryDto;

  @IsNumber()
  total_amount: number;

  @IsOptional()
  @IsNumber()
  total_discount_amount?: number;

  @IsOptional()
  @IsString()
  @IsIn(['GEL', 'USD', 'EUR', 'GBP'])
  currency?: string; // Default: GEL
}

// Redirect URLs
export class RedirectUrlsDto {
  @IsOptional()
  @IsString()
  success?: string;

  @IsOptional()
  @IsString()
  fail?: string;
}

// Loan Config
export class LoanConfigDto {
  @IsOptional()
  @IsString()
  type?: string; // discount_code

  @IsOptional()
  @IsNumber()
  month?: number;
}

// Campaign Config
export class CampaignConfigDto {
  @IsOptional()
  @IsString()
  @IsIn(['visa', 'mc', 'solo'])
  card?: string;

  @IsOptional()
  @IsString()
  @IsIn(['restrict', 'client_discount'])
  type?: string;
}

// Google Pay Config
export class GooglePayConfigDto {
  @IsOptional()
  @IsString()
  google_pay_token?: string;

  @IsOptional()
  @IsBoolean()
  external?: boolean; // Default: false
}

// Apple Pay Config
export class ApplePayConfigDto {
  @IsOptional()
  @IsBoolean()
  external?: boolean; // Default: false
}

// Account Config
export class AccountConfigDto {
  @IsOptional()
  @IsString()
  tag?: string;
}

// Config Object
export class ConfigDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => LoanConfigDto)
  loan?: LoanConfigDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CampaignConfigDto)
  campaign?: CampaignConfigDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => GooglePayConfigDto)
  google_pay?: GooglePayConfigDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ApplePayConfigDto)
  apple_pay?: ApplePayConfigDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AccountConfigDto)
  account?: AccountConfigDto;
}

// BOG Order Request - დოკუმენტაციის შესაბამისად
export class BOGOrderRequestDto {
  // Headers პარამეტრები (გადაეცემა headers-ში, არა body-ში)
  @IsOptional()
  @IsString()
  @IsIn(['ka', 'en'])
  accept_language?: 'ka' | 'en'; // Default: ka

  @IsOptional()
  @IsString()
  idempotency_key?: string; // UUID v4

  @IsOptional()
  @IsString()
  @IsIn(['light', 'dark'])
  theme?: 'light' | 'dark'; // Default: light

  // Body პარამეტრები
  @IsOptional()
  @IsString()
  @IsIn(['web', 'mobile'])
  application_type?: 'web' | 'mobile';

  @IsOptional()
  @ValidateNested()
  @Type(() => BuyerDto)
  buyer?: BuyerDto;

  @IsString()
  callback_url: string;

  @IsOptional()
  @IsString()
  external_order_id?: string;

  @IsOptional()
  @IsString()
  @IsIn(['automatic', 'manual'])
  capture?: 'automatic' | 'manual';

  @ValidateNested()
  @Type(() => PurchaseUnitsDto)
  purchase_units: PurchaseUnitsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => RedirectUrlsDto)
  redirect_urls?: RedirectUrlsDto;

  @IsOptional()
  @IsNumber()
  @Min(2)
  @Max(1440)
  ttl?: number; // Default: 15 minutes

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsIn(
    [
      'card',
      'google_pay',
      'apple_pay',
      'bog_p2p',
      'bog_loyalty',
      'bnpl',
      'bog_loan',
      'gift_card',
    ],
    { each: true },
  )
  payment_method?: Array<
    | 'card'
    | 'google_pay'
    | 'apple_pay'
    | 'bog_p2p'
    | 'bog_loyalty'
    | 'bnpl'
    | 'bog_loan'
    | 'gift_card'
  >;

  @IsOptional()
  @ValidateNested()
  @Type(() => ConfigDto)
  config?: ConfigDto;

  // Legacy fields - backward compatibility
  @IsOptional()
  @IsNumber()
  total_amount?: number; // Legacy: გამოიყენება purchase_units.total_amount-ისთვის

  @IsOptional()
  @IsString()
  currency?: string; // Legacy: გამოიყენება purchase_units.currency-ისთვის

  @IsOptional()
  @IsString()
  product_id?: string; // Legacy: გამოიყენება basket[0].product_id-ისთვის

  @IsOptional()
  @IsString()
  description?: string; // Legacy: გამოიყენება basket[0].description-ისთვის

  @IsOptional()
  @IsString()
  success_url?: string; // Legacy: გამოიყენება redirect_urls.success-ისთვის

  @IsOptional()
  @IsString()
  fail_url?: string; // Legacy: გამოიყენება redirect_urls.fail-ისთვის

  @IsOptional()
  @IsBoolean()
  save_card?: boolean; // ბარათის დამახსოვრება recurring payment-ებისთვის (არ არის BOG API-ში, მაგრამ გამოიყენება saveCardForRecurringPayments-ისთვის)
}

// BOG Order Response
export class BOGOrderResponseDto {
  @IsString()
  id: string;

  @IsString()
  redirect_url: string;
}

// BOG Payment Status
export class BOGPaymentStatusDto {
  @IsString()
  order_id: string;

  @IsString()
  status: string; // 'pending' | 'completed' | 'failed'

  @IsOptional()
  @IsString()
  message?: string;
}

// BOG Recurring Payment Request
// BOG API დოკუმენტაციის მიხედვით, body-ში optional-ია callback_url და external_order_id
// სხვა პარამეტრები (თანხა, ვალუტა, მყიდველის ინფორმაცია) ავტომატურად იღება parent_order_id-დან
export class BOGRecurringPaymentDto {
  @IsString()
  parent_order_id: string; // წარმატებული გადახდის order_id, რომელზეც მოხდა ბარათის დამახსოვრება

  @IsOptional()
  @IsString()
  callback_url?: string; // optional - თუ არ გადმოცემულია, გამოიყენება parent_order_id-ის შესაბამისი მნიშვნელობა

  @IsOptional()
  @IsString()
  external_order_id?: string; // optional - თუ არ გადმოცემულია, გამოიყენება parent_order_id-ის შესაბამისი მნიშვნელობა

  // Legacy fields - kept for backward compatibility but not used in API request
  @IsOptional()
  @IsString()
  order_id?: string; // Legacy: იგივე რაც parent_order_id

  @IsOptional()
  @IsNumber()
  amount?: number; // Legacy: არ გამოიყენება, ავტომატურად იღება parent_order_id-დან

  @IsOptional()
  @IsString()
  currency?: string; // Legacy: არ გამოიყენება, ავტომატურად იღება parent_order_id-დან

  @IsOptional()
  @IsString()
  shop_order_id?: string; // Legacy: იგივე რაც external_order_id

  @IsOptional()
  @IsString()
  purchase_description?: string; // Legacy: არ გამოიყენება, ავტომატურად იღება parent_order_id-დან
}

// BOG Recurring Payment Response
// BOG API დოკუმენტაციის მიხედვით, response არის: { id: string, _links: { details: { href: string } } }
export class BOGRecurringPaymentResponseDto {
  @IsString()
  id: string; // ახალი order_id რეკურინგ გადახდისთვის

  @IsOptional()
  _links?: {
    details?: {
      href?: string;
    };
  };

  // Legacy fields - kept for backward compatibility
  @IsOptional()
  @IsString()
  order_id?: string; // Legacy: იგივე რაც id

  @IsOptional()
  @IsString()
  status?: string; // Legacy: არ აბრუნებს BOG API

  @IsOptional()
  @IsString()
  message?: string; // Legacy: არ აბრუნებს BOG API
}
