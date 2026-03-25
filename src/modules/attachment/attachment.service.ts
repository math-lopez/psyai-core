import crypto from "node:crypto";
import path from "node:path";
import { FastifyInstance } from "fastify";
import { sanitizeFileName } from "../../utils/sanitize-file-name";
import { AttachmentRepository } from "./attachment.repository";
import {
  AttachmentVisibility,
  PatientAttachment,
  SignedDownloadUrlResponse,
  UploadAttachmentInput,
} from "./attachment.types";

const BUCKET_NAME = "patient-attachments";
const SIGNED_URL_EXPIRES_IN_SECONDS = 60 * 60;

export class AttachmentService {
  private readonly repository: AttachmentRepository;

  constructor(private readonly fastify: FastifyInstance) {
    this.repository = new AttachmentRepository(fastify.supabaseAdmin);
  }

  private get maxFileSizeBytes(): number {
    const maxMb = Number(process.env.PATIENT_ATTACHMENT_MAX_MB ?? "20");
    return maxMb * 1024 * 1024;
  }

  private async assertPatientOwnership(
    patientId: string,
    psychologistId: string,
  ): Promise<void> {
    const patient = await this.repository.findOwnedPatientById(
      patientId,
      psychologistId,
    );

    if (!patient) {
      throw this.fastify.httpErrors.notFound(
        "Paciente não encontrado para o psicólogo autenticado",
      );
    }
  }

  private buildFilePath(params: {
    psychologistId: string;
    patientId: string;
    originalFileName: string;
  }): string {
    const sanitizedName = sanitizeFileName(params.originalFileName);
    const timestamp = Date.now();
    const randomSuffix = crypto.randomBytes(6).toString("hex");
    const ext = path.extname(sanitizedName);
    const base = path.basename(sanitizedName, ext);

    const safeFileName = ext
      ? `${base}-${timestamp}-${randomSuffix}${ext}`
      : `${base}-${timestamp}-${randomSuffix}`;

    return `${params.psychologistId}/${params.patientId}/anexos/${safeFileName}`;
  }

  private validateUploadInput(input: UploadAttachmentInput): void {
    if (!input.fileName?.trim()) {
      throw this.fastify.httpErrors.badRequest("Nome do arquivo é obrigatório");
    }

    if (!input.contentType?.trim()) {
      throw this.fastify.httpErrors.badRequest(
        "Content-Type do arquivo é obrigatório",
      );
    }

    if (!input.fileSize || input.fileSize <= 0) {
      throw this.fastify.httpErrors.badRequest("Arquivo vazio");
    }

    if (input.fileSize > this.maxFileSizeBytes) {
      throw this.fastify.httpErrors.badRequest(
        `Arquivo excede o limite de ${Math.round(
          this.maxFileSizeBytes / (1024 * 1024),
        )} MB`,
      );
    }
  }

  async list(
    patientId: string,
    psychologistId: string,
  ): Promise<PatientAttachment[]> {
    await this.assertPatientOwnership(patientId, psychologistId);

    return this.repository.listByPatientId(patientId, psychologistId);
  }

  async upload(input: UploadAttachmentInput): Promise<PatientAttachment> {
    await this.assertPatientOwnership(input.patientId, input.psychologistId);
    this.validateUploadInput(input);

    const filePath = this.buildFilePath({
      psychologistId: input.psychologistId,
      patientId: input.patientId,
      originalFileName: input.fileName,
    });

    const now = new Date().toISOString();

    const { error: uploadError } = await this.fastify.supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(filePath, input.buffer, {
        contentType: input.contentType,
        upsert: false,
      });

    if (uploadError) {
      this.fastify.log.error(
        { uploadError, filePath, patientId: input.patientId },
        "[attachments] erro no upload para o storage",
      );

      throw this.fastify.httpErrors.badRequest(
        `Erro no upload do arquivo: ${uploadError.message}`,
      );
    }

    try {
      const created = await this.repository.create({
        patientId: input.patientId,
        psychologistId: input.psychologistId,
        fileName: input.fileName,
        filePath,
        fileSize: input.fileSize,
        fileType: input.contentType,
        visibility: input.visibility,
        now,
      });

      return created;
    } catch (error) {
      this.fastify.log.error(
        { error, filePath, patientId: input.patientId },
        "[attachments] erro ao persistir metadata do anexo; removendo arquivo do storage",
      );

      await this.fastify.supabaseAdmin.storage
        .from(BUCKET_NAME)
        .remove([filePath]);

      throw error;
    }
  }

  async delete(params: {
    patientId: string;
    psychologistId: string;
    attachmentId: string;
  }): Promise<void> {
    await this.assertPatientOwnership(params.patientId, params.psychologistId);

    const attachment = await this.repository.findById({
      attachmentId: params.attachmentId,
      patientId: params.patientId,
      psychologistId: params.psychologistId,
    });

    if (!attachment) {
      throw this.fastify.httpErrors.notFound("Anexo não encontrado");
    }

    const { error: storageError } = await this.fastify.supabaseAdmin.storage
      .from(BUCKET_NAME)
      .remove([attachment.file_path]);

    if (storageError) {
      this.fastify.log.error(
        { storageError, attachmentId: params.attachmentId },
        "[attachments] erro ao remover anexo do storage",
      );

      throw this.fastify.httpErrors.badRequest(
        `Erro ao remover arquivo do storage: ${storageError.message}`,
      );
    }

    await this.repository.deleteById({
      attachmentId: params.attachmentId,
      patientId: params.patientId,
      psychologistId: params.psychologistId,
    });
  }

  async getDownloadUrl(params: {
    patientId: string;
    psychologistId: string;
    attachmentId: string;
  }): Promise<SignedDownloadUrlResponse> {
    await this.assertPatientOwnership(params.patientId, params.psychologistId);

    const attachment = await this.repository.findById({
      attachmentId: params.attachmentId,
      patientId: params.patientId,
      psychologistId: params.psychologistId,
    });

    if (!attachment) {
      throw this.fastify.httpErrors.notFound("Anexo não encontrado");
    }

    const { data, error } = await this.fastify.supabaseAdmin.storage
      .from(BUCKET_NAME)
      .createSignedUrl(
        attachment.file_path,
        SIGNED_URL_EXPIRES_IN_SECONDS,
        {
          download: attachment.file_name,
        },
      );

    if (error || !data?.signedUrl) {
      throw this.fastify.httpErrors.badRequest(
        `Erro ao gerar URL assinada: ${error?.message ?? "desconhecido"}`,
      );
    }

    return {
      signedUrl: data.signedUrl,
      expiresIn: SIGNED_URL_EXPIRES_IN_SECONDS,
    };
  }

  async getById(params: {
    patientId: string;
    psychologistId: string;
    attachmentId: string;
  }): Promise<PatientAttachment> {
    await this.assertPatientOwnership(params.patientId, params.psychologistId);

    const attachment = await this.repository.findById({
      attachmentId: params.attachmentId,
      patientId: params.patientId,
      psychologistId: params.psychologistId,
    });

    if (!attachment) {
      throw this.fastify.httpErrors.notFound("Anexo não encontrado");
    }

    return attachment;
  }
}