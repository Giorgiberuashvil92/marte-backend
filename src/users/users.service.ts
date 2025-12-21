import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../schemas/user.schema';

type ListParams = {
  q?: string;
  limit: number;
  offset: number;
  role?: string;
  active?: boolean;
};

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  async list(params: ListParams) {
    const filter: any = {};
    if (params.q && params.q.trim()) {
      const q = params.q.trim();
      filter.$or = [
        { phone: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
        { firstName: { $regex: q, $options: 'i' } },
        { lastName: { $regex: q, $options: 'i' } },
        { id: { $regex: q, $options: 'i' } },
      ];
    }
    if (params.role) filter.role = params.role;
    if (typeof params.active === 'boolean') filter.isActive = params.active;

    const [items, total] = await Promise.all([
      this.userModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(params.offset)
        .limit(params.limit)
        .lean(),
      this.userModel.countDocuments(filter),
    ]);

    const data = items.map((u: any) => ({
      id: u.id,
      phone: u.phone,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      role: u.role,
      isActive: u.isActive,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    }));

    return { data, total, limit: params.limit, offset: params.offset };
  }

  async getById(id: string) {
    const u: any = await this.userModel.findOne({ id }).lean();
    if (!u) throw new BadRequestException('user_not_found');
    return u;
  }

  async updateRole(id: string, role: string) {
    const allowed = ['customer', 'owner', 'manager', 'employee', 'user'];
    if (!allowed.includes(role)) throw new BadRequestException('invalid_role');
    const updated = await this.userModel
      .findOneAndUpdate({ id }, { role, updatedAt: Date.now() }, { new: true })
      .lean();
    if (!updated) throw new BadRequestException('user_not_found');
    return updated;
  }

  async updateActive(id: string, isActive: boolean) {
    const updated = await this.userModel
      .findOneAndUpdate(
        { id },
        { isActive, updatedAt: Date.now() },
        { new: true },
      )
      .lean();
    if (!updated) throw new BadRequestException('user_not_found');
    return updated;
  }

  async update(
    id: string,
    updates: Partial<{
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
      role?: string;
      isActive?: boolean;
      profileImage?: string;
      preferences?: any;
      address?: string;
      city?: string;
      country?: string;
      zipCode?: string;
      dateOfBirth?: string;
      gender?: string;
    }>,
  ) {
    const allowedFields = [
      'firstName',
      'lastName',
      'email',
      'phone',
      'role',
      'isActive',
      'profileImage',
      'preferences',
      'address',
      'city',
      'country',
      'zipCode',
      'dateOfBirth',
      'gender',
    ];

    const updateData: Record<string, any> = { updatedAt: Date.now() };

    // Only update allowed fields
    for (const field of allowedFields) {
      if (field in updates && updates[field as keyof typeof updates] !== undefined) {
        updateData[field] = updates[field as keyof typeof updates];
      }
    }

    // Validate role if provided
    if (updateData.role) {
      const allowed = ['customer', 'owner', 'manager', 'employee', 'user'];
      if (!allowed.includes(updateData.role)) {
        throw new BadRequestException('invalid_role');
      }
    }

    const updated = await this.userModel
      .findOneAndUpdate({ id }, updateData, { new: true })
      .lean();

    if (!updated) throw new BadRequestException('user_not_found');
    return updated;
  }
}
