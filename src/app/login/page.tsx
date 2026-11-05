import Link from "next/link";
import { signIn } from "./actions";
import { supabaseConfigured } from "@/lib/supabase/server";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="auth-page">
      <Link href="/" className="brand">
        SOS.
      </Link>
      <h1>Team sign in</h1>
      <p>Invitation-only café workspace. Your demo remains separate.</p>
      {!supabaseConfigured() ? (
        <p role="status">
          The shared workspace is not configured yet. Follow docs/VERSION_5.md.{" "}
          <Link href="/">Open local demo</Link>
        </p>
      ) : (
        <form action={signIn}>
          <label>
            Email
            <input name="email" type="email" required autoComplete="username" />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </label>
          {params.error && (
            <p role="alert" className="error">
              Unable to sign in. Check your credentials or contact your manager.
            </p>
          )}
          <button className="primary" type="submit">
            Sign in
          </button>
        </form>
      )}
      <p>
        No public sign-up. Ask your organisation administrator for an
        invitation.
      </p>
    </main>
  );
}
