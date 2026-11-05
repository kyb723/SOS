import { redirect } from "next/navigation";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import ConnectedSchedule from "./workspace";
export default async function Team() {
  if (!supabaseConfigured()) redirect("/login");
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) redirect("/login");
  return <ConnectedSchedule />;
}
