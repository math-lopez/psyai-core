import { SupabaseClient } from '@supabase/supabase-js';
import { addMinutes, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface ScheduleDay {
  day_of_week: number; // 0=domingo, 1=segunda ... 6=sábado
  start_time: string;  // "09:00"
  end_time: string;    // "18:00"
}

export interface AvailableSlot {
  datetime: string; // ISO8601
  label: string;    // "Sex, 15/05 às 09:00"
  id: string;       // "slot_20260515T0900_SESSION_UUID" — usado como row ID no WhatsApp
}

const SESSION_DURATION_MINUTES = 60;
const MAX_SLOTS = 10;
const MIN_ADVANCE_MINUTES = 30; // paciente não pode escolher slot nos próximos 30min

// Brasil não usa horário de verão desde 2019 — sempre UTC-3
const BRAZIL_OFFSET_MS = 3 * 60 * 60 * 1000;

export class ScheduleRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async getSchedule(psychologistId: string): Promise<ScheduleDay[]> {
    const { data, error } = await this.supabase
      .from('psychologist_schedule')
      .select('day_of_week, start_time, end_time')
      .eq('psychologist_id', psychologistId)
      .order('day_of_week');

    if (error) throw error;
    return (data ?? []) as ScheduleDay[];
  }

  async setSchedule(psychologistId: string, days: ScheduleDay[]): Promise<void> {
    if (days.length === 0) {
      const { error } = await this.supabase
        .from('psychologist_schedule')
        .delete()
        .eq('psychologist_id', psychologistId);
      if (error) throw error;
      return;
    }

    // Upsert primeiro — se falhar, agenda antiga permanece intacta
    const { error: upsertErr } = await this.supabase
      .from('psychologist_schedule')
      .upsert(
        days.map(d => ({ ...d, psychologist_id: psychologistId })),
        { onConflict: 'psychologist_id,day_of_week' },
      );
    if (upsertErr) throw upsertErr;

    // Só então remove os dias que não estão mais na nova lista
    const { error: delErr } = await this.supabase
      .from('psychologist_schedule')
      .delete()
      .eq('psychologist_id', psychologistId)
      .not('day_of_week', 'in', `(${days.map(d => d.day_of_week).join(',')})`);
    if (delErr) throw delErr;
  }

  async getRescheduleMode(psychologistId: string): Promise<'manual' | 'automatic'> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('reschedule_mode')
      .eq('id', psychologistId)
      .maybeSingle();

    if (error) throw error;
    return (data?.reschedule_mode ?? 'manual') as 'manual' | 'automatic';
  }

  async setRescheduleMode(psychologistId: string, mode: 'manual' | 'automatic'): Promise<void> {
    const { error } = await this.supabase
      .from('profiles')
      .update({ reschedule_mode: mode })
      .eq('id', psychologistId);

    if (error) throw error;
  }

  async getSessionsThisWeek(psychologistId: string): Promise<Date[]> {
    const now = new Date();
    const endOfWindow = getEndOfWindow();

    const { data, error } = await this.supabase
      .from('sessions')
      .select('session_date')
      .eq('psychologist_id', psychologistId)
      .neq('status', 'cancelled')
      .gte('session_date', now.toISOString())
      .lte('session_date', endOfWindow.toISOString());

    if (error) throw error;
    return (data ?? []).map(s => new Date(s.session_date));
  }

  computeAvailableSlots(schedule: ScheduleDay[], existingSessions: Date[], sessionId: string): AvailableSlot[] {
    const nowUTC = new Date();
    const minStart = addMinutes(nowUTC, MIN_ADVANCE_MINUTES);
    const endOfWindow = getEndOfWindow();
    const slots: AvailableSlot[] = [];

    // Calcula o dia atual em horário de Brasília usando UTC internamente
    const nowBRT = new Date(nowUTC.getTime() - BRAZIL_OFFSET_MS);
    const brtDay = new Date(Date.UTC(nowBRT.getUTCFullYear(), nowBRT.getUTCMonth(), nowBRT.getUTCDate()));

    while (slots.length < MAX_SLOTS) {
      const brtDayStartUTC = brtDay.getTime() + BRAZIL_OFFSET_MS;
      if (new Date(brtDayStartUTC) > endOfWindow) break;

      const daySchedule = schedule.find(s => s.day_of_week === brtDay.getUTCDay());

      if (daySchedule) {
        const [startH, startM] = daySchedule.start_time.split(':').map(Number);
        const [endH, endM] = daySchedule.end_time.split(':').map(Number);

        // Converte horários BRT para UTC somando o offset
        let slotStart = new Date(brtDayStartUTC + startH * 3_600_000 + startM * 60_000);
        const dayEnd  = new Date(brtDayStartUTC + endH   * 3_600_000 + endM   * 60_000);

        while (slots.length < MAX_SLOTS) {
          const slotEnd = addMinutes(slotStart, SESSION_DURATION_MINUTES);
          if (slotEnd > dayEnd) break;

          if (slotStart >= minStart) {
            const hasConflict = existingSessions.some(s => {
              const sEnd = addMinutes(s, SESSION_DURATION_MINUTES);
              return slotStart < sEnd && slotEnd > s;
            });

            if (!hasConflict) {
              // Label e compact em horário de Brasília
              const slotBRT = new Date(slotStart.getTime() - BRAZIL_OFFSET_MS);
              const label   = format(slotBRT, "EEE, dd/MM 'às' HH:mm", { locale: ptBR });
              const compact = format(slotBRT, "yyyyMMdd'T'HHmm");
              slots.push({ datetime: slotStart.toISOString(), label, id: `slot_${compact}_${sessionId}` });
            }
          }

          slotStart = addMinutes(slotStart, SESSION_DURATION_MINUTES);
        }
      }

      brtDay.setUTCDate(brtDay.getUTCDate() + 1);
    }

    return slots;
  }
}

function getEndOfWindow(): Date {
  const end = new Date();
  end.setDate(end.getDate() + 7);
  end.setHours(23, 59, 59, 999);
  return end;
}

export function parseSlotRowId(rowId: string): { compactDate: string; sessionId: string } | null {
  // format: slot_YYYYMMDDTHHmm_SESSION-UUID
  const match = rowId.match(/^slot_(\d{8}T\d{4})_(.+)$/);
  if (!match) return null;
  return { compactDate: match[1], sessionId: match[2] };
}

export function compactDateToISO(compact: string): string {
  // "20260519T0800" = 08:00 BRT → converte para UTC somando 3h
  const year  = parseInt(compact.slice(0, 4));
  const month = parseInt(compact.slice(4, 6));
  const day   = parseInt(compact.slice(6, 8));
  const hour  = parseInt(compact.slice(9, 11));
  const min   = parseInt(compact.slice(11, 13));
  return new Date(Date.UTC(year, month - 1, day, hour + 3, min, 0)).toISOString();
}
