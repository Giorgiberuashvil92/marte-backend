import {
  IsString,
  IsNumber,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CarInfoDto {
  @IsString()
  make: string;

  @IsString()
  model: string;

  @IsNumber()
  year: number;

  @IsString()
  plate: string;
}

export class AssistantLevelDto {
  @IsString()
  id: string;

  @IsString()
  title: string;

  @IsNumber()
  price: number;
}

export class ContactInfoDto {
  @IsString()
  location: string;

  @IsString()
  phone: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateMarteOrderDto {
  @IsString()
  carId: string;

  @ValidateNested()
  @Type(() => CarInfoDto)
  carInfo: CarInfoDto;

  @ValidateNested()
  @Type(() => AssistantLevelDto)
  assistantLevel: AssistantLevelDto;

  @IsString()
  problemDescription: string;

  @ValidateNested()
  @Type(() => ContactInfoDto)
  contactInfo: ContactInfoDto;
}
