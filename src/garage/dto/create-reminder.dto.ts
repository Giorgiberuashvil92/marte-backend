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

  @IsOptional()
  @IsString()
  reminderTime2?: string; // მეორე დრო "ყოველდღე"-სთვის (დღეში 2 ჯერ)

  @IsOptional()
  @IsString()
  startDate?: string; // დაწყების თარიღი recurring-ისთვის (YYYY-MM-DD)

  @IsOptional()
  @IsString()
  endDate?: string; // დასრულების თარიღი recurring-ისთვის (YYYY-MM-DD)

  @IsOptional()
  @IsString()
  @IsIn(['daily', 'weekly', 'monthly', 'yearly'])
  recurringInterval?: string; // 'daily' | 'weekly' | 'monthly' | 'yearly'
}
