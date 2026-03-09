import {
  IsString,
  IsNumber,
  IsNotEmpty,
  IsDateString,
  IsOptional,
  IsArray,
  Min,
  IsIn,
} from 'class-validator';

export class CreateServiceHistoryDto {
  @IsString()
  @IsNotEmpty()
  carId: string;

  @IsString()
  @IsNotEmpty()
  @IsIn([
    'maintenance',
    'service',
    'oil',
    'tires',
    'battery',
    'inspection',
    'carwash',
    'insurance',
    'fuel',
    'parts',
  ])
  serviceType: string;

  @IsDateString()
  @IsNotEmpty()
  date: string;

  @IsNumber()
  @Min(0)
  mileage: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cost?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @IsDateString()
  warrantyUntil?: string;
}
