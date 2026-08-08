import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, unauthorized, forbidden } from "@/lib/auth";
import { geocodeAddress } from "@/lib/geocode";

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
    "eventDate","ticketPriceUsdc","maxTickets",
  ];
  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) {
      data[key] = key === "eventDate" ? new Date(body[key]) : body[key];
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
