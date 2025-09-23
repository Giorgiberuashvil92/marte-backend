import { IsString, IsNotEmpty, IsIn } from 'class-validator';

export class UpdateOwnedCarwashesDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  carwashId: string;

  @IsIn(['add', 'remove'])
  action: 'add' | 'remove';
}
