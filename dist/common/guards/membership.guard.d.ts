import { CanActivate, ExecutionContext } from '@nestjs/common';
export declare class MembershipGuard implements CanActivate {
    canActivate(ctx: ExecutionContext): Promise<boolean>;
}
