"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequirePermissions = exports.REQUIRE_PERMISSIONS_KEY = void 0;
const common_1 = require("@nestjs/common");
exports.REQUIRE_PERMISSIONS_KEY = 'require_permissions';
const RequirePermissions = (...perms) => (0, common_1.SetMetadata)(exports.REQUIRE_PERMISSIONS_KEY, perms);
exports.RequirePermissions = RequirePermissions;
//# sourceMappingURL=require-permissions.decorator.js.map