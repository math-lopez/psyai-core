const RAILWAY_TOKEN = process.env.RAILWAY_TOKEN;
const SERVICE_IDS = process.env.SERVICE_IDS;
const ENVIRONMENT_ID = process.env.ENVIRONMENT_ID;

if (!RAILWAY_TOKEN || !SERVICE_IDS || !ENVIRONMENT_ID) {
  console.error("Faltando RAILWAY_TOKEN, SERVICE_IDS ou ENVIRONMENT_ID");
  process.exit(1);
}

const serviceIds = SERVICE_IDS.split(",").map((id) => id.trim());
const GRAPHQL_ENDPOINT = "https://backboard.railway.app/graphql/v2";

const query = `
  mutation UpdateService($serviceId: String!, $environmentId: String!, $replicas: Int!) {
    serviceInstanceUpdate(
      serviceId: $serviceId,
      environmentId: $environmentId,
      input: { numReplicas: $replicas }
    )
  }
`;

async function updateService(serviceId, environmentId, replicas) {
  const res = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RAILWAY_TOKEN}`,
    },
    body: JSON.stringify({
      query,
      variables: { serviceId, environmentId, replicas },
    }),
  });

  const data = await res.json();

  if (data.errors) {
    throw new Error(JSON.stringify(data.errors));
  }

  return data.data.serviceInstanceUpdate;
}

async function main() {
  console.log(`Desligando ${serviceIds.length} serviço(s)...`);

  for (const serviceId of serviceIds) {
    try {
      await updateService(serviceId, ENVIRONMENT_ID, 0);
      console.log(`✔ Serviço ${serviceId} desligado com sucesso`);
    } catch (err) {
      console.error(`✘ Falha ao desligar serviço ${serviceId}:`, err.message);
    }
  }
}

main();