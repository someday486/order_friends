import type { RequestUser } from '../../common/decorators/current-user.decorator';
import { SupabaseService } from '../../infra/supabase/supabase.service';
export declare class MeController {
    private readonly supabase;
    constructor(supabase: SupabaseService);
    me(user: RequestUser): Promise<{
        user: {
            id: string;
            email: string | undefined;
            role: string;
        };
        memberships: {
            id: any;
            role: any;
            branch_id: any;
            branches: {
                id: any;
                name: any;
                brand_id: any;
                brands: {
                    id: any;
                    name: any;
                    owner_user_id: any;
                }[];
            }[];
        }[];
        ownedBrands: {
            id: any;
            name: any;
        }[];
        isSystemAdmin: boolean;
    }>;
}
