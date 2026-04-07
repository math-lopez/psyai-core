import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { generateToken } from './livekit.service';

function makeHttpError(statusCode: number, message: string) {
  const err = new Error(message) as Error & { statusCode?: number };
  err.statusCode = statusCode;
  return err;
}

const startSessionSchema = z.object({
  sessionId: z.string().uuid('sessionId inválido'),
});

const tokenQuerySchema = z.object({
  role: z.enum(['psychologist', 'patient']),
});

export default async function livekitRoutes(app: FastifyInstance) {
  // POST /v1/livekit/start
  app.post('/v1/livekit/start', { preHandler: [app.authenticate] }, async (request: any) => {
    const parsed = startSessionSchema.safeParse(request.body);

    if (!parsed.success) {
      throw makeHttpError(400, 'Dados inválidos');
    }

    const { sessionId } = parsed.data;
    const psychologistId = request.authUser.id;
    const serverUrl = process.env.LIVEKIT_URL;

    if (!serverUrl) {
      throw makeHttpError(500, 'LIVEKIT_URL não configurado');
    }

    const frontendUrl = process.env.FRONTEND_URL;
    if (!frontendUrl) {
      throw makeHttpError(500, 'FRONTEND_URL não configurado');
    }

    // Busca sessão verificando que pertence ao psicólogo autenticado
    const { data: session, error: sessionError } = await app.supabase
      .from('sessions')
      .select('id, patient_id, psychologist_id')
      .eq('id', sessionId)
      .eq('psychologist_id', psychologistId)
      .maybeSingle();

    if (sessionError || !session) {
      throw makeHttpError(404, 'Sessão não encontrada');
    }

    // Busca dados do paciente e do psicólogo
    const [{ data: patient }, { data: profile }] = await Promise.all([
      app.supabase
        .from('patients')
        .select('full_name, email')
        .eq('id', session.patient_id)
        .maybeSingle(),
      app.supabase
        .from('profiles')
        .select('full_name')
        .eq('id', psychologistId)
        .maybeSingle(),
    ]);

    const roomName = `session-${sessionId}`;
    const [psychologistToken, patientToken] = await Promise.all([
      generateToken(roomName, psychologistId),
      generateToken(roomName, session.patient_id),
    ]);
    const patientJoinUrl = `${frontendUrl}/session/${sessionId}?role=patient`;

    // Atualiza a sessão com os dados LiveKit
    const { error: updateError } = await app.supabase
      .from('sessions')
      .update({
        livekit_room_name: roomName,
        livekit_psychologist_token: psychologistToken,
        livekit_patient_token: patientToken,
        meeting_link: patientJoinUrl,
        video_status: 'waiting',
      })
      .eq('id', sessionId);

    if (updateError) {
      throw makeHttpError(500, 'Erro ao atualizar sessão com dados LiveKit');
    }

    // Notifica o paciente via Edge Function (não bloqueia a resposta em caso de falha)
    if (patient && profile) {
      app.supabase.functions.invoke('notify-patient-session', {
        body: {
          patientEmail: patient.email,
          patientName: patient.full_name,
          psychologistName: profile.full_name,
          sessionId,
          joinUrl: patientJoinUrl,
        },
      }).catch((err: Error) => {
        app.log.warn({ err }, 'Falha ao invocar notify-patient-session');
      });
    }

    return { roomName, token: psychologistToken, serverUrl };
  });

  // GET /v1/livekit/token/:sessionId
  app.get('/v1/livekit/token/:sessionId', { preHandler: [app.authenticate] }, async (request: any) => {
    const { sessionId } = request.params;
    const serverUrl = process.env.LIVEKIT_URL;

    const queryParsed = tokenQuerySchema.safeParse(request.query);
    if (!queryParsed.success) {
      throw makeHttpError(400, 'role deve ser "psychologist" ou "patient"');
    }

    const { role } = queryParsed.data;

    const { data: session, error } = await app.supabase
      .from('sessions')
      .select('livekit_room_name, livekit_psychologist_token, livekit_patient_token')
      .eq('id', sessionId)
      .maybeSingle();

    if (error || !session) {
      throw makeHttpError(404, 'Sessão não encontrada');
    }

    const token = role === 'psychologist'
      ? session.livekit_psychologist_token
      : session.livekit_patient_token;

    return { token, roomName: session.livekit_room_name, serverUrl };
  });

  // GET /v1/livekit/join/:sessionId — público, sem autenticação (acesso pelo link do paciente)
  app.get('/v1/livekit/join/:sessionId', async (request: any, reply) => {
    const { sessionId } = request.params;
    const serverUrl = process.env.LIVEKIT_URL;

    const { data: session, error } = await app.supabase
      .from('sessions')
      .select('livekit_patient_token, livekit_room_name, video_status')
      .eq('id', sessionId)
      .maybeSingle();

    if (error || !session) {
      return reply.status(404).send({ message: 'Sessão não encontrada' });
    }

    if (!session.livekit_patient_token) {
      return reply.status(400).send({ message: 'Sessão de vídeo ainda não foi iniciada pelo psicólogo' });
    }

    return { token: session.livekit_patient_token, roomName: session.livekit_room_name, serverUrl };
  });

  // PATCH /v1/livekit/end/:sessionId
  app.patch('/v1/livekit/end/:sessionId', { preHandler: [app.authenticate] }, async (request: any) => {
    const { sessionId } = request.params;

    const { error } = await app.supabase
      .from('sessions')
      .update({ video_status: 'ended', processing_status: 'completed' })
      .eq('id', sessionId);

    if (error) {
      throw makeHttpError(500, 'Erro ao encerrar sessão');
    }

    return { success: true };
  });
}
