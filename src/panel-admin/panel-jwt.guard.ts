import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

export interface PanelJwtPayload {
  sub: string;
  name?: string;
  role: string;
}

@Injectable()
export class PanelJwtGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const h = req.headers.authorization;
    const token =
      typeof h === 'string' && h.startsWith('Bearer ') ? h.slice(7).trim() : '';
    if (!token) {
      throw new UnauthorizedException();
    }
    try {
      const payload = this.jwt.verify<PanelJwtPayload>(token);
      if (payload.role !== 'panel_admin') {
        throw new UnauthorizedException();
      }
      (req as Request & { panelUser: PanelJwtPayload }).panelUser = payload;
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
