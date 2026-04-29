import { FastifyInstance } from "fastify";
import * as evolution from "./whatsapp.evolution";
import { WhatsappInstance } from "./whatsapp.types";

export class WhatsappService {
  constructor(private readonly fastify: FastifyInstance) {}

  instanceName(psychologistId: string): string {
    return `psyai_${psychologistId.replace(/-/g, "").slice(0, 16)}`;
  }

  async getConnection(psychologistId: string): Promise<WhatsappInstance | null> {
    const { data } = await this.fastify.supabaseAdmin
      .from("whatsapp_instances")
      .select("*")
      .eq("psychologist_id", psychologistId)
      .maybeSingle();
    return data;
  }

  async connect(psychologistId: string, requestUrl: string): Promise<void> {
    const name = this.instanceName(psychologistId);
    const webhookUrl = `${requestUrl}/v1/whatsapp/webhook`;

    try {
      await evolution.createInstance(name, webhookUrl);
    } catch (e: any) {
      if (!e.message?.includes("already") && !e.message?.includes("exists") && !e.message?.includes("409")) {
        throw e;
      }
      // Instância já existe — faz restart para o Baileys reiniciar e gerar novo QR
      await evolution.restartInstance(name);
    }

    await this.fastify.supabaseAdmin
      .from("whatsapp_instances")
      .upsert(
        {
          psychologist_id: psychologistId,
          instance_name: name,
          connected: false,
          qr_code: null,
          qr_updated_at: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "psychologist_id" },
      );
  }

  async getQR(psychologistId: string): Promise<{ qr_code: string | null; connected: boolean }> {
    const record = await this.getConnection(psychologistId);
    return {
      qr_code: record?.qr_code ?? null,
      connected: record?.connected ?? false,
    };
  }

  // Chamado pelo webhook da Evolution API
  async handleWebhook(instanceName: string, event: string, data: any): Promise<void> {
    if (event === "QRCODE_UPDATED") {
      const qrBase64 = data?.qrcode?.base64 ?? null;
      if (!qrBase64) return;

      await this.fastify.supabaseAdmin
        .from("whatsapp_instances")
        .update({
          qr_code: qrBase64,
          qr_updated_at: new Date().toISOString(),
          connected: false,
          updated_at: new Date().toISOString(),
        })
        .eq("instance_name", instanceName);
    }

    if (event === "CONNECTION_UPDATE") {
      const state = data?.state;
      const connected = state === "open";

      await this.fastify.supabaseAdmin
        .from("whatsapp_instances")
        .update({
          connected,
          qr_code: connected ? null : undefined, // limpa o QR ao conectar
          connected_at: connected ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("instance_name", instanceName);
    }
  }

  async syncStatus(psychologistId: string): Promise<WhatsappInstance | null> {
    const record = await this.getConnection(psychologistId);
    if (!record) return null;

    try {
      const status = await evolution.getInstanceStatus(record.instance_name);
      const connected = status.instance.state === "open";

      const { data } = await this.fastify.supabaseAdmin
        .from("whatsapp_instances")
        .update({
          connected,
          connected_at: connected ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("psychologist_id", psychologistId)
        .select("*")
        .single();

      return data;
    } catch {
      return record;
    }
  }

  async disconnect(psychologistId: string): Promise<void> {
    const record = await this.getConnection(psychologistId);
    if (!record) return;

    try {
      await evolution.deleteInstance(record.instance_name);
    } catch {}

    await this.fastify.supabaseAdmin
      .from("whatsapp_instances")
      .delete()
      .eq("psychologist_id", psychologistId);
  }

  async sendSessionReminder(params: {
    psychologistId: string;
    patientName: string;
    patientPhone: string;
    sessionDate: Date;
  }): Promise<void> {
    const record = await this.getConnection(params.psychologistId);
    if (!record?.connected) throw new Error("WhatsApp não conectado");

    const hora = params.sessionDate.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    });

    const text =
      `Olá ${params.patientName}! 👋\n\n` +
      `Este é um lembrete da sua sessão *amanhã às ${hora}*.\n\n` +
      `Qualquer dúvida, pode responder esta mensagem. Até lá! 🌿`;

    await evolution.sendTextMessage(record.instance_name, params.patientPhone, text);
  }
}
