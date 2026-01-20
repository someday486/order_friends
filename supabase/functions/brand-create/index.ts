// supabase/functions/brand-create/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type CreateBrandRequest = {
  name: string;
  biz_name?: string | null;
  biz_reg_no?: string | null;
};

type CreateBrandResponse =
  | { ok: true; brand: { id: string; name: string; owner_user_id: string } }
  | { ok: false; error: { code: string; message: string } };

function json(status: number, body: CreateBrandResponse) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      // CORS 필요하면 아래 헤더 추가(프로젝트 정책에 맞게)
      // "Access-Control-Allow-Origin": "*",
      // "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    },
  });
}

Deno.serve(async (req) => {
  // Method guard
  if (req.method !== "POST") {
    return json(405, {
      ok: false,
      error: { code: "METHOD_NOT_ALLOWED", message: "Use POST." },
    });
  }

  // 1) ENV
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json(500, {
      ok: false,
      error: { code: "ENV_MISSING", message: "Missing Supabase env vars." },
    });
  }

  // 2) Parse body
  let payload: CreateBrandRequest;
  try {
    payload = await req.json();
  } catch {
    return json(400, {
      ok: false,
      error: { code: "BAD_JSON", message: "Invalid JSON body." },
    });
  }

  const name = (payload.name ?? "").trim();
  if (!name) {
    return json(400, {
      ok: false,
      error: { code: "VALIDATION", message: "name is required." },
    });
  }

  // 3) Identify user (JWT validation via anon client)
  // - 익명키 + Authorization 헤더로 auth.getUser() 호출
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user?.id) {
    return json(401, {
      ok: false,
      error: { code: "UNAUTHENTICATED", message: "Invalid or missing JWT." },
    });
  }

  const userId = userData.user.id;

  // 4) Privileged DB ops (service role client)
  // - RLS 우회가 필요하므로 service role 사용
  const admin = createClient(supabaseUrl, serviceRoleKey);

  // 5) Create brand → create brand_members(OWNER/ACTIVE)
  // 주의: Supabase JS로는 트랜잭션을 직접 묶기 어렵기 때문에
  // 실패 시 롤백(브랜드 삭제) 보정 로직을 둠.
  const { data: brand, error: brandErr } = await admin
    .from("brands")
    .insert({
      name,
      owner_user_id: userId,
      biz_name: payload.biz_name ?? null,
      biz_reg_no: payload.biz_reg_no ?? null,
    })
    .select("id,name,owner_user_id")
    .single();

  if (brandErr || !brand) {
    return json(500, {
      ok: false,
      error: {
        code: "BRAND_CREATE_FAILED",
        message: brandErr?.message ?? "Failed to create brand.",
      },
    });
  }

  const { error: memberErr } = await admin.from("brand_members").insert({
    brand_id: brand.id,
    user_id: userId,
    role: "OWNER",
    status: "ACTIVE",
  });

  if (memberErr) {
    // 보정: brand_members 생성 실패 시 브랜드 제거 시도
    await admin.from("brands").delete().eq("id", brand.id);
    return json(500, {
      ok: false,
      error: {
        code: "OWNER_ASSIGN_FAILED",
        message:
          "Brand created but failed to assign OWNER. Rolled back brand creation.",
      },
    });
  }

  return json(200, { ok: true, brand });
});
