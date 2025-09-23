import { IsOptional, IsString, IsNumber, IsIn, IsArray } from 'class-validator';

export class UpdateCarwashBookingDto {
  @IsOptional()
  @IsIn(['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'])
  status?: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';

  @IsOptional()
  @IsNumber()
  bookingDate?: number;

  @IsOptional()
  @IsString()
  bookingTime?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specialRequests?: string[];

  @IsOptional()
  @IsNumber()
  estimatedDuration?: number;

  @IsOptional()
  @IsNumber()
  actualDuration?: number;

  @IsOptional()
  @IsNumber()
  rating?: number;

  @IsOptional()
  @IsString()
  review?: string;
}
