import { NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";
const localRedirect = (path: string) =>
  new NextResponse(null, { status: 303, headers: { Location: path } });
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  if (!supabaseConfigured()) return localRedirect("/login");
  if (token && type && ["invite", "recovery", "email"].includes(type)) {
    const client = await createClient();
    const { error } = await client.auth.verifyOtp({
      token_hash: token,
      type: type as EmailOtpType,
    });
    if (!error) return localRedirect("/account");
  }
  return localRedirect("/login?error=invite");
}
