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
  phone: string;

  @IsString()
  @IsNotEmpty()
  category: string;

  @IsString()
  @IsNotEmpty()
  location: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsNumber()
  price: number;

  @IsNumber()
  rating: number;

  @IsNumber()
  reviews: number;

  @IsString()
  @IsNotEmpty()
  services: string; // ძველი ველი - backward compatibility

  @IsOptional()
  detailedServices?: CarwashService[]; // ახალი დეტალური სერვისები

  @IsOptional()
  @IsString()
  features?: string;

  @IsString()
  @IsNotEmpty()
  workingHours: string; // ძველი ველი - backward compatibility

  @IsOptional()
  timeSlotsConfig?: TimeSlotsConfig; // ახალი დროის სლოტების კონფიგურაცია

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsBoolean()
  isOpen: boolean; // ძველი ველი - backward compatibility

  @IsOptional()
  realTimeStatus?: RealTimeStatus; // რეალური დროის სტატუსი

  @IsString()
  @IsNotEmpty()
  ownerId: string;

  @IsOptional()
  socialMedia?: SocialMedia; // სოციალური მედია

  @IsNumber()
  createdAt: number;

  @IsNumber()
  updatedAt: number;

  @IsOptional()
  @IsNumber()
  distance?: number;
}
