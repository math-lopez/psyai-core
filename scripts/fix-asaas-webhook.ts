/// <reference types="node" />
import 'dotenv/config';
import * as readline from 'readline';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

const ask = (question: string): Promise<string> =>
  new Promise((resolve) => rl.question(question, (answer: string) => resolve(answer.trim())));

async function asaasGet(base: string, key: string, path: string) {
  const res = await fetch(`${base}${path}`, {
    headers: { 'access_token': key },
  });
  return res.json() as Promise<any>;
}

async function asaasPut(base: string, key: string, path: string, body: object) {
  const res = await fetch(`${base}${path}`, {
    method: 'PUT',
    headers: { 'access_token': key, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<any>;
}

async function main() {
  console.log('\n🔧  Fix Asaas Webhook\n');

  // Ambiente
  const envInput = await ask('Ambiente? (1) Produção  (2) Sandbox  [padrão: 1]: ');
  const isProd   = envInput !== '2';
  const base     = isProd
    ? 'https://api.asaas.com/v3'
    : 'https://sandbox.asaas.com/api/v3';
  console.log(`→ ${isProd ? 'Produção' : 'Sandbox'}\n`);

  // Master key
  const envKey    = process.env.ASAAS_MASTER_KEY ?? '';
  const masterKey = envKey
    ? (await ask(`Master key [Enter para usar a do .env]: `)) || envKey
    : await ask('Master key (começa com $aact_...): ');

  if (!masterKey) {
    console.error('❌  Master key não informada.');
    rl.close();
    process.exit(1);
  }

  // Busca webhooks
  console.log('\n🔍  Buscando webhooks...\n');
  const data = await asaasGet(base, masterKey, '/webhooks');
  const webhooks: any[] = data?.data ?? [];

  if (!webhooks.length) {
    console.log('Nenhum webhook encontrado.');
    rl.close();
    return;
  }

  // Lista
  webhooks.forEach((wh, i) => {
    const status = wh.interrupted ? '🔴 Interrompido' : wh.enabled ? '🟢 Ativo' : '⚫ Desativado';
    console.log(`  [${i + 1}] ${status}  ${wh.name}  →  ${wh.url}`);
  });

  const interrupted = webhooks.filter((wh) => wh.interrupted);

  if (!interrupted.length) {
    console.log('\n✅  Nenhum webhook interrompido. Tudo certo!\n');
    rl.close();
    return;
  }

  // Confirma reativação
  console.log(`\n⚠️   ${interrupted.length} webhook(s) interrompido(s) encontrado(s).`);
  const confirm = await ask('Reativar todos? (s/n): ');

  if (confirm.toLowerCase() !== 's') {
    console.log('Cancelado.');
    rl.close();
    return;
  }

  // Reativa
  for (const wh of interrupted) {
    console.log(`\n  ↳ Reativando "${wh.name}" (${wh.id})...`);
    const result = await asaasPut(base, masterKey, `/webhooks/${wh.id}`, { interrupted: false });

    if (result.interrupted === false) {
      console.log(`  ✅  Reativado com sucesso!`);
    } else {
      console.log(`  ⚠️   Resposta inesperada:`, JSON.stringify(result));
    }
  }

  console.log('\n✔  Concluído.\n');
  rl.close();
}

main().catch((err) => {
  console.error('Erro:', err);
  rl.close();
  process.exit(1);
});
