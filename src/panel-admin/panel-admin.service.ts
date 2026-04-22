import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcryptjs';
import { Model } from 'mongoose';
import {
  PanelAdminUser,
  PanelAdminUserDocument,
} from '../schemas/panel-admin-user.schema';
import type { PanelJwtPayload } from './panel-jwt.guard';

@Injectable()
export class PanelAdminService {
  constructor(
    @InjectModel(PanelAdminUser.name)
    private readonly panelUserModel: Model<PanelAdminUserDocument>,
    private readonly jwt: JwtService,
  ) {}

  async login(username: string, password: string) {
    const u = username?.trim().toLowerCase();
    if (!u || !password) {
      throw new UnauthorizedException('არასწორი მონაცემები.');
    }
    const user = await this.panelUserModel
      .findOne({ username: u, active: true })
      .lean();
    if (!user?.passwordHash) {
      throw new UnauthorizedException('არასწორი მომხმარებელი ან პაროლი.');
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('არასწორი მომხმარებელი ან პაროლი.');
    }
    const payload: PanelJwtPayload = {
      sub: user.username,
      name: user.displayName,
      role: 'panel_admin',
    };
    const access_token = await this.jwt.signAsync(payload);
    return {
      access_token,
      user: {
        username: user.username,
        displayName: user.displayName ?? user.username,
      },
    };
  }

  sessionFromPayload(payload: PanelJwtPayload) {
    return {
      user: {
        username: payload.sub,
        displayName: payload.name ?? payload.sub,
      },
    };
  }
}
