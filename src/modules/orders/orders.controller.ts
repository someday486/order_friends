import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { MembershipGuard } from '../../common/guards/membership.guard';
import { PolicyGuard } from '../../common/guards/policy.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { Permission } from '../auth/authorization/permissions';
import { Role } from '../auth/authorization/roles.enum';

@Controller('/admin')
export class OrdersController {
  @Get('/orders')
  @UseGuards(AuthGuard, MembershipGuard, PolicyGuard)
  @RequirePermissions(Permission.ORDER_READ)
  listOrders() {
    // ✅ Supabase 붙이기 전 임시 응답
    return {
      items: [],
      total: 0,
      note: 'Mock response (Supabase pending)',
    };
  }
}
