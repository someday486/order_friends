"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const throttler_1 = require("@nestjs/throttler");
const core_1 = require("@nestjs/core");
const cache_manager_1 = require("@nestjs/cache-manager");
const supabase_module_1 = require("./infra/supabase/supabase.module");
const auth_module_1 = require("./modules/auth/auth.module");
const orders_module_1 = require("./modules/orders/orders.module");
const products_module_1 = require("./modules/products/products.module");
const branches_module_1 = require("./modules/branches/branches.module");
const brands_module_1 = require("./modules/brands/brands.module");
const members_module_1 = require("./modules/members/members.module");
const dashboard_module_1 = require("./modules/dashboard/dashboard.module");
const public_order_module_1 = require("./modules/public-order/public-order.module");
const health_module_1 = require("./modules/health/health.module");
const customer_dashboard_module_1 = require("./modules/customer-dashboard/customer-dashboard.module");
const customer_brands_module_1 = require("./modules/customer-brands/customer-brands.module");
const customer_branches_module_1 = require("./modules/customer-branches/customer-branches.module");
const customer_products_module_1 = require("./modules/customer-products/customer-products.module");
const customer_orders_module_1 = require("./modules/customer-orders/customer-orders.module");
const inventory_module_1 = require("./modules/inventory/inventory.module");
const payments_module_1 = require("./modules/payments/payments.module");
const notifications_module_1 = require("./modules/notifications/notifications.module");
const analytics_module_1 = require("./modules/analytics/analytics.module");
const upload_module_1 = require("./modules/upload/upload.module");
const auth_guard_1 = require("./common/guards/auth.guard");
const membership_guard_1 = require("./common/guards/membership.guard");
const policy_guard_1 = require("./common/guards/policy.guard");
const admin_guard_1 = require("./common/guards/admin.guard");
const customer_guard_1 = require("./common/guards/customer.guard");
const logging_interceptor_1 = require("./common/interceptors/logging.interceptor");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            throttler_1.ThrottlerModule.forRoot([
                {
                    ttl: 60000,
                    limit: 100,
                },
            ]),
            cache_manager_1.CacheModule.register({
                isGlobal: true,
                ttl: 300000,
                max: 100,
            }),
            supabase_module_1.SupabaseModule,
            auth_module_1.AuthModule,
            orders_module_1.OrdersModule,
            products_module_1.ProductsModule,
            branches_module_1.BranchesModule,
            brands_module_1.BrandsModule,
            members_module_1.MembersModule,
            dashboard_module_1.DashboardModule,
            public_order_module_1.PublicOrderModule,
            health_module_1.HealthModule,
            customer_dashboard_module_1.CustomerDashboardModule,
            customer_brands_module_1.CustomerBrandsModule,
            customer_branches_module_1.CustomerBranchesModule,
            customer_products_module_1.CustomerProductsModule,
            customer_orders_module_1.CustomerOrdersModule,
            inventory_module_1.InventoryModule,
            payments_module_1.PaymentsModule,
            notifications_module_1.NotificationsModule,
            analytics_module_1.AnalyticsModule,
            upload_module_1.UploadModule,
        ],
        providers: [
            auth_guard_1.AuthGuard,
            membership_guard_1.MembershipGuard,
            policy_guard_1.PolicyGuard,
            admin_guard_1.AdminGuard,
            customer_guard_1.CustomerGuard,
            {
                provide: core_1.APP_GUARD,
                useClass: throttler_1.ThrottlerGuard,
            },
            {
                provide: core_1.APP_INTERCEPTOR,
                useClass: logging_interceptor_1.LoggingInterceptor,
            },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map