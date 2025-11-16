import { IsString, IsOptional } from 'class-validator';

export class FirebaseVerifyDto {
  @IsString()
  firebaseUid: string;

  @IsString()
  phoneNumber: string;

  @IsOptional()
  @IsString()
  displayName?: string;
}
