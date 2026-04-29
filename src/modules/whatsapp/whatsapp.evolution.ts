// Cliente para a Evolution API — lê env vars em runtime para garantir que o dotenv já carregou
const getBaseUrl = () => process.env.EVOLUTION_API_URL ?? "";
const getApiKey = () => process.env.EVOLUTION_API_KEY ?? "";

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

export async function createOrGetQR(instanceName: string): Promise<{ base64: string; code: string }> {
  try {
    const created = await request<any>("POST", "/instance/create", {
      instanceName,
      qrcode: true,
      integration: "WHATSAPP-BAILEYS",
    });
    console.log("[evolution] create response:", JSON.stringify(created));
    if (created?.qrcode?.base64) {
      return { base64: created.qrcode.base64, code: created.qrcode.code };
    }
  } catch (e: any) {
    console.log("[evolution] create error (instância já existe?):", e.message);
  }

  const qr = await request<any>("GET", `/instance/connect/${instanceName}`);
  console.log("[evolution] connect response:", JSON.stringify(qr));
  if (qr?.base64) return { base64: qr.base64, code: qr.code ?? "" };

  throw new Error("Não foi possível gerar o QR Code. Tente novamente.");
}

export async function getInstanceStatus(instanceName: string): Promise<{ instance: { instanceName: string; state: string } }> {
  return request("GET", `/instance/connectionState/${instanceName}`);
}

export async function deleteInstance(instanceName: string): Promise<void> {
  await request("DELETE", `/instance/delete/${instanceName}`);
}

export async function sendTextMessage(instanceName: string, phone: string, text: string): Promise<void> {
  // A Evolution API espera o número no formato: 5511999999999 (sem + e sem caracteres especiais)
  const normalized = phone.replace(/\D/g, "");
  await request("POST", `/message/sendText/${instanceName}`, {
    number: normalized,
    text,
  });
}
