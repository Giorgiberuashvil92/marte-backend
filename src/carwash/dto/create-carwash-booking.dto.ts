import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsArray,
} from 'class-validator';

export class CreateCarwashBookingDto {
  @IsString()
  @IsOptional()
  userId?: string;

  @IsString()
  @IsNotEmpty()
  locationId: string;

  @IsString()
  @IsOptional()
  locationName?: string;

  @IsString()
  @IsOptional()
  locationAddress?: string;

  @IsString()
  @IsOptional()
  serviceId?: string;

  @IsString()
  @IsOptional()
  serviceName?: string;

  @IsOptional()
  @IsNumber()
  servicePrice?: number;

  @IsOptional()
  @IsNumber()
  bookingDate?: number; // timestamp

  @IsString()
  @IsOptional()
  bookingTime?: string; // "15:30"

  @IsOptional()
  carInfo?: {
    make: string;
    model: string;
    year: string;
    licensePlate: string;
    color?: string;
  };

  @IsOptional()
  customerInfo?: {
    name: string;
    phone: string;
    email?: string;
  };

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsNumber()
  estimatedDuration?: number; // in minutes

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specialRequests?: string[];
}
