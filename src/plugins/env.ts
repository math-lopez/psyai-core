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

  // Schedules dos cron jobs (padrão cron, timezone America/Sao_Paulo)
  CRON_RUN_TRANSFERS_SCHEDULE: z.string().default("0 8 * * *"),
  CRON_TEST_SCHEDULE: z.string().default("0 8 * * *"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("=== ERRO: Variáveis de ambiente inválidas ===");
  console.error(parsed.error.format());
  console.error("Verifique se SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY estão configuradas no Railway.");
  process.exit(1);
}

export const env = parsed.data;
