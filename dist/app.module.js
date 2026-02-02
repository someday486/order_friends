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
const supabase_module_1 = require("./infra/supabase/supabase.module");
const auth_module_1 = require("./modules/auth/auth.module");
const orders_module_1 = require("./modules/orders/orders.module");
const products_module_1 = require("./modules/products/products.module");
const branches_module_1 = require("./modules/branches/branches.module");
const brands_module_1 = require("./modules/brands/brands.module");
const members_module_1 = require("./modules/members/members.module");
const dashboard_module_1 = require("./modules/dashboard/dashboard.module");
const public_module_1 = require("./modules/public/public.module");
const public_order_module_1 = require("./modules/public-order/public-order.module");
const auth_guard_1 = require("./common/guards/auth.guard");
const membership_guard_1 = require("./common/guards/membership.guard");
const policy_guard_1 = require("./common/guards/policy.guard");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            supabase_module_1.SupabaseModule,
            auth_module_1.AuthModule,
            orders_module_1.OrdersModule,
            products_module_1.ProductsModule,
            branches_module_1.BranchesModule,
            brands_module_1.BrandsModule,
            members_module_1.MembersModule,
            dashboard_module_1.DashboardModule,
            public_module_1.PublicModule,
            public_order_module_1.PublicOrderModule,
        ],
        providers: [auth_guard_1.AuthGuard, membership_guard_1.MembershipGuard, policy_guard_1.PolicyGuard],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map