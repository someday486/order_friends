import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

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
import { HealthModule } from './modules/health/health.module';

import { AuthGuard } from './common/guards/auth.guard';
import { MembershipGuard } from './common/guards/membership.guard';
import { PolicyGuard } from './common/guards/policy.guard';
import { AdminGuard } from './common/guards/admin.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1분
        limit: 100, // 최대 100 요청
      },
    ]),
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
    HealthModule,
  ],
  providers: [
    AuthGuard,
    MembershipGuard,
    PolicyGuard,
    AdminGuard,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
