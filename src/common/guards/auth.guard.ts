import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import type { RequestUser } from '../decorators/current-user.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly supabase: SupabaseService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();

    const auth = req.headers['authorization'];
    if (!auth || typeof auth !== 'string' || !auth.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Bearer token');
    }

    const token = auth.slice('Bearer '.length).trim();
    const sb = this.supabase.userClient(token);

    const { data, error } = await sb.auth.getUser();
    if (error || !data?.user) {
      throw new UnauthorizedException('Invalid token');
    }

    const user: RequestUser = {
      id: data.user.id,
      email: data.user.email ?? undefined,
    };

    req.user = user;
    req.accessToken = token;
    return true;
  }
}
