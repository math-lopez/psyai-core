import { buildApp } from "./app";
import { env } from "./plugins/env";

async function bootstrap() {
  const app = await buildApp();

  try {
    await app.listen({
      port: env.PORT,
      host: "0.0.0.0",
    });

    app.log.info(`Servidor rodando na porta ${env.PORT}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

bootstrap();