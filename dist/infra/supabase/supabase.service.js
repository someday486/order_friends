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
var SupabaseService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupabaseService = void 0;
const common_1 = require("@nestjs/common");
const supabase_js_1 = require("@supabase/supabase-js");
const config_1 = require("@nestjs/config");
const USER_CLIENT_MAX_SIZE = 50;
const USER_CLIENT_TTL_MS = 5 * 60 * 1000;
let SupabaseService = SupabaseService_1 = class SupabaseService {
    config;
    logger = new common_1.Logger(SupabaseService_1.name);
    supabaseUrl = null;
    anonKey = null;
    serviceRoleKey = null;
    admin = null;
    anon = null;
    userClients = new Map();
    constructor(config) {
        this.config = config;
        const url = this.config.get('SUPABASE_URL');
        const anon = this.config.get('SUPABASE_ANON_KEY');
        const service = this.config.get('SUPABASE_SERVICE_ROLE_KEY');
        if (!url) {
            this.logger.warn('Supabase env missing: SUPABASE_URL. Supabase is disabled.');
            return;
        }
        this.supabaseUrl = url;
        this.anonKey = anon ?? null;
        this.serviceRoleKey = service ?? null;
        if (this.serviceRoleKey) {
            this.admin = (0, supabase_js_1.createClient)(this.supabaseUrl, this.serviceRoleKey);
        }
        else {
            this.logger.warn('Supabase env missing: SUPABASE_SERVICE_ROLE_KEY. admin client disabled.');
        }
        if (!this.anonKey) {
            this.logger.warn('Supabase env missing: SUPABASE_ANON_KEY. user client may be limited.');
        }
    }
    adminClient() {
        if (!this.admin) {
            throw new Error('Supabase admin client is not initialized. Check SUPABASE_SERVICE_ROLE_KEY.');
        }
        return this.admin;
    }
    userClient(userAccessToken) {
        if (!this.supabaseUrl || !this.anonKey) {
            throw new Error('Supabase user client is not initialized. Check SUPABASE_URL / SUPABASE_ANON_KEY.');
        }
        const now = Date.now();
        const cached = this.userClients.get(userAccessToken);
        if (cached && now - cached.createdAt < USER_CLIENT_TTL_MS) {
            return cached.client;
        }
        if (this.userClients.size >= USER_CLIENT_MAX_SIZE) {
            for (const [key, entry] of this.userClients) {
                if (now - entry.createdAt >= USER_CLIENT_TTL_MS) {
                    this.userClients.delete(key);
                }
            }
            if (this.userClients.size >= USER_CLIENT_MAX_SIZE) {
                const firstKey = this.userClients.keys().next().value;
                this.userClients.delete(firstKey);
            }
        }
        const client = (0, supabase_js_1.createClient)(this.supabaseUrl, this.anonKey, {
            global: {
                headers: {
                    Authorization: `Bearer ${userAccessToken}`,
                },
            },
        });
        this.userClients.set(userAccessToken, { client, createdAt: now });
        return client;
    }
    anonClient() {
        if (!this.supabaseUrl || !this.anonKey) {
            throw new Error('Supabase anon client is not initialized. Check SUPABASE_URL / SUPABASE_ANON_KEY.');
        }
        if (!this.anon) {
            this.anon = (0, supabase_js_1.createClient)(this.supabaseUrl, this.anonKey);
        }
        return this.anon;
    }
};
exports.SupabaseService = SupabaseService;
exports.SupabaseService = SupabaseService = SupabaseService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], SupabaseService);
//# sourceMappingURL=supabase.service.js.map