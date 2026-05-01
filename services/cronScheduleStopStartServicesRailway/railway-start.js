const RAILWAY_TOKEN = process.env.RAILWAY_TOKEN;
const SERVICE_IDS = process.env.SERVICE_IDS;
const REPLICAS = parseInt(process.env.REPLICAS || "1", 10);

if (!RAILWAY_TOKEN || !SERVICE_IDS) {
  console.error("Faltando RAILWAY_TOKEN ou SERVICE_IDS");
  process.exit(1);
}

const serviceIds = SERVICE_IDS.split(",").map((id) => id.trim());
const GRAPHQL_ENDPOINT = "https://backboard.railway.app/graphql/v2";

const query = `
  mutation UpdateService($serviceId: String!, $replicas: Int!) {
    serviceInstanceUpdate(serviceId: $serviceId, input: { numReplicas: $replicas })
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
    throw new Error(JSON.stringify(data.errors));
  }

  return data.data.serviceInstanceUpdate;
}

async function main() {
  console.log(`Ligando ${serviceIds.length} serviço(s)...`);

  for (const serviceId of serviceIds) {
    try {
      await updateService(serviceId, REPLICAS);
      console.log(`✔ Serviço ${serviceId} ligado com sucesso`);
    } catch (err) {
      console.error(`✘ Falha ao ligar serviço ${serviceId}:`, err.message);
    }
  }
}

main();