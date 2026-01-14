import { IsString, IsNotEmpty, IsIn } from 'class-validator';

export class UpdateOwnedStoresDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  storeId: string;

  @IsIn(['add', 'remove'])
  action: 'add' | 'remove';
}
