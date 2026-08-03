// Escada de identificação — LAYOUT_UPDATE.md §5.6.1. Três níveis de custo e
// atrito bem diferentes; nenhum comprador passa por KYC completo (só quem
// recebe dinheiro precisa).
//
//   NONE  → IDENTIFIED : CPF, exigido na 1a compra (max_per_cpf, meia-entrada)
//   IDENTIFIED → VERIFIED : documento completo, exigido no 1o anúncio de revenda
//
// Nenhum provedor de KYC real está escolhido ainda — mesmo padrão de
// MockPsp em lib/psp: interface real, implementação mock que aprova na hora.
// Troca por um provedor de verdade quando o negócio escolher um, sem tocar
// nas rotas que chamam este módulo.

export interface FullVerificationInput {
  cpf: string;
  fullName: string;
}

export interface KycProvider {
  /** Verificação completa de documento — decide se a identidade é aprovada. */
  submitFullVerification(input: FullVerificationInput): Promise<{ approved: boolean; reason?: string }>;
}

class MockKyc implements KycProvider {
  async submitFullVerification(input: FullVerificationInput) {
    if (!/^\d{11}$/.test(input.cpf.replace(/\D/g, ""))) {
      return { approved: false, reason: "CPF inválido" };
    }
    if (!input.fullName || input.fullName.trim().length < 3) {
      return { approved: false, reason: "Nome completo inválido" };
    }
    // Mock: aprova instantaneamente, como o MockPsp aprova PIX instantaneamente.
    return { approved: true };
  }
}

function getKyc(): KycProvider {
  const provider = process.env.KYC_PROVIDER ?? "mock";
  switch (provider) {
    case "mock": return new MockKyc();
    default: throw new Error(`Unknown KYC_PROVIDER: ${provider}. Implement it in lib/kyc.ts`);
  }
}

export const kyc = getKyc();

export function isValidCpf(raw: string): boolean {
  return /^\d{11}$/.test(raw.replace(/\D/g, ""));
}
