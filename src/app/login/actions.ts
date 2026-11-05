"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
export async function signIn(form: FormData) {
  const client = await createClient();
  const { error } = await client.auth.signInWithPassword({
    email: String(form.get("email") ?? ""),
    password: String(form.get("password") ?? ""),
  });
  if (error) redirect("/login?error=login");
  redirect("/team");
}
export async function signOut() {
  const client = await createClient();
  await client.auth.signOut();
  redirect("/login");
}
export async function setPassword(form: FormData) {
  const password = String(form.get("password") ?? "");
  if (password.length < 12) redirect("/account?error=password");
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) redirect("/login");
  const { error } = await client.auth.updateUser({ password });
  if (error) redirect("/account?error=password");
  redirect("/team");
}
