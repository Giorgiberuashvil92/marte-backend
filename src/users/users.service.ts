import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../schemas/user.schema';
import { Request } from '../schemas/request.schema';

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
    @InjectModel(Request.name) private readonly requestModel: Model<Request>,
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

    // მოვძებნოთ requests თითოეული user-ისთვის
    const userIds = items.map((u: any) => String(u.id || '')).filter(Boolean);

    // მოვძებნოთ ყველა requests, რომლებიც ეკუთვნის ამ users-ს
    let allRequests: any[] = [];
    if (userIds.length > 0) {
      // ვიყენებთ $in operator-ს რომ ვიპოვოთ ყველა request, რომლის userId ემთხვევა users-ის id-ებს
      allRequests = await this.requestModel
        .find({ userId: { $in: userIds } })
        .sort({ createdAt: -1 })
        .lean();

      // დებაგ: შევამოწმოთ რამდენი request-ი ვიპოვეთ
      console.log(
        `[UsersService] Found ${allRequests.length} requests for ${userIds.length} users`,
      );
    }

    // შევქმნათ map userId -> requests (გამოვიყენოთ String() რომ დავრწმუნდეთ, რომ შედარება სწორად მუშაობს)
    const requestsMap = new Map<string, any[]>();
    allRequests.forEach((req: any) => {
      const userId = String(req.userId || '').trim();
      if (!userId) return; // თუ userId არ არსებობს, გამოვტოვოთ

      if (!requestsMap.has(userId)) {
        requestsMap.set(userId, []);
      }
      const requestId = req.id || (req._id ? String(req._id) : '');
      const { _id, __v, ...requestData } = req;
      requestsMap.get(userId)?.push({
        ...requestData,
        id: requestId,
      });
    });

    const data = items.map((u: any) => {
      const userId = String(u.id || '').trim();
      return {
        id: u.id,
        phone: u.phone,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        idNumber: u.idNumber,
        role: u.role,
        isActive: u.isActive,
        profileImage: u.profileImage,
        requests: requestsMap.get(userId) || [],
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      };
    });

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
      idNumber?: string;
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
      'idNumber',
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
      if (
        field in updates &&
        updates[field as keyof typeof updates] !== undefined
      ) {
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

  async deleteUser(id: string) {
    const deleted = await this.userModel.findOneAndDelete({ id }).lean();
    if (!deleted) throw new BadRequestException('user_not_found');
    return deleted;
  }

  /**
   * აბრუნებს მომხმარებლების ტელეფონის ნომრებს და სახელებს
   * @param filter - ფილტრი (role, active, etc.)
   * @returns მომხმარებლების ინფორმაცია (phone, firstName, lastName)
   */
  async getPhoneNumbers(filter?: {
    role?: string;
    active?: boolean;
  }): Promise<Array<{ phone: string; firstName?: string; lastName?: string }>> {
    const queryFilter: any = {};
    if (filter?.role) queryFilter.role = filter.role;
    if (typeof filter?.active === 'boolean')
      queryFilter.isActive = filter.active;

    const users = await this.userModel
      .find(queryFilter)
      .select('phone firstName lastName')
      .lean();

    return users
      .filter((u: any) => u.phone)
      .map((u: any) => ({
        phone: u.phone,
        firstName: u.firstName || undefined,
        lastName: u.lastName || undefined,
      }));
  }
}
