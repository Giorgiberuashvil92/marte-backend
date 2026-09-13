import { CanActivate, ExecutionContext, Injectable, Module, UnauthorizedException } from '@nestjs/common';
import { InjectModel, MongooseModule, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { createHash, randomBytes } from 'crypto';
import { User, UserSchema } from '../schemas/user.schema';

@Schema()
class UserSession {
  @Prop({ required: true, unique: true }) digest: string;
  @Prop({ required: true }) userId: string;
  @Prop({ required: true, expires: 0 }) expiresAt: Date;
}
const UserSessionSchema = SchemaFactory.createForClass(UserSession);
const digest = (token: string) => createHash('sha256').update(token).digest('hex');

@Injectable()
export class UserSessionService {
  constructor(@InjectModel(UserSession.name) private sessions: Model<UserSession>, @InjectModel(User.name) private users: Model<User>) {}
  async issue(userId: string) {
    const token = randomBytes(32).toString('hex');
    await this.sessions.create({ digest: digest(token), userId, expiresAt: new Date(Date.now() + 30 * 86400000) });
    return token;
  }
  async verify(token: string) {
    if (!/^[a-f0-9]{64}$/.test(token)) throw new UnauthorizedException();
    const session = await this.sessions.findOne({ digest: digest(token), expiresAt: { $gt: new Date() } }).lean();
    if (!session || !await this.users.exists({ id: session.userId, isActive: true })) throw new UnauthorizedException();
    return session.userId;
  }
  async revoke(token: string) { await this.sessions.deleteOne({ digest: digest(token) }); }
}
@Injectable()
export class UserSessionGuard implements CanActivate {
  constructor(private sessions: UserSessionService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const token = String(request.headers.authorization || '').replace(/^Bearer /, '');
    request.cashbackUserId = await this.sessions.verify(token);
    return true;
  }
}
@Module({
  imports: [MongooseModule.forFeature([{ name: UserSession.name, schema: UserSessionSchema }, { name: User.name, schema: UserSchema }])],
  providers: [UserSessionService, UserSessionGuard], exports: [UserSessionService, UserSessionGuard],
})
export class UserSessionModule {}
