export class RegisterVehicleDto {
  userId: string; // რომელმა იუზერმა დაარეგისტრირა
  vehicleNumber: string;
  techPassportNumber: string;
  mediaFile?: boolean;
}
