import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { SupabaseModule } from './infra/supabase/supabase.module';
import { AuthModule } from './modules/auth/auth.module';
import { OrdersModule } from './modules/orders/orders.module';
import { ProductsModule } from './modules/products/products.module';
import { BranchesModule } from './modules/branches/branches.module';
import { BrandsModule } from './modules/brands/brands.module';

import { AuthGuard } from './common/guards/auth.guard';
import { MembershipGuard } from './common/guards/membership.guard';
import { PolicyGuard } from './common/guards/policy.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SupabaseModule,
    AuthModule,
    OrdersModule,
    ProductsModule,
    BranchesModule,
    BrandsModule,
  ],
  providers: [AuthGuard, MembershipGuard, PolicyGuard],
})
export class AppModule {}
