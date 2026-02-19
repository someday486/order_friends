import {
  Injectable,
  Logger,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import type { BrandMembership } from '../../common/types/auth-request';
import {
  CreateCustomerBrandRequest,
  UpdateCustomerBrandRequest,
} from './dto/customer-brand.request';

const SHOP_PAYMENT_METHODS = ['CARD', 'TRANSFER', 'CASH'] as const;
type ShopPaymentMethod = (typeof SHOP_PAYMENT_METHODS)[number];

@Injectable()
export class CustomerBrandsService {
  private readonly logger = new Logger(CustomerBrandsService.name);

  constructor(private readonly supabase: SupabaseService) {}

  private normalizeShopPaymentMethods(value: unknown): ShopPaymentMethod[] {
    if (!Array.isArray(value)) {
      return [...SHOP_PAYMENT_METHODS];
    }

    const set = new Set<ShopPaymentMethod>();
    for (const item of value) {
      const upper = typeof item === 'string' ? item.trim().toUpperCase() : '';
      if ((SHOP_PAYMENT_METHODS as readonly string[]).includes(upper)) {
        set.add(upper as ShopPaymentMethod);
      }
    }

    if (set.size === 0) {
      return [...SHOP_PAYMENT_METHODS];
    }

    return [...set];
  }

  async getMyBrands(userId: string, brandMemberships: BrandMembership[]) {
    this.logger.log(`Fetching brands for user: ${userId}`);

    const brandIds = brandMemberships.map((m) => m.brand_id);
    const sb = this.supabase.adminClient();

    const [memberBrandsResult, ownedBrandsResult] = await Promise.all([
      brandIds.length > 0
        ? sb
            .from('brands')
            .select(
              'id, name, slug, biz_name, biz_reg_no, rep_name, address, biz_cert_url, shop_payment_methods, owner_user_id, logo_url, cover_image_url, thumbnail_url, created_at',
            )
            .in('id', brandIds)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      sb
        .from('brands')
        .select(
          'id, name, slug, biz_name, biz_reg_no, rep_name, address, biz_cert_url, shop_payment_methods, owner_user_id, logo_url, cover_image_url, thumbnail_url, created_at',
        )
        .eq('owner_user_id', userId)
        .order('created_at', { ascending: false }),
    ]);

    if (memberBrandsResult.error) {
      this.logger.error(
        `Failed to fetch membership brands for user ${userId}`,
        memberBrandsResult.error,
      );
      throw new Error('Failed to fetch brands');
    }

    if (ownedBrandsResult.error) {
      this.logger.error(
        `Failed to fetch owned brands for user ${userId}`,
        ownedBrandsResult.error,
      );
      throw new Error('Failed to fetch brands');
    }

    const mergedById = new Map<string, any>();
    for (const brand of memberBrandsResult.data ?? []) {
      mergedById.set(brand.id, brand);
    }
    for (const brand of ownedBrandsResult.data ?? []) {
      mergedById.set(brand.id, brand);
    }

    const membershipByBrandId = new Map(
      brandMemberships.map((membership) => [membership.brand_id, membership]),
    );

    const brandsWithRole = Array.from(mergedById.values())
      .sort((a, b) => {
        const left = String(a.created_at ?? '');
        const right = String(b.created_at ?? '');
        return right.localeCompare(left);
      })
      .map((brand) => {
        const membership = membershipByBrandId.get(brand.id);
        return {
          ...brand,
          slug: brand.slug ?? null,
          shop_payment_methods: this.normalizeShopPaymentMethods(
            brand.shop_payment_methods,
          ),
          myRole:
            membership?.role ??
            (brand.owner_user_id === userId ? 'OWNER' : null),
        };
      });

    this.logger.log(
      `Fetched ${brandsWithRole.length} brands for user: ${userId}`,
    );

    return brandsWithRole;
  }

  async getMyBrand(
    brandId: string,
    userId: string,
    brandMemberships: BrandMembership[],
  ) {
    this.logger.log(`Fetching brand ${brandId} for user: ${userId}`);

    const membership = brandMemberships.find((m) => m.brand_id === brandId);
    if (!membership) {
      this.logger.warn(
        `User ${userId} attempted to access brand ${brandId} without membership`,
      );
      throw new ForbiddenException('You do not have access to this brand');
    }

    const sb = this.supabase.adminClient();

    const { data, error } = await sb
      .from('brands')
      .select(
        'id, name, slug, biz_name, biz_reg_no, rep_name, address, biz_cert_url, shop_payment_methods, owner_user_id, logo_url, cover_image_url, thumbnail_url, created_at',
      )
      .eq('id', brandId)
      .single();

    if (error || !data) {
      this.logger.error(`Failed to fetch brand ${brandId}`, error);
      throw new NotFoundException('Brand not found');
    }

    return {
      ...data,
      shop_payment_methods: this.normalizeShopPaymentMethods(
        data.shop_payment_methods,
      ),
      myRole: membership.role,
    };
  }

  async createMyBrand(
    createData: CreateCustomerBrandRequest,
    userId: string,
    brandMemberships: BrandMembership[],
  ) {
    const hasManagePermission = brandMemberships.some(
      (m) => m.role === 'OWNER' || m.role === 'ADMIN',
    );

    if (!hasManagePermission) {
      this.logger.warn(
        `User ${userId} has no owner/admin membership and attempted to create brand`,
      );
      throw new ForbiddenException('Only OWNER or ADMIN can create a brand');
    }

    const sb = this.supabase.adminClient();

    const insertPayload: Record<string, unknown> = {
      name: createData.name,
      slug: createData.slug ?? null,
      owner_user_id: userId,
      biz_name: createData.biz_name ?? null,
      biz_reg_no: createData.biz_reg_no ?? null,
      rep_name: createData.rep_name ?? null,
      address: createData.address ?? null,
      biz_cert_url: createData.biz_cert_url ?? createData.bizCertUrl ?? null,
      logo_url: createData.logo_url ?? null,
      cover_image_url: createData.cover_image_url ?? null,
    };
    if (createData.shop_payment_methods !== undefined) {
      insertPayload.shop_payment_methods = this.normalizeShopPaymentMethods(
        createData.shop_payment_methods,
      );
    }

    const { data, error } = await sb
      .from('brands')
      .insert(insertPayload)
      .select(
        'id, name, slug, owner_user_id, biz_name, biz_reg_no, rep_name, address, biz_cert_url, shop_payment_methods, logo_url, cover_image_url, created_at',
      )
      .single();

    if (error || !data) {
      this.logger.error('Failed to create brand', error);
      throw new Error('Failed to create brand');
    }

    const memberResult = await sb.from('brand_members').insert({
      brand_id: data.id,
      user_id: userId,
      role: 'OWNER',
      status: 'ACTIVE',
    });

    if (memberResult.error) {
      await sb.from('brands').delete().eq('id', data.id);
      this.logger.error(
        `Failed to create owner membership for brand ${data.id}`,
        memberResult.error,
      );
      throw new Error('Failed to create brand membership');
    }

    return {
      ...data,
      myRole: 'OWNER',
      slug: data.slug ?? null,
      shop_payment_methods: this.normalizeShopPaymentMethods(
        data.shop_payment_methods,
      ),
    };
  }

  async updateMyBrand(
    brandId: string,
    updateData: UpdateCustomerBrandRequest,
    userId: string,
    brandMemberships: BrandMembership[],
  ) {
    this.logger.log(`Updating brand ${brandId} by user: ${userId}`);

    const membership = brandMemberships.find((m) => m.brand_id === brandId);
    if (!membership) {
      throw new ForbiddenException('You do not have access to this brand');
    }

    if (membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
      this.logger.warn(
        `User ${userId} with role ${membership.role} attempted to update brand ${brandId}`,
      );
      throw new ForbiddenException(
        'Only OWNER or ADMIN can update brand information',
      );
    }

    const sb = this.supabase.adminClient();

    const {
      name,
      slug,
      biz_name,
      biz_reg_no,
      rep_name,
      address,
      biz_cert_url,
      bizCertUrl,
      logo_url,
      cover_image_url,
      shop_payment_methods,
    } = updateData;
    const updateFields: any = {};
    if (name !== undefined) updateFields.name = name;
    if (slug !== undefined) updateFields.slug = slug;
    if (biz_name !== undefined) updateFields.biz_name = biz_name;
    if (biz_reg_no !== undefined) updateFields.biz_reg_no = biz_reg_no;
    if (rep_name !== undefined) updateFields.rep_name = rep_name;
    if (address !== undefined) updateFields.address = address;
    if (biz_cert_url !== undefined || bizCertUrl !== undefined) {
      updateFields.biz_cert_url = biz_cert_url ?? bizCertUrl ?? null;
    }
    if (logo_url !== undefined) updateFields.logo_url = logo_url;
    if (cover_image_url !== undefined)
      updateFields.cover_image_url = cover_image_url;
    if (shop_payment_methods !== undefined) {
      updateFields.shop_payment_methods =
        this.normalizeShopPaymentMethods(shop_payment_methods);
    }

    const { data, error } = await sb
      .from('brands')
      .update(updateFields)
      .eq('id', brandId)
      .select(
        'id, name, slug, biz_name, biz_reg_no, rep_name, address, biz_cert_url, shop_payment_methods, owner_user_id, logo_url, cover_image_url, created_at',
      )
      .single();

    if (error || !data) {
      this.logger.error(`Failed to update brand ${brandId}`, error);
      throw new Error('Failed to update brand');
    }

    this.logger.log(`Brand ${brandId} updated successfully`);

    return {
      ...data,
      shop_payment_methods: this.normalizeShopPaymentMethods(
        data.shop_payment_methods,
      ),
      myRole: membership.role,
    };
  }
}
