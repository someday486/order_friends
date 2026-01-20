import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';

@Injectable()
export class MembershipGuard implements CanActivate {
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    // TODO: Supabase 연결 후
    // - brand_members / branch_members 조회
    return true;
  }
}
