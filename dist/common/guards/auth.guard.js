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
const config_1 = require("@nestjs/config");
const supabase_service_1 = require("../../infra/supabase/supabase.service");
let AuthGuard = class AuthGuard {
    supabase;
    config;
    adminEmails;
    adminUserIds;
    adminEmailDomains;
    adminBypassAll;
    constructor(supabase, config) {
        this.supabase = supabase;
        this.config = config;
        const rawEmails = this.parseList(this.config.get('ADMIN_EMAILS'));
        const rawUserIds = this.parseList(this.config.get('ADMIN_USER_IDS'));
        const rawDomains = this.parseList(this.config.get('ADMIN_EMAIL_DOMAINS'));
        this.adminEmails = new Set(rawEmails.map((value) => value.toLowerCase()));
        this.adminUserIds = new Set(rawUserIds);
        this.adminEmailDomains = this.normalizeDomains(rawDomains);
        this.adminBypassAll = this.parseBoolean(this.config.get('ADMIN_BYPASS'));
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
        const email = data.user.email?.toLowerCase();
        const isAdmin = this.adminBypassAll ||
            this.adminUserIds.has(data.user.id) ||
            (email ? this.adminEmails.has(email) : false) ||
            (email ? this.isAllowedDomain(email) : false) ||
            this.isAdminFromMetadata(data.user);
        req.user = user;
        req.accessToken = token;
        req.isAdmin = isAdmin;
        return true;
    }
    parseList(value) {
        if (!value)
            return [];
        return value
            .split(/[,;\s]+/)
            .map((item) => item.trim())
            .filter((item) => item.length > 0);
    }
    parseBoolean(value) {
        if (!value)
            return false;
        const normalized = value.trim().toLowerCase();
        return normalized === 'true' || normalized === '1' || normalized === 'yes';
    }
    normalizeDomains(values) {
        const domains = values
            .map((value) => value.trim().toLowerCase())
            .filter((value) => value.length > 0)
            .map((value) => (value.startsWith('@') ? value.slice(1) : value));
        return new Set(domains);
    }
    isAllowedDomain(email) {
        if (this.adminEmailDomains.size === 0)
            return false;
        const domain = email.split('@')[1]?.trim().toLowerCase();
        if (!domain)
            return false;
        return this.adminEmailDomains.has(domain);
    }
    isAdminFromMetadata(user) {
        const appMetadata = user?.app_metadata ?? {};
        const userMetadata = user?.user_metadata ?? {};
        const appFlag = appMetadata?.is_admin;
        const userFlag = userMetadata?.is_admin;
        const appRole = appMetadata?.role;
        const userRole = userMetadata?.role;
        if (appFlag === true || userFlag === true)
            return true;
        if (typeof appRole === 'string' && appRole.toLowerCase() === 'admin')
            return true;
        if (typeof userRole === 'string' && userRole.toLowerCase() === 'admin')
            return true;
        return false;
    }
};
exports.AuthGuard = AuthGuard;
exports.AuthGuard = AuthGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService,
        config_1.ConfigService])
], AuthGuard);
//# sourceMappingURL=auth.guard.js.map