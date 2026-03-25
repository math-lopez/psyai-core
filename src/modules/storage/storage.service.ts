import { FastifyInstance } from "fastify";
import { makeHttpError } from "./storage.utils";
import { sanitizeFileName } from "../../utils/sanitize-file-name";

const BUCKET_NAME = "session-files";

type MultipartFileLike = {
  filename: string;
  mimetype: string;
  toBuffer: () => Promise<Buffer>;
  file?: {
    truncated?: boolean;
  };
};

export class StorageService {
  constructor(private readonly app: FastifyInstance) {}

  async uploadSessionAudio(
    psychologistId: string,
    sessionId: string,
    file: MultipartFileLike
  ): Promise<{ path: string; name: string }> {
    const supabase = this.app.supabase;

    if (!file) {
      throw makeHttpError(400, "Arquivo não enviado");
    }

    if (!file.mimetype?.startsWith("audio/")) {
      throw makeHttpError(400, "Apenas arquivos de áudio são permitidos");
    }

    if (file.file?.truncated) {
      throw makeHttpError(400, "Arquivo excede o tamanho permitido");
    }

    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("id, patient_id, audio_file_path")
      .eq("id", sessionId)
      .eq("psychologist_id", psychologistId)
      .maybeSingle();

    if (sessionError) {
      throw sessionError;
    }

    if (!session) {
      throw makeHttpError(404, "Sessão não encontrada");
    }

    const timestamp = Date.now();
    const sanitizedName = sanitizeFileName(file.filename);
    const filePath = `${psychologistId}/${session.patient_id}/${sessionId}/${timestamp}-${sanitizedName}`;

    const buffer = await file.toBuffer();

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, buffer, {
        contentType: file.mimetype,
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    if (session.audio_file_path) {
      const { error: removeOldError } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([session.audio_file_path]);

      if (removeOldError) {
        this.app.log.warn(
          { error: removeOldError, oldPath: session.audio_file_path },
          "Não foi possível remover o áudio antigo da sessão"
        );
      }
    }

    const { error: updateError } = await supabase
      .from("sessions")
      .update({
        audio_file_name: file.filename,
        audio_file_path: filePath,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId)
      .eq("psychologist_id", psychologistId);

    if (updateError) {
      throw updateError;
    }

    return {
      path: filePath,
      name: file.filename,
    };
  }

  async getSessionAudioSignedUrl(
    psychologistId: string,
    sessionId: string
  ): Promise<{ url: string; path: string; name: string | null }> {
    const supabase = this.app.supabase;

    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("id, audio_file_path, audio_file_name")
      .eq("id", sessionId)
      .eq("psychologist_id", psychologistId)
      .maybeSingle();

    if (sessionError) {
      throw sessionError;
    }

    if (!session) {
      throw makeHttpError(404, "Sessão não encontrada");
    }

    if (!session.audio_file_path) {
      throw makeHttpError(404, "Nenhum áudio associado a esta sessão");
    }

    const { data, error: signedError } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(session.audio_file_path, 3600);

    if (signedError) {
      throw signedError;
    }

    return {
      url: data.signedUrl,
      path: session.audio_file_path,
      name: session.audio_file_name ?? null,
    };
  }

  async deleteSessionAudio(
    psychologistId: string,
    sessionId: string
  ): Promise<{ success: true }> {
    const supabase = this.app.supabase;

    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("id, audio_file_path")
      .eq("id", sessionId)
      .eq("psychologist_id", psychologistId)
      .maybeSingle();

    if (sessionError) {
      throw sessionError;
    }

    if (!session) {
      throw makeHttpError(404, "Sessão não encontrada");
    }

    if (!session.audio_file_path) {
      throw makeHttpError(404, "Nenhum áudio associado à sessão");
    }

    const { error: removeError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([session.audio_file_path]);

    if (removeError) {
      throw removeError;
    }

    const { error: updateError } = await supabase
      .from("sessions")
      .update({
        audio_file_name: null,
        audio_file_path: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId)
      .eq("psychologist_id", psychologistId);

    if (updateError) {
      throw updateError;
    }

    return { success: true };
  }
}