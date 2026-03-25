import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3333),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  SUPABASE_URL: z.url("SUPABASE_URL inválida"),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, "SUPABASE_SERVICE_ROLE_KEY é obrigatória"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Erro ao validar variáveis de ambiente:");
  console.error(parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;