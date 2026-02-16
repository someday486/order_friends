import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { CacheModule } from '@nestjs/cache-manager';

import { SupabaseModule } from './infra/supabase/supabase.module';
import { AuthModule } from './modules/auth/auth.module';
import { OrdersModule } from './modules/orders/orders.module';
import { ProductsModule } from './modules/products/products.module';
import { BranchesModule } from './modules/branches/branches.module';
import { BrandsModule } from './modules/brands/brands.module';
import { MembersModule } from './modules/members/members.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { PublicOrderModule } from './modules/public-order/public-order.module';
import { HealthModule } from './modules/health/health.module';
import { CustomerDashboardModule } from './modules/customer-dashboard/customer-dashboard.module';
import { CustomerBrandsModule } from './modules/customer-brands/customer-brands.module';
import { CustomerBranchesModule } from './modules/customer-branches/customer-branches.module';
import { CustomerProductsModule } from './modules/customer-products/customer-products.module';
import { CustomerOrdersModule } from './modules/customer-orders/customer-orders.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { UploadModule } from './modules/upload/upload.module';
import { ExportsModule } from './modules/exports/exports.module';

import { AuthGuard } from './common/guards/auth.guard';
import { MembershipGuard } from './common/guards/membership.guard';
import { PolicyGuard } from './common/guards/policy.guard';
import { AdminGuard } from './common/guards/admin.guard';
import { CustomerGuard } from './common/guards/customer.guard';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1분
        limit: 100, // 최대 100 요청
      },
    ]),
    CacheModule.register({
      isGlobal: true,
      ttl: 300000, // 5분 (밀리초)
      max: 100, // 최대 100개 항목
    }),
    SupabaseModule,
    AuthModule,
    OrdersModule,
    ProductsModule,
    BranchesModule,
    BrandsModule,
    MembersModule,
    DashboardModule,
    PublicOrderModule,
    HealthModule,
    CustomerDashboardModule,
    CustomerBrandsModule,
    CustomerBranchesModule,
    CustomerProductsModule,
    CustomerOrdersModule,
    InventoryModule,
    PaymentsModule,
    NotificationsModule,
    AnalyticsModule,
    UploadModule,
    ExportsModule,
  ],
  providers: [
    AuthGuard,
    MembershipGuard,
    PolicyGuard,
    AdminGuard,
    CustomerGuard,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {}
