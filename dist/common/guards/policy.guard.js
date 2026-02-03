"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PolicyGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const require_permissions_decorator_1 = require("../decorators/require-permissions.decorator");
const policy_1 = require("../../modules/auth/authorization/policy");
let PolicyGuard = class PolicyGuard {
    reflector;
    constructor(reflector) {
        this.reflector = reflector;
    }
    canActivate(ctx) {
        const required = this.reflector.getAllAndOverride(require_permissions_decorator_1.REQUIRE_PERMISSIONS_KEY, [
            ctx.getHandler(),
            ctx.getClass(),
        ]) ?? [];
        if (required.length === 0)
            return true;
        const req = ctx.switchToHttp().getRequest();
        if (req?.isAdmin)
            return true;
        const role = req.role;
        if (!role) {
            throw new common_1.ForbiddenException('Missing role (membership required)');
        }
        const allowed = new Set(policy_1.ROLE_PERMISSIONS[role] ?? []);
        const ok = required.every((p) => allowed.has(p));
        if (!ok) {
            throw new common_1.ForbiddenException('Insufficient permissions');
        }
        return true;
    }
};
exports.PolicyGuard = PolicyGuard;
exports.PolicyGuard = PolicyGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector])
], PolicyGuard);
//# sourceMappingURL=policy.guard.js.map