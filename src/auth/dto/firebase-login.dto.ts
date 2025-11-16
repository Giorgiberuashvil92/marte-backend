import { IsString } from 'class-validator';

export class FirebaseLoginDto {
  @IsString()
  idToken!: string;
}
