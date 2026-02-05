"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserRateLimit = void 0;
const common_1 = require("@nestjs/common");
const user_rate_limit_guard_1 = require("../guards/user-rate-limit.guard");
const UserRateLimit = (options) => (0, common_1.SetMetadata)(user_rate_limit_guard_1.USER_RATE_LIMIT_KEY, options);
exports.UserRateLimit = UserRateLimit;
//# sourceMappingURL=user-rate-limit.decorator.js.map