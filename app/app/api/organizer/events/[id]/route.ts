import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, unauthorized, forbidden } from "@/lib/auth";
import { geocodeAddress } from "@/lib/geocode";
import { resolveMaxResaleBps } from "@/lib/resaleCap";
import { isSocialHalfMandatory } from "@/lib/socialHalfQuota";

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
    "eventDate","endDate","ticketPriceUsdc","maxTickets",
    "category","maxResaleBps","hasSocialHalf","socialHalfBps",
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

  // Teto de revenda — PLANO_EVOLUCAO_V2.md §10.2/D36-D37. Mudar a categoria
  // para ESPORTE precisa re-normalizar o teto, mesmo que maxResaleBps não
  // tenha vindo neste PATCH — por isso sempre roda quando category ou
  // maxResaleBps mudam, usando o valor persistido do que não veio.
  if ("category" in data || "maxResaleBps" in data) {
    const nextCategory = (data.category ?? event.category) as string;
    const requestedMaxResaleBps =
      "maxResaleBps" in data
        ? (data.maxResaleBps === null || data.maxResaleBps === "" ? null : Number(data.maxResaleBps))
        : event.maxResaleBps;
    const result = resolveMaxResaleBps(nextCategory, requestedMaxResaleBps);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    data.maxResaleBps = result.bps;
  }

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

  const updated = await prisma.event.update({ where: { id }, data });
  return NextResponse.json({ event: updated });
}
