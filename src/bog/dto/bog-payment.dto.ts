import { IsString, IsNumber, IsOptional } from 'class-validator';

// მარტივი BOG Order Request - CarApp-ისთვის
export class BOGOrderRequestDto {
  @IsString()
  callback_url: string;

  @IsOptional()
  @IsString()
  external_order_id?: string;

  @IsNumber()
  total_amount: number;

  @IsOptional()
  @IsString()
  currency?: string; // GEL

  @IsOptional()
  @IsString()
  product_id?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  success_url?: string;

  @IsOptional()
  @IsString()
  fail_url?: string;

  @IsOptional()
  save_card?: boolean; // ბარათის დამახსოვრება recurring payment-ებისთვის
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
