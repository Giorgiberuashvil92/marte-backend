import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import {
  PanelAdminUser,
  PanelAdminUserSchema,
} from '../schemas/panel-admin-user.schema';
import { PanelAdminController } from './panel-admin.controller';
import { PanelAdminService } from './panel-admin.service';
import { PanelJwtGuard } from './panel-jwt.guard';

function resolvePanelJwtSecret(): string {
  const s = process.env.PANEL_ADMIN_JWT_SECRET?.trim();
  if (s && s.length >= 24) {
    return s;
  }
  if (process.env.NODE_ENV !== 'production') {
    return 'panel_admin_dev_jwt_secret_min_24_chars_ok';
  }
  throw new Error(
    'PANEL_ADMIN_JWT_SECRET აუცილებელია პროდაქშენში (მინ. 24 სიმბოლო).',
  );
}

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PanelAdminUser.name, schema: PanelAdminUserSchema },
    ]),
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: resolvePanelJwtSecret(),
        signOptions: { expiresIn: '7d' },
      }),
    }),
  ],
  controllers: [PanelAdminController],
  providers: [PanelAdminService, PanelJwtGuard],
  exports: [PanelAdminService],
})
export class PanelAdminModule {}
