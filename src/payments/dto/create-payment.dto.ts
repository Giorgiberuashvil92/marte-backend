import {
  IsString,
  IsNumber,
  IsOptional,
  IsObject,
  IsDateString,
  IsBoolean,
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

  @IsOptional()
  @IsString()
  paymentToken?: string;

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @IsOptional()
  @IsString()
  recurringPaymentId?: string;

  // BOG payment detail-ის დამატებითი ველები
  @IsOptional()
  @IsString()
  externalOrderId?: string;

  @IsOptional()
  @IsString()
  transactionId?: string;

  @IsOptional()
  @IsString()
  payerIdentifier?: string;

  @IsOptional()
  @IsNumber()
  transferAmount?: number;

  @IsOptional()
  @IsString()
  paymentOption?: string;

  @IsOptional()
  @IsString()
  cardType?: string;

  @IsOptional()
  @IsString()
  cardExpiryDate?: string;

  @IsOptional()
  @IsNumber()
  refundAmount?: number;

  @IsOptional()
  @IsString()
  pgTrxId?: string;

  @IsOptional()
  @IsString()
  authCode?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  codeDescription?: string;

  @IsOptional()
  @IsString()
  savedCardType?: string;

  @IsOptional()
  @IsString()
  parentOrderId?: string;
}
