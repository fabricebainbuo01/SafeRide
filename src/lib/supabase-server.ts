import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export const createServerClient = async () => {
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
      },
      global: {
        headers: {
          cookie: allCookies.map((c) => `${c.name}=${c.value}`).join("; "),
        },
      },
    }
  );
};
