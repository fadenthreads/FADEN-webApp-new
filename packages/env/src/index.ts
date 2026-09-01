import { z } from "zod";

const publicEnvironmentSchema = z.object({
  NEXT_PUBLIC_APP_ENV: z
    .enum(["development", "preview", "staging", "production"])
    .default("development"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().default("http://127.0.0.1:54321"),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .min(1)
    .default("local-development-key"),
});

export type PublicEnvironment = z.infer<typeof publicEnvironmentSchema>;

export function getPublicEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): PublicEnvironment {
  return publicEnvironmentSchema.parse(source);
}
