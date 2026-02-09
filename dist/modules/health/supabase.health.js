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
exports.SupabaseHealthIndicator = void 0;
const common_1 = require("@nestjs/common");
const terminus_1 = require("@nestjs/terminus");
const supabase_service_1 = require("../../infra/supabase/supabase.service");
let SupabaseHealthIndicator = class SupabaseHealthIndicator extends terminus_1.HealthIndicator {
    supabase;
    constructor(supabase) {
        super();
        this.supabase = supabase;
    }
    async isHealthy(key) {
        try {
            const client = this.supabase.adminClient();
            const { error } = await client.from('profiles').select('id').limit(1);
            if (error) {
                throw new Error(`Supabase connection failed: ${error.message}`);
            }
            return this.getStatus(key, true);
        }
        catch (error) {
            throw new terminus_1.HealthCheckError('Supabase check failed', this.getStatus(key, false, { message: error.message }));
        }
    }
};
exports.SupabaseHealthIndicator = SupabaseHealthIndicator;
exports.SupabaseHealthIndicator = SupabaseHealthIndicator = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService])
], SupabaseHealthIndicator);
//# sourceMappingURL=supabase.health.js.map