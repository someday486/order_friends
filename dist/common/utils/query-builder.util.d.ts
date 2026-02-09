import { SupabaseClient } from '@supabase/supabase-js';
import { ProductSearchDto, OrderSearchDto } from '../dto/search.dto';
export declare class QueryBuilder {
    static buildProductSearchQuery(supabase: SupabaseClient, branchId: string, searchDto: ProductSearchDto): import("@supabase/postgrest-js").PostgrestFilterBuilder<any, any, any, any[], "products", unknown, "GET">;
    static buildOrderSearchQuery(supabase: SupabaseClient, branchId: string, searchDto: OrderSearchDto): import("@supabase/postgrest-js").PostgrestFilterBuilder<any, any, any, any[], "orders", unknown, "GET">;
    static buildGenericSearchQuery(query: any, searchField: string, searchValue: string): any;
}
