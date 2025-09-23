import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

export class CompleteAuthDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsIn(['user', 'partner'])
  role?: 'user' | 'partner';
}
