import "server-only";
import { publicSupabaseConfig, sharedWorkspaceEnabled } from "./config";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
export function supabaseConfigured() {
  return (
    sharedWorkspaceEnabled(process.env.SOS_SHARED_ENABLED) &&
    !!(
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    )
  );
}
export async function createClient() {
  if (!supabaseConfigured())
    throw new Error("Supabase is not configured. See docs/VERSION_5.md.");
  const config = publicSupabaseConfig(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
  const store = await cookies();
  return createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (values) => {
        try {
          values.forEach(({ name, value, options }) =>
            store.set(name, value, options),
          );
        } catch {
          /* Server Components cannot write cookies; proxy refreshes them. */
        }
      },
    },
  });
}
