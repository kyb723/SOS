import { redirect } from "next/navigation";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import { setPassword } from "../login/actions";
export default async function Account({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (!supabaseConfigured()) redirect("/login");
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) redirect("/login");
  return (
    <main className="auth-page">
      <h1>Set your password</h1>
      <p>
        Use at least 12 characters. Never share this password with your manager.
      </p>
      <form action={setPassword}>
        <label>
          New password
          <input
            type="password"
            name="password"
            minLength={12}
            required
            autoComplete="new-password"
          />
        </label>
        {(await searchParams).error && (
          <p className="error" role="alert">
            Password could not be saved. Try a stronger password or request a
            new invitation.
          </p>
        )}
        <button className="primary">Save password</button>
      </form>
    </main>
  );
}
