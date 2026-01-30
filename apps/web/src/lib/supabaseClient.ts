import { supabaseBrowser } from "./supabase/client";

/**
 * Legacy export (keep temporarily to avoid breaking existing imports)
 */
export const supabase = supabaseBrowser;

/**
 * Legacy factory (kept for backward compatibility)
 * IMPORTANT: returns the singleton instance (no re-creation)
 */
export const createClient = () => supabaseBrowser;

/**
 * @deprecated
 * Legacy compatibility layer.
 * Do NOT use in new code. Use:
 *   import { supabaseBrowser } from "@/lib/supabase/client"
 */