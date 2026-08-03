import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, unauthorized, forbidden } from "@/lib/auth";
import { publicClient } from "@/lib/chain";
import { TICKET_RESALE_ABI } from "@/lib/contracts/abis";
import { parseEventLogs } from "viem";

// GET /api/listings/:id — analytics do anúncio, só pro dono (PLANO_EVOLUCAO_V2.md
// §4.2, camada 2). Não existe "carrinho" no produto: o análogo de checkout
// abandonado é Purchase que não chegou a COMPLETED (PENDING expirado, FAILED,
// REFUNDED) contra esse listingId.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const { id } = await params;
  const listing = await prisma.listing.findUnique({ where: { id } });
  if (!listing) return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  if (listing.sellerAddress.toLowerCase() !== user.walletAddress?.toLowerCase()) {
    return forbidden();
  }

  const [checkoutAttempts, unsuccessfulCheckouts] = await Promise.all([
    prisma.purchase.count({ where: { listingId: id } }),
    prisma.purchase.count({ where: { listingId: id, status: { not: "COMPLETED" } } }),
  ]);

  return NextResponse.json({ checkoutAttempts, unsuccessfulCheckouts });
}

// PATCH /api/listings/:id
// Frontend calls this with the listTicket txHash so we can extract the onchainListingId.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const { id } = await params;
  const body    = await req.json().catch(() => ({}));
  const { txHash } = body as { txHash?: string };

  if (!txHash) return NextResponse.json({ error: "txHash is required" }, { status: 400 });

  const listing = await prisma.listing.findUnique({ where: { id } });
  if (!listing) return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  if (listing.sellerAddress.toLowerCase() !== user.walletAddress?.toLowerCase()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (listing.onchainListingId !== null) {
    return NextResponse.json({ ok: true, onchainListingId: listing.onchainListingId });
  }

  const receipt = await publicClient
    .waitForTransactionReceipt({ hash: txHash as `0x${string}` })
    .catch(() => null);

  if (!receipt || receipt.status !== "success") {
    return NextResponse.json({ error: "Transaction not found or failed" }, { status: 400 });
  }

  const logs = parseEventLogs({
    abi:       TICKET_RESALE_ABI,
    eventName: "TicketListed",
    logs:      receipt.logs,
  });

  if (!logs.length) {
    return NextResponse.json({ error: "TicketListed event not found in receipt" }, { status: 400 });
  }

  const { listingId } = logs[0].args;
  const onchainListingId = Number(listingId);

  await prisma.listing.update({
    where: { id },
    data:  { onchainListingId, txHash },
  });

  return NextResponse.json({ ok: true, onchainListingId });
}
