import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsDateString,
  IsIn,
} from 'class-validator';

export class CreateReminderDto {
  @IsString()
  @IsNotEmpty()
  carId: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @IsNotEmpty()
  type: string;

  @IsString()
  @IsIn(['low', 'medium', 'high', 'დაბალი', 'საშუალო', 'მაღალი'])
  priority: string;

  @IsDateString()
  reminderDate: string;

  @IsOptional()
  @IsString()
  reminderTime?: string;
}
