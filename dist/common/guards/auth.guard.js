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
exports.AuthGuard = void 0;
const common_1 = require("@nestjs/common");
const supabase_service_1 = require("../../infra/supabase/supabase.service");
let AuthGuard = class AuthGuard {
    supabase;
    constructor(supabase) {
        this.supabase = supabase;
    }
    async canActivate(ctx) {
        const req = ctx.switchToHttp().getRequest();
        const auth = req.headers['authorization'];
        if (!auth || typeof auth !== 'string' || !auth.startsWith('Bearer ')) {
            throw new common_1.UnauthorizedException('Missing Bearer token');
        }
        const token = auth.slice('Bearer '.length).trim();
        const sb = this.supabase.userClient(token);
        const { data, error } = await sb.auth.getUser();
        if (error || !data?.user) {
            throw new common_1.UnauthorizedException('Invalid token');
        }
        const user = {
            id: data.user.id,
            email: data.user.email ?? undefined,
        };
        req.user = user;
        req.accessToken = token;
        return true;
    }
};
exports.AuthGuard = AuthGuard;
exports.AuthGuard = AuthGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService])
], AuthGuard);
//# sourceMappingURL=auth.guard.js.map