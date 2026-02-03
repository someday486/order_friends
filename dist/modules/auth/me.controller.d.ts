import type { RequestUser } from '../../common/decorators/current-user.decorator';
export declare class MeController {
    me(user: RequestUser): {
        user: RequestUser;
    };
}
