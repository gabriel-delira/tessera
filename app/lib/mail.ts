// E-mail transacional — LAYOUT_UPDATE.md §6.6: dependência obrigatória da
// negociação (sem aviso, morre por expiração) e usado também em eventos de
// segurança (troca de chave PIX, §5.7.1). Nenhum provedor real está
// escolhido ainda — mesmo padrão de lib/psp e lib/kyc: interface real,
// mock que loga em vez de enviar. Troca por um provedor de verdade
// (Resend, SES, Postmark…) sem tocar em quem chama este módulo.

export interface MailMessage {
  to: string;
  subject: string;
  body: string;
}

export interface MailProvider {
  send(message: MailMessage): Promise<void>;
}

class MockMail implements MailProvider {
  async send(message: MailMessage): Promise<void> {
    // eslint-disable-next-line no-console
    console.log(`[mail:mock] → ${message.to} — ${message.subject}\n${message.body}`);
  }
}

function getMail(): MailProvider {
  const provider = process.env.MAIL_PROVIDER ?? "mock";
  switch (provider) {
    case "mock": return new MockMail();
    default: throw new Error(`Unknown MAIL_PROVIDER: ${provider}. Implement it in lib/mail.ts`);
  }
}

export const mail = getMail();
