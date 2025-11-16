import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

interface AuthenticatedRequest extends Request {
  user?: {
    id?: string;
    uid?: string;
  };
}

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  use(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    // Get user ID from header
    const userId = req.headers['x-user-id'] as string;

    if (userId) {
      req.user = {
        id: userId,
        uid: userId,
      };
      console.log('🔐 Auth middleware: User ID set from header:', userId);
    } else {
      console.log('⚠️ Auth middleware: No user ID in header');
      // For development, we'll allow requests without auth
      // In production, you'd want to throw an error here
      req.user = {
        id: 'demo-user',
        uid: 'demo-user',
      };
    }

    next();
  }
}
