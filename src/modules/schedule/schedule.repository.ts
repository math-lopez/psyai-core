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
    const { error: delErr } = await this.supabase
      .from('psychologist_schedule')
      .delete()
      .eq('psychologist_id', psychologistId);

    if (delErr) throw delErr;
    if (days.length === 0) return;

    const { error: insErr } = await this.supabase
      .from('psychologist_schedule')
      .insert(days.map(d => ({ ...d, psychologist_id: psychologistId })));

    if (insErr) throw insErr;
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
    const now = new Date();
    const minStart = addMinutes(now, MIN_ADVANCE_MINUTES);
    const endOfWeek = getEndOfWindow();
    const slots: AvailableSlot[] = [];

    const day = new Date(now);
    day.setHours(0, 0, 0, 0);

    while (day <= endOfWeek && slots.length < MAX_SLOTS) {
      const daySchedule = schedule.find(s => s.day_of_week === day.getDay());

      if (daySchedule) {
        const [startH, startM] = daySchedule.start_time.split(':').map(Number);
        const [endH, endM] = daySchedule.end_time.split(':').map(Number);

        let slotStart = new Date(day);
        slotStart.setHours(startH, startM, 0, 0);

        const dayEnd = new Date(day);
        dayEnd.setHours(endH, endM, 0, 0);

        while (slots.length < MAX_SLOTS) {
          const slotEnd = addMinutes(slotStart, SESSION_DURATION_MINUTES);
          if (slotEnd > dayEnd) break;

          if (slotStart >= minStart) {
            const hasConflict = existingSessions.some(s => {
              const sEnd = addMinutes(s, SESSION_DURATION_MINUTES);
              return slotStart < sEnd && slotEnd > s;
            });

            if (!hasConflict) {
              const label = format(slotStart, "EEE, dd/MM 'às' HH:mm", { locale: ptBR });
              const compact = format(slotStart, "yyyyMMdd'T'HHmm");
              slots.push({ datetime: slotStart.toISOString(), label, id: `slot_${compact}_${sessionId}` });
            }
          }

          slotStart = addMinutes(slotStart, SESSION_DURATION_MINUTES);
        }
      }

      day.setDate(day.getDate() + 1);
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
  // "20260515T0900" → "2026-05-15T09:00:00.000Z"
  const year  = compact.slice(0, 4);
  const month = compact.slice(4, 6);
  const day   = compact.slice(6, 8);
  const hour  = compact.slice(9, 11);
  const min   = compact.slice(11, 13);
  return `${year}-${month}-${day}T${hour}:${min}:00.000Z`;
}
