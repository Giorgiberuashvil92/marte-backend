import {
  IsString,
  IsNumber,
  IsOptional,
  IsObject,
  IsDateString,
} from 'class-validator';

export class CreatePaymentDto {
  @IsString()
  userId: string;

  @IsString()
  orderId: string;

  @IsNumber()
  amount: number;

  @IsString()
  currency: string;

  @IsString()
  paymentMethod: string;

  @IsString()
  status: string;

  @IsString()
  context: string;

  @IsString()
  description: string;

  @IsDateString()
  paymentDate: string;

  @IsOptional()
  @IsObject()
  metadata?: {
    serviceId?: string;
    serviceName?: string;
    locationId?: string;
    locationName?: string;
    selectedDate?: string;
    selectedTime?: string;
    bookingType?: string;
    customerInfo?: {
      name?: string;
      phone?: string;
      email?: string;
    };
  };
}
