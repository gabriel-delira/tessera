import { randomBytes } from "crypto";

// Código de entrada — PLANO_EVOLUCAO_V2.md §10.5-10.6/D41,D43. Segredo
// aleatório ao portador, NÃO hash (não há dado pra derivar) e NÃO payload
// assinado como o QR do ingresso (esse é efêmero e não precisa ser revogável;
// o código precisa ser uso único, revogável e contar vaga — os três exigem
// consulta ao banco de qualquer jeito, então a auto-verificação de um HMAC
// não compra nada e só alongaria o que a pessoa precisa digitar na portaria).
//
// Crockford Base32: sem I/L/O/U, feito pra transcrição humana e leitura em
// voz alta. 10 caracteres ≈ 10^15 combinações — com milhares de códigos por
// evento, chance de acerto por tentativa ≈ 10^-12. Rate limit no check-in
// continua obrigatório (força bruta é o único ataque que a entropia não
// elimina sozinha).
const CROCKFORD_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const CODE_LENGTH = 10;

export function generateAccessCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CROCKFORD_ALPHABET[bytes[i] % CROCKFORD_ALPHABET.length];
  }
  return out;
}

// Normaliza entrada humana: maiúsculas, sem hífens/espaços (a UI agrupa em
// "4K7P-9XQ2-M3" só pra leitura — o valor persistido é a string crua).
export function normalizeAccessCode(input: string): string {
  return input.trim().toUpperCase().replace(/[\s-]/g, "");
}

// QR do código de entrada usa o mesmo prefixo "tessera:" do QR de ingresso —
// components/../checkin/page.tsx filtra por isso antes de tentar validar; sem
// o prefixo, a câmera ignoraria o QR do código.
export const ACCESS_CODE_QR_PREFIX = "tessera:code:v1:";

export function formatAccessCodeQrPayload(code: string): string {
  return `${ACCESS_CODE_QR_PREFIX}${code}`;
}

export function parseAccessCodeQrPayload(payload: string): string | null {
  if (!payload.startsWith(ACCESS_CODE_QR_PREFIX)) return null;
  return normalizeAccessCode(payload.slice(ACCESS_CODE_QR_PREFIX.length));
}
