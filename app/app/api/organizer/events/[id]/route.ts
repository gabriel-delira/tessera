import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, unauthorized, forbidden } from "@/lib/auth";
import { geocodeAddress } from "@/lib/geocode";
import { isSocialHalfMandatory } from "@/lib/socialHalfQuota";
import { parseTicketMatrix, type ParsedTicketType } from "@/lib/ticketMatrixInput";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const { id } = await params;

  const organizer = await prisma.organizer.findUnique({ where: { userId: user.id } });
  if (!organizer) return forbidden();

  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (event.organizerId !== organizer.id) return forbidden();

  if (!["DRAFT", "PENDING_APPROVAL"].includes(event.status)) {
    return NextResponse.json({ error: "Cannot edit event in current status" }, { status: 409 });
  }

  const body = await req.json().catch(() => ({}));
  const allowed = [
    "title","description","venue","city","coverImageUrl","coverVideoUrl",
    "eventDate","endDate",
    "category","hasSocialHalf","socialHalfBps","maxTicketsPerAccount",
  ];
  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) {
      data[key] = key === "eventDate" || key === "endDate" ? new Date(body[key]) : body[key];
    }
  }

  // Fim do evento — PLANO_EVOLUCAO_V2.md §10.1/D35. Se só um dos dois vier,
  // valida contra o valor persistido do outro.
  const nextEventDate = ("eventDate" in data ? data.eventDate : event.eventDate) as Date;
  const nextEndDate = ("endDate" in data ? data.endDate : event.endDate) as Date;
  if (("eventDate" in data && Number.isNaN(nextEventDate.getTime())) ||
      ("endDate" in data && Number.isNaN(nextEndDate.getTime()))) {
    return NextResponse.json({ error: "eventDate/endDate is invalid" }, { status: 400 });
  }
  if (nextEndDate.getTime() <= nextEventDate.getTime()) {
    return NextResponse.json({ error: "endDate must be after eventDate" }, { status: 400 });
  }

  // Teto de revenda — PLANO_EVOLUCAO_V2.md §10.2/A11-A14. Sempre 100% da face,
  // em toda categoria; não está mais em `allowed`, então nem entra no PATCH.

  // Meia-entrada — PLANO_EVOLUCAO_V2.md §10.3-10.4/D38-D39. Mesma lógica do
  // POST: categoria coberta força hasSocialHalf e piso de 40%, inclusive
  // quando é a PRÓPRIA mudança de categoria que passa a cobrir o evento
  // (ex.: OUTRO → SHOW liga a meia sozinho, mesmo sem o body pedir).
  if ("category" in data || "hasSocialHalf" in data || "socialHalfBps" in data) {
    const nextCategory = (data.category ?? event.category) as string;
    if (isSocialHalfMandatory(nextCategory)) {
      data.hasSocialHalf = true;
      const nextBps =
        "socialHalfBps" in data
          ? (data.socialHalfBps === null || data.socialHalfBps === "" ? null : Number(data.socialHalfBps))
          : event.socialHalfBps;
      if (nextBps !== null && nextBps < 4000) {
        return NextResponse.json({ error: "socialHalfBps must be at least 4000 (40%) for this category" }, { status: 400 });
      }
      data.socialHalfBps = nextBps;
    }
  }

  if ("venue" in data || "city" in data) {
    const geo = await geocodeAddress((data.venue as string) ?? event.venue, (data.city as string) ?? event.city);
    data.latitude = geo?.latitude ?? null;
    data.longitude = geo?.longitude ?? null;
  }

  // Limite por conta — 2026-08-08. Validado aqui (não no loop genérico
  // acima) porque, diferente dos outros campos de `allowed`, precisa virar
  // número e rejeitar valor inválido em vez de gravar o que veio cru.
  if ("maxTicketsPerAccount" in data) {
    const raw = data.maxTicketsPerAccount;
    if (raw === null || raw === "") {
      data.maxTicketsPerAccount = null;
    } else {
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 1) {
        return NextResponse.json({ error: "maxTicketsPerAccount must be a positive integer, or omitted" }, { status: 400 });
      }
      data.maxTicketsPerAccount = n;
    }
  }

  // Matriz de ingressos — 2026-08-08. `ticketTypes` não está em `allowed`
  // (não é um campo escalar do Event), então só entra em jogo se vier no
  // body; sem ela, o PATCH não mexe na matriz existente. Pré-aprovação
  // ninguém comprou nada ainda (checado acima), então trocar a matriz
  // inteira — apagar e recriar — é seguro; não há Ticket/Purchase presos a
  // um TicketType que vai sumir.
  let matrixTypes: ParsedTicketType[] | null = null;
  if ("ticketTypes" in body) {
    const parsed = parseTicketMatrix(body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    data.ticketPriceUsdc = parsed.matrix.priceUsdc;
    data.maxTickets = parsed.matrix.maxTickets;
    data.ticketDays = parsed.matrix.ticketDays ?? undefined;
    data.ticketAreas = parsed.matrix.ticketAreas ?? undefined;
    matrixTypes = parsed.matrix.ticketTypes;
  }

  const [updated] = await prisma.$transaction([
    prisma.event.update({ where: { id }, data }),
    ...(matrixTypes
      ? [
          prisma.ticketType.deleteMany({ where: { eventId: id } }),
          prisma.ticketType.createMany({
            data: matrixTypes.map((t) => ({
              eventId:    id,
              label:      t.label,
              priceUsdc:  t.priceUsdc,
              quantity:   t.quantity,
              salesEndAt: t.salesEndAt,
              dayIds:     t.dayIds,
              areaId:     t.areaId,
              lotNumber:  t.lotNumber,
              earlyEntryMinutes: t.earlyEntryMinutes,
            })),
          }),
        ]
      : []),
  ]);

  return NextResponse.json({ event: updated });
}
