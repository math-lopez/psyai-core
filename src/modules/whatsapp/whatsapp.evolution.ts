const getBaseUrl = () => process.env.EVOLUTION_API_URL ?? "";
const getApiKey = () => process.env.EVOLUTION_API_KEY ?? "";
const getWebhookUrl = () => `${process.env.PUBLIC_API_URL ?? ""}/v1/whatsapp/webhook`;

const headers = () => ({
  "Content-Type": "application/json",
  apikey: getApiKey(),
});

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const baseUrl = getBaseUrl();
  if (!baseUrl) throw new Error("EVOLUTION_API_URL não configurada");

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Evolution API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function createInstance(instanceName: string): Promise<void> {
  const webhookUrl = getWebhookUrl();

  await request("POST", "/instance/create", {
    instanceName,
    qrcode: true,
    integration: "WHATSAPP-BAILEYS",
    // Configura webhook para receber QR e eventos de conexão
    webhook: {
      url: webhookUrl,
      byEvents: true,
      base64: true,
      events: ["QRCODE_UPDATED", "CONNECTION_UPDATE"],
    },
  });
}

export async function deleteInstance(instanceName: string): Promise<void> {
  await request("DELETE", `/instance/delete/${instanceName}`);
}

export async function getInstanceStatus(instanceName: string): Promise<{ instance: { instanceName: string; state: string } }> {
  return request("GET", `/instance/connectionState/${instanceName}`);
}

export async function sendTextMessage(instanceName: string, phone: string, text: string): Promise<void> {
  const normalized = phone.replace(/\D/g, "");
  await request("POST", `/message/sendText/${instanceName}`, {
    number: normalized,
    text,
  });
}
