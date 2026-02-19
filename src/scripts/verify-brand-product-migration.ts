import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';

type ProductRow = {
  id: string;
  branch_id: string | null;
  brand_product_id: string | null;
};

type BranchRow = {
  id: string;
  brand_id: string | null;
};

type BrandProductRow = {
  id: string;
  brand_id: string | null;
};

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return;
  const content = readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator <= 0) continue;

    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

async function fetchAll<T>(
  fetcher: (
    from: number,
    to: number,
  ) => Promise<{ data: T[] | null; error: any }>,
  pageSize = 1000,
) {
  const rows: T[] = [];
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await fetcher(from, to);
    if (error) {
      throw new Error(error.message ?? 'Unknown Supabase error');
    }

    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

async function main() {
  loadEnvFile(join(process.cwd(), '.env'));
  loadEnvFile(join(process.cwd(), '.env.local'));

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing');
  }

  const sb = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const [brandProductsProbe, productsProbe] = await Promise.all([
    sb.from('brand_products').select('id,brand_id').limit(1),
    sb.from('products').select('id,branch_id,brand_product_id').limit(1),
  ]);

  if (brandProductsProbe.error) {
    throw new Error(
      `brand_products probe failed: ${brandProductsProbe.error.message}`,
    );
  }
  if (productsProbe.error) {
    throw new Error(`products probe failed: ${productsProbe.error.message}`);
  }

  const [products, branches, brandProducts] = await Promise.all([
    fetchAll<ProductRow>(async (from, to) =>
      sb
        .from('products')
        .select('id,branch_id,brand_product_id')
        .range(from, to),
    ),
    fetchAll<BranchRow>(async (from, to) =>
      sb.from('branches').select('id,brand_id').range(from, to),
    ),
    fetchAll<BrandProductRow>(async (from, to) =>
      sb.from('brand_products').select('id,brand_id').range(from, to),
    ),
  ]);

  const branchBrandMap = new Map(branches.map((row) => [row.id, row.brand_id]));
  const templateBrandMap = new Map(
    brandProducts.map((row) => [row.id, row.brand_id]),
  );

  let missingBranch = 0;
  let missingTemplate = 0;
  let brandMismatch = 0;
  let duplicateBranchTemplatePairs = 0;

  const seenBranchTemplate = new Set<string>();

  for (const product of products) {
    if (!product.branch_id || !branchBrandMap.has(product.branch_id)) {
      missingBranch += 1;
      continue;
    }

    if (!product.brand_product_id) continue;

    if (!templateBrandMap.has(product.brand_product_id)) {
      missingTemplate += 1;
      continue;
    }

    const branchBrandId = branchBrandMap.get(product.branch_id) ?? null;
    const templateBrandId =
      templateBrandMap.get(product.brand_product_id) ?? null;
    if (branchBrandId !== templateBrandId) {
      brandMismatch += 1;
    }

    const pairKey = `${product.branch_id}::${product.brand_product_id}`;
    if (seenBranchTemplate.has(pairKey)) {
      duplicateBranchTemplatePairs += 1;
    } else {
      seenBranchTemplate.add(pairKey);
    }
  }

  const totalProducts = products.length;
  const linkedProducts = products.filter((row) =>
    Boolean(row.brand_product_id),
  ).length;
  const unlinkedProducts = totalProducts - linkedProducts;

  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalProducts,
      linkedProducts,
      unlinkedProducts,
      totalBrandProducts: brandProducts.length,
    },
    integrity: {
      missingBranch,
      missingTemplate,
      brandMismatch,
      duplicateBranchTemplatePairs,
    },
  };

  console.log(JSON.stringify(report, null, 2));

  const hasIntegrityIssue =
    unlinkedProducts > 0 ||
    missingBranch > 0 ||
    missingTemplate > 0 ||
    brandMismatch > 0 ||
    duplicateBranchTemplatePairs > 0;

  if (hasIntegrityIssue) {
    process.exitCode = 1;
  }
}

void main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      null,
      2,
    ),
  );
  process.exit(1);
});
