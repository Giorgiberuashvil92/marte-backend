import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Mechanic as MechanicModel,
  MechanicDocument,
} from '../schemas/mechanic.schema';

export interface Mechanic {
  id: string;
  name: string;
  specialty: string;
  rating?: number;
  reviews?: number;
  experience?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  distanceKm?: number;
  priceGEL?: number;
  avatar?: string;
  isAvailable?: boolean;
  services?: string[];
  description?: string;
  phone?: string;
  address?: string;
}

@Injectable()
export class MechanicsService {
  constructor(
    @InjectModel(MechanicModel.name)
    private readonly mechanicModel: Model<MechanicDocument>,
  ) {}

  async findAll(params?: {
    q?: string;
    specialty?: string;
    location?: string;
  }): Promise<Mechanic[]> {
    const filter: Record<string, unknown> = {};
    if (params?.q) {
      const q = params.q.trim();
      (filter as any).$or = [
        { name: { $regex: q, $options: 'i' } },
        { specialty: { $regex: q, $options: 'i' } },
        { location: { $regex: q, $options: 'i' } },
      ];
    }
    if (params?.specialty && params.specialty !== 'all') {
      (filter as any).specialty = { $regex: params.specialty, $options: 'i' };
    }
    if (params?.location) {
      (filter as any).location = { $regex: params.location, $options: 'i' };
    }
    const docs = await this.mechanicModel
      .find(filter)
      .sort({ createdAt: -1 })
      .lean();
    return docs.map((d) => ({
      id: String((d as any)._id),
      name: (d as any).name,
      specialty: (d as any).specialty,
      rating: (d as any).rating ?? 0,
      reviews: (d as any).reviews ?? 0,
      experience: (d as any).experience ?? '-',
      location: (d as any).location ?? '-',
      distanceKm: undefined,
      priceGEL: undefined,
      avatar: (d as any).avatar,
      isAvailable: (d as any).isAvailable ?? true,
      services: (d as any).services ?? [],
      description: (d as any).description ?? '',
      phone: (d as any).phone,
      address: (d as any).address,
      latitude: (d as any).latitude,
      longitude: (d as any).longitude,
    }));
  }

  async create(
    dto: Partial<Mechanic> & { firstName?: string; lastName?: string },
  ): Promise<Mechanic> {
    const name =
      (dto.name || `${dto.firstName ?? ''} ${dto.lastName ?? ''}`).trim() ||
      'Mechanic';
    const doc = await this.mechanicModel.create({
      name,
      specialty: dto.specialty || 'მექანიკოსი',
      experience: dto.experience,
      location: dto.location,
      latitude: (dto as { latitude?: number }).latitude,
      longitude: (dto as { longitude?: number }).longitude,
      avatar: dto.avatar,
      isAvailable: dto.isAvailable ?? true,
      services: dto.services ?? [],
      description: dto.description,
      phone: dto.phone,
      address: dto.address,
    });
    return {
      id: String(doc._id),
      name: doc.name,
      specialty: doc.specialty,
      rating: doc.rating ?? 0,
      reviews: doc.reviews ?? 0,
      experience: doc.experience ?? '-',
      location: doc.location ?? '-',
      distanceKm: undefined,
      priceGEL: undefined,
      avatar: doc.avatar,
      isAvailable: doc.isAvailable ?? true,
      services: doc.services ?? [],
      description: doc.description ?? '',
      phone: doc.phone,
      address: doc.address,
      latitude: doc.latitude,
      longitude: doc.longitude,
    };
  }
}
