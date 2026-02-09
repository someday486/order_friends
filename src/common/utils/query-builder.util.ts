import { SupabaseClient } from '@supabase/supabase-js';
import { ProductSearchDto, OrderSearchDto } from '../dto/search.dto';

export class QueryBuilder {
  /**
   * Build product search query with filters
   */
  static buildProductSearchQuery(
    supabase: SupabaseClient,
    branchId: string,
    searchDto: ProductSearchDto,
  ) {
    let query = supabase
      .from('products')
      .select('*', { count: 'exact' })
      .eq('branch_id', branchId);

    // Text search
    if (searchDto.q) {
      query = query.or(`name.ilike.%${searchDto.q}%,description.ilike.%${searchDto.q}%`);
    }

    // Category filter
    if (searchDto.category) {
      query = query.eq('category', searchDto.category);
    }

    // Price range
    if (searchDto.minPrice !== undefined) {
      query = query.gte('price', searchDto.minPrice);
    }
    if (searchDto.maxPrice !== undefined) {
      query = query.lte('price', searchDto.maxPrice);
    }

    // Stock filter
    if (searchDto.inStock) {
      query = query.gt('stock_qty', 0);
    }

    // Sorting
    const sortBy = searchDto.sortBy || 'created_at';
    const sortOrder = searchDto.sortOrder || 'desc';
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    // Pagination
    const page = searchDto.page || 1;
    const limit = searchDto.limit || 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    return query;
  }

  /**
   * Build order search query with filters
   */
  static buildOrderSearchQuery(
    supabase: SupabaseClient,
    branchId: string,
    searchDto: OrderSearchDto,
  ) {
    let query = supabase
      .from('orders')
      .select('*', { count: 'exact' })
      .eq('branch_id', branchId);

    // Text search (order number or customer name)
    if (searchDto.q) {
      query = query.or(
        `order_no.ilike.%${searchDto.q}%,customer_name.ilike.%${searchDto.q}%,customer_phone.ilike.%${searchDto.q}%`,
      );
    }

    // Status filter
    if (searchDto.status) {
      query = query.eq('status', searchDto.status);
    }

    // Customer name filter
    if (searchDto.customerName) {
      query = query.ilike('customer_name', `%${searchDto.customerName}%`);
    }

    // Date range
    if (searchDto.startDate) {
      query = query.gte('created_at', searchDto.startDate);
    }
    if (searchDto.endDate) {
      // Add one day to include the end date
      const endDate = new Date(searchDto.endDate);
      endDate.setDate(endDate.getDate() + 1);
      query = query.lt('created_at', endDate.toISOString().split('T')[0]);
    }

    // Amount range
    if (searchDto.minAmount !== undefined) {
      query = query.gte('total_amount', searchDto.minAmount);
    }
    if (searchDto.maxAmount !== undefined) {
      query = query.lte('total_amount', searchDto.maxAmount);
    }

    // Sorting
    const sortBy = searchDto.sortBy || 'created_at';
    const sortOrder = searchDto.sortOrder || 'desc';
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    // Pagination
    const page = searchDto.page || 1;
    const limit = searchDto.limit || 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    return query;
  }

  /**
   * Build generic search query
   */
  static buildGenericSearchQuery(
    query: any,
    searchField: string,
    searchValue: string,
  ) {
    return query.ilike(searchField, `%${searchValue}%`);
  }
}
