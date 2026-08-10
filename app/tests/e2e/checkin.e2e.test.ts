import { describe, it, expect, beforeEach, vi } from "vitest";
import { createHmac } from "node:crypto";
import type { NextRequest } from "next/server";

/**
 * E2E (infra mockada) da rota POST /api/checkin — exercita o handler real do
 * Next, incluindo a validação do QR rotativo (CONTEXT.md):
 *   payload = tessera:v1:{tokenId}:{window}:{userId}:{sig}
 *   - HMAC-SHA256 keyed por QR_SECRET, comparado em tempo constante;
 *   - janela de 30s com tolerância ±1 (30s de clock skew);
 *   - o QR é vinculado ao DONO ATUAL do ticket;
 *   - só STAFF/ADMIN podem fazer check-in; status VALID -> CHECKED_IN.
 */

const { getAuthUser, prismaMock } = vi.hoisted(() => ({
  getAuthUser: vi.fn(),
  prismaMock: {
    ticket: { findUnique: vi.fn(), update: vi.fn() },
    user: { findFirst: vi.fn() },
    checkin: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  getAuthUser,
  unauthorized: () => Response.json({ error: "Unauthorized" }, { status: 401 }),
  forbidden: () => Response.json({ error: "Forbidden" }, { status: 403 }),
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { POST } from "@/app/api/checkin/route";

const QR_SECRET = process.env.QR_SECRET as string;
const WINDOW_SECS = 30;
const OWNER_USER_ID = "owner-user-1";
const OWNER_WALLET = "0xabc0000000000000000000000000000000000001";

function makePayload(tokenId: number, userId: string, windowOffset = 0): string {
  const window = Math.floor(Date.now() / (WINDOW_SECS * 1000)) + windowOffset;
  const sig = createHmac("sha256", QR_SECRET).update(`${tokenId}:${window}:${userId}`).digest("hex");
  return `tessera:v1:${tokenId}:${window}:${userId}:${sig}`;
}

function postReq(body: unknown): NextRequest {
  return new Request("http://localhost/api/checkin", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

const staff = { id: "staff-1", role: "STAFF" };

beforeEach(() => {
  vi.clearAllMocks();
  getAuthUser.mockResolvedValue(staff);
  prismaMock.$transaction.mockResolvedValue([]);
});

describe("POST /api/checkin — auth & role gate", () => {
  it("401 quando não autenticado", async () => {
    getAuthUser.mockResolvedValue(null);
    const res = await POST(postReq({ qrPayload: makePayload(1, OWNER_USER_ID) }));
    expect(res.status).toBe(401);
  });

  it("403 quando o usuário não é STAFF/ADMIN", async () => {
    getAuthUser.mockResolvedValue({ id: "u", role: "BUYER" });
    const res = await POST(postReq({ qrPayload: makePayload(1, OWNER_USER_ID) }));
    expect(res.status).toBe(403);
  });

  it("400 quando falta qrPayload", async () => {
    const res = await POST(postReq({}));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/checkin — validação do QR", () => {
  it("422 para assinatura inválida", async () => {
    const res = await POST(postReq({ qrPayload: "tessera:v1:1:1:user:deadbeef" }));
    expect(res.status).toBe(422);
  });

  it("422 quando a janela está fora da tolerância (±1)", async () => {
    const res = await POST(postReq({ qrPayload: makePayload(1, OWNER_USER_ID, 2) }));
    expect(res.status).toBe(422);
  });

  it("aceita a janela anterior (offset -1, clock skew)", async () => {
    prismaMock.ticket.findUnique.mockResolvedValue({
      tokenId: 1, ownerAddress: OWNER_WALLET, status: "VALID", eventId: "e1", ticketNumber: 5, seat: "A1", event: {},
    });
    prismaMock.user.findFirst.mockResolvedValue({ id: OWNER_USER_ID });
    const res = await POST(postReq({ qrPayload: makePayload(1, OWNER_USER_ID, -1) }));
    expect(res.status).toBe(200);
  });
});

describe("POST /api/checkin — vínculo com o dono e máquina de estados", () => {
  const validPayload = () => makePayload(1, OWNER_USER_ID);

  it("404 quando o ticket não existe", async () => {
    prismaMock.ticket.findUnique.mockResolvedValue(null);
    const res = await POST(postReq({ qrPayload: validPayload() }));
    expect(res.status).toBe(404);
  });

  it("422 quando o QR foi emitido por um dono anterior (userId != dono atual)", async () => {
    prismaMock.ticket.findUnique.mockResolvedValue({ tokenId: 1, ownerAddress: OWNER_WALLET, status: "VALID", eventId: "e1", event: {} });
    prismaMock.user.findFirst.mockResolvedValue({ id: "different-owner" });
    const res = await POST(postReq({ qrPayload: validPayload() }));
    expect(res.status).toBe(422);
  });

  // Check-in é POR DIA do evento desde a fatia de multi-dia: quem barra a
  // reentrada é a UNIQUE (tokenId, dayId), não mais `status === CHECKED_IN` —
  // um passe de vários dias fica CHECKED_IN depois do dia 1 e precisa entrar
  // de novo no dia 2. Por isso o 409 aqui vem da violação de unicidade.
  it("409 quando o ticket já fez check-in NESTE dia", async () => {
    prismaMock.ticket.findUnique.mockResolvedValue({ tokenId: 1, ownerAddress: OWNER_WALLET, status: "CHECKED_IN", eventId: "e1", event: {} });
    prismaMock.user.findFirst.mockResolvedValue({ id: OWNER_USER_ID });
    prismaMock.$transaction.mockRejectedValue(Object.assign(new Error("Unique constraint failed"), { code: "P2002" }));
    const res = await POST(postReq({ qrPayload: validPayload() }));
    expect(res.status).toBe(409);
  });

  it("200 quando o ticket já entrou em OUTRO dia (status CHECKED_IN não barra)", async () => {
    // Sem colisão na UNIQUE = é a primeira entrada deste dia. Regressão da
    // versão anterior, que rejeitava por status e tornava passe multi-dia
    // impossível.
    prismaMock.ticket.findUnique.mockResolvedValue({ tokenId: 1, ownerAddress: OWNER_WALLET, status: "CHECKED_IN", eventId: "e1", event: {} });
    prismaMock.user.findFirst.mockResolvedValue({ id: OWNER_USER_ID });
    const res = await POST(postReq({ qrPayload: validPayload() }));
    expect(res.status).toBe(200);
  });

  it("409 quando o ingresso é de outro dia do evento", async () => {
    // Evento de 2 dias; hoje é o Dia 1, o ingresso é do Dia 2. Antes desta
    // fatia nada checava isso e a entrada era aceita no dia errado.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-10T18:00:00Z")); // 15h em São Paulo
    try {
      prismaMock.ticket.findUnique.mockResolvedValue({
        tokenId: 1, ownerAddress: OWNER_WALLET, status: "VALID", eventId: "e1",
        event: { ticketDays: [{ id: "d1", name: "Dia 1", date: "2026-08-10" }, { id: "d2", name: "Dia 2", date: "2026-08-11" }] },
        ticketType: { dayIds: ["d2"], label: "Dia 2" },
      });
      prismaMock.user.findFirst.mockResolvedValue({ id: OWNER_USER_ID });
      const res = await POST(postReq({ qrPayload: validPayload() }));
      expect(res.status).toBe(409);
      expect((await res.json()).error).toMatch(/outro dia/i);
    } finally {
      vi.useRealTimers();
    }
  });

  it("200 quando o ingresso é do dia de hoje", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-11T18:00:00Z"));
    try {
      prismaMock.ticket.findUnique.mockResolvedValue({
        tokenId: 1, ownerAddress: OWNER_WALLET, status: "VALID", eventId: "e1",
        event: { ticketDays: [{ id: "d1", name: "Dia 1", date: "2026-08-10" }, { id: "d2", name: "Dia 2", date: "2026-08-11" }] },
        ticketType: { dayIds: ["d2"], label: "Dia 2" },
      });
      prismaMock.user.findFirst.mockResolvedValue({ id: OWNER_USER_ID });
      const res = await POST(postReq({ qrPayload: validPayload() }));
      expect(res.status).toBe(200);
      expect((await res.json()).dayName).toBe("Dia 2");
    } finally {
      vi.useRealTimers();
    }
  });

  // Passe multi-dia: o MESMO ingresso entra em qualquer dia do conjunto — é
  // isso que `dayIds` compra em relação ao `dayId` singular.
  it("passe entra em qualquer dia que ele cobre", async () => {
    const days = [
      { id: "d1", name: "Dia 1", date: "2026-08-10" },
      { id: "d2", name: "Dia 2", date: "2026-08-11" },
      { id: "d3", name: "Dia 3", date: "2026-08-12" },
    ];
    for (const [instant, expectedDay] of [
      ["2026-08-10T18:00:00Z", "Dia 1"],
      ["2026-08-12T18:00:00Z", "Dia 3"],
    ] as const) {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(instant));
      try {
        vi.clearAllMocks();
        getAuthUser.mockResolvedValue(staff);
        prismaMock.$transaction.mockResolvedValue([]);
        prismaMock.ticket.findUnique.mockResolvedValue({
          tokenId: 1, ownerAddress: OWNER_WALLET, status: "CHECKED_IN", eventId: "e1",
          event: { ticketDays: days },
          ticketType: { dayIds: ["d1", "d2", "d3"], label: "Passe completo" },
        });
        prismaMock.user.findFirst.mockResolvedValue({ id: OWNER_USER_ID });
        const res = await POST(postReq({ qrPayload: validPayload() }));
        expect(res.status).toBe(200);
        expect((await res.json()).dayName).toBe(expectedDay);
      } finally {
        vi.useRealTimers();
      }
    }
  });

  it("passe parcial NÃO entra num dia fora do conjunto", async () => {
    // Passe de fim de semana [d1,d2] apresentado no dia 3.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-12T18:00:00Z"));
    try {
      prismaMock.ticket.findUnique.mockResolvedValue({
        tokenId: 1, ownerAddress: OWNER_WALLET, status: "VALID", eventId: "e1",
        event: { ticketDays: [
          { id: "d1", name: "Dia 1", date: "2026-08-10" },
          { id: "d2", name: "Dia 2", date: "2026-08-11" },
          { id: "d3", name: "Dia 3", date: "2026-08-12" },
        ] },
        ticketType: { dayIds: ["d1", "d2"], label: "Passe fim de semana" },
      });
      prismaMock.user.findFirst.mockResolvedValue({ id: OWNER_USER_ID });
      const res = await POST(postReq({ qrPayload: validPayload() }));
      expect(res.status).toBe(409);
    } finally {
      vi.useRealTimers();
    }
  });

  // Entrada antecipada — o outro eixo do passe ultra, independente dos dias.
  describe("portões e entrada antecipada", () => {
    const days = [{ id: "d1", name: "Dia 1", date: "2026-08-10" }];
    // Portões às 10h de Brasília.
    const doorsOpenAt = new Date("2026-08-10T13:00:00Z");

    const mockTicket = (earlyEntryMinutes: number | null) => {
      prismaMock.ticket.findUnique.mockResolvedValue({
        tokenId: 1, ownerAddress: OWNER_WALLET, status: "VALID", eventId: "e1",
        event: { ticketDays: days, doorsOpenAt },
        ticketType: { dayIds: ["d1"], label: "Inteira", earlyEntryMinutes },
      });
      prismaMock.user.findFirst.mockResolvedValue({ id: OWNER_USER_ID });
    };

    it("ingresso comum é barrado antes da abertura dos portões", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-08-10T12:30:00Z")); // 09:30, portão 10h
      try {
        mockTicket(null);
        const res = await POST(postReq({ qrPayload: validPayload() }));
        expect(res.status).toBe(409);
        expect((await res.json()).error).toMatch(/portões abrem/i);
      } finally {
        vi.useRealTimers();
      }
    });

    it("passe com 60min de antecedência entra no mesmo horário", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-08-10T12:30:00Z")); // 09:30 = 30min antes
      try {
        mockTicket(60);
        const res = await POST(postReq({ qrPayload: validPayload() }));
        expect(res.status).toBe(200);
      } finally {
        vi.useRealTimers();
      }
    });

    it("nem o ultra entra antes da janela dele", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-08-10T11:30:00Z")); // 08:30 = 90min antes
      try {
        mockTicket(60);
        const res = await POST(postReq({ qrPayload: validPayload() }));
        expect(res.status).toBe(409);
        expect((await res.json()).error).toMatch(/entrada antecipada/i);
      } finally {
        vi.useRealTimers();
      }
    });

    it("sem portão declarado não há gate de horário", async () => {
      // Regressão: eventos já publicados não têm doorsOpenAt e não podem
      // passar a barrar ninguém por causa desta fatia.
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-08-10T06:00:00Z"));
      try {
        prismaMock.ticket.findUnique.mockResolvedValue({
          tokenId: 1, ownerAddress: OWNER_WALLET, status: "VALID", eventId: "e1",
          event: { ticketDays: days, doorsOpenAt: null },
          ticketType: { dayIds: ["d1"], label: "Inteira", earlyEntryMinutes: null },
        });
        prismaMock.user.findFirst.mockResolvedValue({ id: OWNER_USER_ID });
        const res = await POST(postReq({ qrPayload: validPayload() }));
        expect(res.status).toBe(200);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  it("409 quando hoje não é nenhum dia do evento", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T18:00:00Z"));
    try {
      prismaMock.ticket.findUnique.mockResolvedValue({
        tokenId: 1, ownerAddress: OWNER_WALLET, status: "VALID", eventId: "e1",
        event: { ticketDays: [{ id: "d1", name: "Dia 1", date: "2026-08-10" }] },
        ticketType: { dayIds: ["d1"], label: "Dia 1" },
      });
      prismaMock.user.findFirst.mockResolvedValue({ id: OWNER_USER_ID });
      const res = await POST(postReq({ qrPayload: validPayload() }));
      expect(res.status).toBe(409);
    } finally {
      vi.useRealTimers();
    }
  });

  it("409 quando o ticket não está VALID (ex.: FROZEN)", async () => {
    prismaMock.ticket.findUnique.mockResolvedValue({ tokenId: 1, ownerAddress: OWNER_WALLET, status: "FROZEN", eventId: "e1", event: {} });
    prismaMock.user.findFirst.mockResolvedValue({ id: OWNER_USER_ID });
    const res = await POST(postReq({ qrPayload: validPayload() }));
    expect(res.status).toBe(409);
  });

  it("200 e transita VALID -> CHECKED_IN no caminho feliz", async () => {
    prismaMock.ticket.findUnique.mockResolvedValue({
      tokenId: 1, ownerAddress: OWNER_WALLET, status: "VALID", eventId: "e1", ticketNumber: 7, seat: "B2",
      event: { title: "Show", venue: "Arena", city: "SP", eventDate: new Date() },
    });
    prismaMock.user.findFirst.mockResolvedValue({ id: OWNER_USER_ID });

    const res = await POST(postReq({ qrPayload: validPayload() }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ ok: true, tokenId: 1, ticketNumber: 7 });
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
  });
});
