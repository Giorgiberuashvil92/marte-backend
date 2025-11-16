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
