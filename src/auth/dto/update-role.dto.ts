import { IsString, IsNotEmpty, IsIn } from 'class-validator';

export class UpdateRoleDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsIn(['customer', 'owner', 'manager', 'employee', 'user'])
  role: 'customer' | 'owner' | 'manager' | 'employee' | 'user';
}
