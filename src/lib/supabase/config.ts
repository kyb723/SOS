export function publicSupabaseConfig(
  url: string | undefined,
  key: string | undefined,
) {
  if (!url || !key)
    throw new Error("Supabase URL and publishable key are required.");
  const parsed = new URL(url);
  if (
    parsed.protocol !== "https:" &&
    !["localhost", "127.0.0.1"].includes(parsed.hostname)
  )
    throw new Error("Use an HTTPS Supabase URL.");
  let privileged = key.startsWith("sb_secret_");
  if (key.split(".").length === 3) {
    try {
      const payload = JSON.parse(
        atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
      );
      privileged ||= payload.role === "service_role";
    } catch {
      /* The Supabase API validates malformed public credentials. */
    }
  }
  if (privileged)
    throw new Error(
      "Use the public publishable/anon key, never a service-role or secret key.",
    );
  return { url: parsed.origin, key };
}

export function sharedWorkspaceEnabled(value: string | undefined) {
  return value === "true";
}
