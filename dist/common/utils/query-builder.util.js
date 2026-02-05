"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryBuilder = void 0;
class QueryBuilder {
    static buildProductSearchQuery(supabase, branchId, searchDto) {
        let query = supabase
            .from('products')
            .select('*', { count: 'exact' })
            .eq('branch_id', branchId);
        if (searchDto.q) {
            query = query.or(`name.ilike.%${searchDto.q}%,description.ilike.%${searchDto.q}%`);
        }
        if (searchDto.category) {
            query = query.eq('category', searchDto.category);
        }
        if (searchDto.minPrice !== undefined) {
            query = query.gte('price', searchDto.minPrice);
        }
        if (searchDto.maxPrice !== undefined) {
            query = query.lte('price', searchDto.maxPrice);
        }
        if (searchDto.inStock) {
            query = query.gt('stock_qty', 0);
        }
        const sortBy = searchDto.sortBy || 'created_at';
        const sortOrder = searchDto.sortOrder || 'desc';
        query = query.order(sortBy, { ascending: sortOrder === 'asc' });
        const page = searchDto.page || 1;
        const limit = searchDto.limit || 20;
        const from = (page - 1) * limit;
        const to = from + limit - 1;
        query = query.range(from, to);
        return query;
    }
    static buildOrderSearchQuery(supabase, branchId, searchDto) {
        let query = supabase
            .from('orders')
            .select('*', { count: 'exact' })
            .eq('branch_id', branchId);
        if (searchDto.q) {
            query = query.or(`order_no.ilike.%${searchDto.q}%,customer_name.ilike.%${searchDto.q}%,customer_phone.ilike.%${searchDto.q}%`);
        }
        if (searchDto.status) {
            query = query.eq('status', searchDto.status);
        }
        if (searchDto.customerName) {
            query = query.ilike('customer_name', `%${searchDto.customerName}%`);
        }
        if (searchDto.startDate) {
            query = query.gte('created_at', searchDto.startDate);
        }
        if (searchDto.endDate) {
            const endDate = new Date(searchDto.endDate);
            endDate.setDate(endDate.getDate() + 1);
            query = query.lt('created_at', endDate.toISOString().split('T')[0]);
        }
        if (searchDto.minAmount !== undefined) {
            query = query.gte('total_amount', searchDto.minAmount);
        }
        if (searchDto.maxAmount !== undefined) {
            query = query.lte('total_amount', searchDto.maxAmount);
        }
        const sortBy = searchDto.sortBy || 'created_at';
        const sortOrder = searchDto.sortOrder || 'desc';
        query = query.order(sortBy, { ascending: sortOrder === 'asc' });
        const page = searchDto.page || 1;
        const limit = searchDto.limit || 20;
        const from = (page - 1) * limit;
        const to = from + limit - 1;
        query = query.range(from, to);
        return query;
    }
    static buildGenericSearchQuery(query, searchField, searchValue) {
        return query.ilike(searchField, `%${searchValue}%`);
    }
}
exports.QueryBuilder = QueryBuilder;
//# sourceMappingURL=query-builder.util.js.map