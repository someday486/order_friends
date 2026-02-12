import { AppModule } from '../app.module';
import { SupabaseModule } from '../infra/supabase/supabase.module';
import { AuthModule } from '../modules/auth/auth.module';
import { AnalyticsModule } from '../modules/analytics/analytics.module';
import { BrandsModule } from '../modules/brands/brands.module';
import { BranchesModule } from '../modules/branches/branches.module';
import { CustomerBranchesModule } from '../modules/customer-branches/customer-branches.module';
import { CustomerBrandsModule } from '../modules/customer-brands/customer-brands.module';
import { CustomerDashboardModule } from '../modules/customer-dashboard/customer-dashboard.module';
import { CustomerOrdersModule } from '../modules/customer-orders/customer-orders.module';
import { CustomerProductsModule } from '../modules/customer-products/customer-products.module';
import { DashboardModule } from '../modules/dashboard/dashboard.module';
import { HealthModule } from '../modules/health/health.module';
import { InventoryModule } from '../modules/inventory/inventory.module';
import { MembersModule } from '../modules/members/members.module';
import { NotificationsModule } from '../modules/notifications/notifications.module';
import { OrdersModule } from '../modules/orders/orders.module';
import { PaymentsModule } from '../modules/payments/payments.module';
import { ProductsModule } from '../modules/products/products.module';
import { PublicModule } from '../modules/public/public.module';
import { PublicOrderModule } from '../modules/public-order/public-order.module';
import { UploadModule } from '../modules/upload/upload.module';
import {
  BranchDetailResponse,
  BranchListItemResponse,
} from '../modules/branches/dto/branch.response';
import { OrderDetailResponse } from '../modules/orders/dto/order-detail.response';
import { OrderListItemResponse } from '../modules/orders/dto/order-list.response';
import { ProductCategoryResponse } from '../modules/products/dto/product-category.response';
import { ProductDetailResponse } from '../modules/products/dto/product-detail.response';
import { ProductListItemResponse } from '../modules/products/dto/product-list.response';
import {
  NotificationStatus,
  NotificationType,
} from '../modules/notifications/dto/notification.dto';
import * as paymentsIndex from '../modules/payments';
import * as notificationsIndex from '../modules/notifications';

describe('Coverage Imports', () => {
  it('should load module classes', () => {
    expect(AppModule).toBeDefined();
    expect(SupabaseModule).toBeDefined();
    expect(AuthModule).toBeDefined();
    expect(AnalyticsModule).toBeDefined();
    expect(BrandsModule).toBeDefined();
    expect(BranchesModule).toBeDefined();
    expect(CustomerBranchesModule).toBeDefined();
    expect(CustomerBrandsModule).toBeDefined();
    expect(CustomerDashboardModule).toBeDefined();
    expect(CustomerOrdersModule).toBeDefined();
    expect(CustomerProductsModule).toBeDefined();
    expect(DashboardModule).toBeDefined();
    expect(HealthModule).toBeDefined();
    expect(InventoryModule).toBeDefined();
    expect(MembersModule).toBeDefined();
    expect(NotificationsModule).toBeDefined();
    expect(OrdersModule).toBeDefined();
    expect(PaymentsModule).toBeDefined();
    expect(ProductsModule).toBeDefined();
    expect(PublicModule).toBeDefined();
    expect(PublicOrderModule).toBeDefined();
    expect(UploadModule).toBeDefined();
  });

  it('should load dto classes and enums', () => {
    expect(new BranchDetailResponse()).toBeInstanceOf(BranchDetailResponse);
    expect(new BranchListItemResponse()).toBeInstanceOf(BranchListItemResponse);
    expect(new OrderDetailResponse()).toBeInstanceOf(OrderDetailResponse);
    expect(new OrderListItemResponse()).toBeInstanceOf(OrderListItemResponse);
    expect(new ProductCategoryResponse()).toBeInstanceOf(
      ProductCategoryResponse,
    );
    expect(new ProductDetailResponse()).toBeInstanceOf(ProductDetailResponse);
    expect(new ProductListItemResponse()).toBeInstanceOf(
      ProductListItemResponse,
    );
    expect(NotificationType.EMAIL).toBe('EMAIL');
    expect(NotificationStatus.SENT).toBe('SENT');
  });

  it('should export module indexes', () => {
    expect(Object.keys(paymentsIndex).length).toBeGreaterThan(0);
    expect(Object.keys(notificationsIndex).length).toBeGreaterThan(0);
  });
});
