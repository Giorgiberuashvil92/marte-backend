import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsArray,
} from 'class-validator';
import {
  CarwashService,
  TimeSlotsConfig,
  RealTimeStatus,
  SocialMedia,
} from '../../schemas/carwash-location.schema';

export class CreateCarwashLocationDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsNumber()
  rating?: number;

  @IsOptional()
  @IsNumber()
  reviews?: number;

  @IsOptional()
  @IsString()
  services?: string;

  @IsOptional()
  detailedServices?: CarwashService[];

  @IsOptional()
  @IsString()
  features?: string;

  @IsOptional()
  @IsString()
  workingHours?: string;

  @IsOptional()
  timeSlotsConfig?: TimeSlotsConfig;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsBoolean()
  isOpen?: boolean;

  @IsOptional()
  realTimeStatus?: RealTimeStatus;

  @IsOptional()
  @IsString()
  ownerId?: string;

  @IsOptional()
  socialMedia?: SocialMedia;

  @IsOptional()
  @IsNumber()
  createdAt?: number;

  @IsOptional()
  @IsNumber()
  updatedAt?: number;

  @IsOptional()
  @IsNumber()
  distance?: number;
}
