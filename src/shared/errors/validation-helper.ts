import { FastifyReply } from 'fastify';
import { ZodError } from 'zod';

const FIELD_LABELS: Record<string, string> = {
  full_name: 'Nome completo',
  birth_date: 'Data de nascimento',
  email: 'E-mail',
  phone: 'Telefone',
  cpf: 'CPF',
  gender: 'Gênero',
  notes: 'Observações',
  status: 'Status',
  emergency_contact: 'Contato de emergência',
  session_value: 'Valor da sessão',
  sessionId: 'ID da sessão',
  role: 'Papel',
  patient_id: 'Paciente',
  session_date: 'Data da sessão',
  until_date: 'Data final',
  duration_minutes: 'Duração (minutos)',
  record_type: 'Tipo de registro',
  manual_notes: 'Notas manuais',
};

export function replyValidationError(reply: FastifyReply, error: ZodError) {
  const details = error.flatten() as {
    fieldErrors: Record<string, string[] | undefined>;
    formErrors: string[];
  };

  const firstField = Object.entries(details.fieldErrors).find(
    ([, msgs]) => msgs && msgs.length > 0,
  );

  let message = 'Dados inválidos';
  if (firstField) {
    const [field, msgs] = firstField;
    const label = FIELD_LABELS[field] ?? field;
    message = `${label}: ${msgs[0]}`;
  } else if (details.formErrors.length > 0) {
    message = details.formErrors[0];
  }

  return reply.status(400).send({ message, details });
}
