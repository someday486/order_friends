"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PublicOrderModule = void 0;
const common_1 = require("@nestjs/common");
const public_order_controller_1 = require("./public-order.controller");
const public_order_service_1 = require("./public-order.service");
const supabase_module_1 = require("../../infra/supabase/supabase.module");
let PublicOrderModule = class PublicOrderModule {
};
exports.PublicOrderModule = PublicOrderModule;
exports.PublicOrderModule = PublicOrderModule = __decorate([
    (0, common_1.Module)({
        imports: [supabase_module_1.SupabaseModule],
        controllers: [public_order_controller_1.PublicOrderController],
        providers: [public_order_service_1.PublicOrderService],
    })
], PublicOrderModule);
//# sourceMappingURL=public-order.module.js.map