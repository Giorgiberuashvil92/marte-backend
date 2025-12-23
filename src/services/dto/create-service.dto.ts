export class CreateServiceDto {
  name: string;
  description: string;
  category: string;
  location: string;
  address: string;
  phone: string;
  price?: string | number;
  rating?: number;
  reviews?: number;
  images?: string[];
  avatar?: string;
  services?: string[];
  features?: string;
  isOpen?: boolean;
  waitTime?: string;
  workingHours?: string;
  latitude?: number;
  longitude?: number;
  ownerId?: string;
  status?: string;
}


