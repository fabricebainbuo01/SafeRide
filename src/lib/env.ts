import { z } from "zod";

/**
 * Centralised, fail-fast environment variable validation.
 *
 * Server modules import { env } and get a typed object.
 * Client code should import { publicEnv } only — server-only secrets are
 * stripped at build time by Next.js.
 */

const PublicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(20, "NEXT_PUBLIC_SUPABASE_ANON_KEY looks too short"),
});

const ServerSchema = PublicSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
});

const rawPublic = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
};

const isServer = typeof window === "undefined";

function formatErrors(error: z.ZodError): string {
  return error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
}

const publicResult = PublicSchema.safeParse(rawPublic);

if (!publicResult.success) {
  const message =
    "Invalid public environment variables:\n" +
    formatErrors(publicResult.error) +
    "\n\nCopy .env.example to .env.local and fill in the values.";

  if (isServer) {
    // Fail fast on the server so misconfigured deploys don't boot.
    throw new Error(message);
  } else {
    // On the client, log loudly but don't crash the bundle.
    console.error(message);
  }
}

export const publicEnv = publicResult.success ? publicResult.data : rawPublic;

export const env = isServer
  ? ServerSchema.parse({
      ...rawPublic,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    })
  : (publicEnv as z.infer<typeof ServerSchema>);

export const hasSupabaseConfig = publicResult.success;
