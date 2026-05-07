// Gera payload PIX "Copia e Cola" (BR Code) estático conforme padrão BACEN/EMV.
// Sem dependências externas para o payload; apenas calcula CRC16-CCITT.

function tlv(id: string, value: string): string {
  const len = value.length.toString().padStart(2, "0");
  return `${id}${len}${value}`;
}

function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) crc = (crc << 1) ^ 0x1021;
      else crc <<= 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function sanitize(text: string, maxLen: number): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .substring(0, maxLen)
    .trim();
}

export interface PixPayloadInput {
  pixKey: string;
  merchantName: string;
  merchantCity: string;
  amount?: number;
  txid?: string;
  description?: string;
}

export function generatePixPayload(input: PixPayloadInput): string {
  const name = sanitize(input.merchantName || "RECEBEDOR", 25);
  const city = sanitize(input.merchantCity || "BRASIL", 15);
  const txid = sanitize(input.txid || "***", 25) || "***";

  const merchantAccountInfo =
    tlv("00", "br.gov.bcb.pix") +
    tlv("01", input.pixKey.trim()) +
    (input.description ? tlv("02", sanitize(input.description, 60)) : "");

  let payload =
    tlv("00", "01") +
    tlv("26", merchantAccountInfo) +
    tlv("52", "0000") +
    tlv("53", "986");

  if (input.amount && input.amount > 0) {
    payload += tlv("54", input.amount.toFixed(2));
  }

  payload +=
    tlv("58", "BR") +
    tlv("59", name) +
    tlv("60", city) +
    tlv("62", tlv("05", txid));

  payload += "6304";
  payload += crc16(payload);

  return payload;
}
