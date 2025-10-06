export class CreatePartDto {
  title: string;
  description: string;
  category: string;
  condition: string;
  price: string;
  images: string[];
  seller: string;
  location: string;
  phone: string;
  name: string;
  brand?: string;
  model?: string;
  year?: number;
  isNegotiable?: boolean;
  partNumber?: string;
  warranty?: string;
  status?: string;
}
