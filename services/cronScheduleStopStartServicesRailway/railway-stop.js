// railway-stop.js

const RAILWAY_TOKEN = process.env.RAILWAY_TOKEN;
const SERVICE_IDS = process.env.SERVICE_IDS; // ex: "id1,id2"

if (!RAILWAY_TOKEN || !SERVICE_IDS) {
  console.error("Faltando RAILWAY_TOKEN ou SERVICE_IDS nas variáveis de ambiente");
  process.exit(1);
}

const serviceIds = SERVICE_IDS.split(",").map((id) => id.trim());

const GRAPHQL_ENDPOINT = "https://backboard.railway.app/graphql/v2";

const query = `
  mutation UpdateService($serviceId: String!, $replicas: Int!) {
    serviceInstanceUpdate(id: $serviceId, input: { numReplicas: $replicas }) {
      id
      numReplicas
    }
  }
`;

async function updateService(serviceId, replicas) {
  const res = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RAILWAY_TOKEN}`,
    },
    body: JSON.stringify({
      query,
      variables: { serviceId, replicas },
    }),
  });

  const data = await res.json();

  if (data.errors) {
    throw new Error(`Erro no serviço ${serviceId}: ${JSON.stringify(data.errors)}`);
  }

  return data.data.serviceInstanceUpdate;
}

async function main() {
  console.log(`Desligando ${serviceIds.length} serviço(s)...`);

  for (const serviceId of serviceIds) {
    try {
      const result = await updateService(serviceId, 0);
      console.log(`✔ Serviço ${serviceId} desligado — replicas: ${result.numReplicas}`);
    } catch (err) {
      console.error(`✘ Falha ao desligar serviço ${serviceId}:`, err.message);
    }
  }
}

main();