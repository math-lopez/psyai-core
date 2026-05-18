import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { SessionActionService } from '../src/modules/sessions/session-action.service';

const SESSION_ID = '7359c106-97d2-4f67-a560-8619d3a56996';
const FROM_PHONE  = '+5511940176230';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function run() {
  // 1. Verifica se a sessão existe e qual é o estado atual
  const { data: session, error } = await supabase
    .from('sessions')
    .select('id, patient_status, status, psychologist_id, patient:patients(full_name, email, phone)')
    .eq('id', SESSION_ID)
    .maybeSingle();

  if (error) { console.error('Erro ao buscar sessão:', error.message); return; }
  if (!session) { console.error('Sessão não encontrada:', SESSION_ID); return; }

  console.log('Sessão encontrada:');
  console.log('  status:', session.status);
  console.log('  patient_status:', session.patient_status);
  console.log('  patient:', session.patient);

  // 2. Simula o clique no botão "Confirmar"
  console.log('\nSimulando clique em Confirmar...');
  const svc = new SessionActionService(supabase);
  await svc.processWhatsAppButtonReply(`confirm_${SESSION_ID}`, FROM_PHONE);

  // 3. Verifica o estado após a ação
  const { data: after } = await supabase
    .from('sessions')
    .select('patient_status')
    .eq('id', SESSION_ID)
    .maybeSingle();

  console.log('\npatient_status após ação:', after?.patient_status);
}

run().catch((err: Error) => console.error('Erro:', err.message));
