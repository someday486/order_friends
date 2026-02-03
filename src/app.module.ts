import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { SupabaseModule } from './infra/supabase/supabase.module';
import { AuthModule } from './modules/auth/auth.module';
import { OrdersModule } from './modules/orders/orders.module';
import { ProductsModule } from './modules/products/products.module';
import { BranchesModule } from './modules/branches/branches.module';
import { BrandsModule } from './modules/brands/brands.module';
import { MembersModule } from './modules/members/members.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { PublicModule } from './modules/public/public.module';
import { PublicOrderModule } from './modules/public-order/public-order.module';

import { AuthGuard } from './common/guards/auth.guard';
import { MembershipGuard } from './common/guards/membership.guard';
import { PolicyGuard } from './common/guards/policy.guard';
import { AdminGuard } from './common/guards/admin.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SupabaseModule,
    AuthModule,
    OrdersModule,
    ProductsModule,
    BranchesModule,
    BrandsModule,
    MembersModule,
    DashboardModule,
    PublicModule,
    PublicOrderModule,
  ],
  providers: [AuthGuard, MembershipGuard, PolicyGuard, AdminGuard],
})
export class AppModule {}
