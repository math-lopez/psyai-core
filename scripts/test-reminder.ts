import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { ReminderService } from '../src/services/reminderService';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const log = {
  info: (msg: string) => console.log(msg),
  warn: (msg: string) => console.warn(msg),
  error: (obj: object, msg: string) => console.error(msg, obj),
};

const reminder = new ReminderService(supabase, log);

reminder.sendReminders()
  .then(() => console.log('Job concluído.'))
  .catch((err) => console.error('Erro:', err.message));
