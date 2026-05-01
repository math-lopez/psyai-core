function field(id: string, value: string): string {
  const len = String(value.length).padStart(2, '0');
  return `${id}${len}${value}`;
}

function crc16(str: string): string {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
    }
  }
  return (crc & 0xffff).toString(16).toUpperCase().padStart(4, '0');
}

function toAscii(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .trim();
}

export function buildPixPayload({ pixKey, merchantName, amount }: {
  pixKey: string;
  merchantName: string;
  amount: number;
}): string {
  const name = toAscii(merchantName).slice(0, 25);
  const merchantAccount = field('00', 'BR.GOV.BCB.PIX') + field('01', pixKey);
  const additionalData  = field('05', '***');

  let payload =
    field('00', '01') +
    field('26', merchantAccount) +
    field('52', '0000') +
    field('53', '986') +
    field('54', amount.toFixed(2)) +
    field('58', 'BR') +
    field('59', name) +
    field('60', 'Brasil') +
    field('62', additionalData) +
    '6304';

  return payload + crc16(payload);
}
