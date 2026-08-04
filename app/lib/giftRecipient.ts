import { prisma } from "@/lib/db";
import type { User } from "@prisma/client";

export type GiftRecipientError =
  | { code: "INVALID_IDENTIFIER"; error: string }
  | { code: "RECIPIENT_NOT_FOUND"; error: string }
  | { code: "RECIPIENT_NO_WALLET"; error: string };

// PLANO_EVOLUCAO_V2.md D18 — "comprar em nome de terceiro" exige que o
// destinatário já tenha conta na Tessera (decisão explícita: sem
// provisionamento antecipado de carteira Privy). Aceita CPF (11 dígitos) ou
// e-mail; resolve para um User existente com walletAddress, ou explica por
// que não deu.
//
// Nota de segurança: como é um lookup binário (achou/não achou) exposto no
// checkout, ele é por definição um oráculo de "esse CPF/e-mail tem conta
// aqui" para quem tentar várias vezes. Aceitável para o volume esperado
// agora; se virar abuso, a resposta é rate-limit no endpoint de checkout,
// não neste helper.
// Presentear a si mesmo (ex.: digitou o próprio e-mail) não é bloqueado aqui
// — resulta em recipientUserId === userId, que é exatamente o comportamento
// de uma compra normal, então não precisa de caso especial.
export async function resolveGiftRecipient(
  identifier: string
): Promise<{ recipient: User } | GiftRecipientError> {
  const trimmed = identifier.trim();
  const digitsOnly = trimmed.replace(/\D/g, "");
  const isEmail = trimmed.includes("@");
  const isCpf = !isEmail && digitsOnly.length === 11;

  if (!isEmail && !isCpf) {
    return { code: "INVALID_IDENTIFIER", error: "Informe um e-mail válido ou CPF completo (11 dígitos)." };
  }

  const recipient = await prisma.user.findUnique({
    where: isEmail ? { email: trimmed.toLowerCase() } : { cpf: digitsOnly },
  });

  if (!recipient) {
    return { code: "RECIPIENT_NOT_FOUND", error: "Essa pessoa ainda não tem conta na Tessera." };
  }
  if (!recipient.walletAddress) {
    return { code: "RECIPIENT_NO_WALLET", error: "Essa pessoa ainda não concluiu o cadastro na Tessera." };
  }

  return { recipient };
}
