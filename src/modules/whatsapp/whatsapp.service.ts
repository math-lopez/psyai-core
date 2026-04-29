import { FastifyInstance } from "fastify";
import * as evolution from "./whatsapp.evolution";
import { WhatsappInstance } from "./whatsapp.types";

export class WhatsappService {
  constructor(private readonly fastify: FastifyInstance) {}

  private instanceName(psychologistId: string): string {
    // Nome único e estável por psicólogo
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

  async connect(psychologistId: string): Promise<{ base64: string; code: string }> {
    const name = this.instanceName(psychologistId);

    const qr = await evolution.createOrGetQR(name);

    // Persiste o registro no banco
    await this.fastify.supabaseAdmin
      .from("whatsapp_instances")
      .upsert(
        {
          psychologist_id: psychologistId,
          instance_name: name,
          connected: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "psychologist_id" },
      );

    return qr;
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
    } catch {
      // Ignora se já não existe na Evolution API
    }

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
    if (!record?.connected) {
      throw new Error("WhatsApp não conectado para este psicólogo");
    }

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
