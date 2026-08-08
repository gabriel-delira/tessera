import { createWalletClient, http, parseEventLogs, encodeFunctionData } from "viem";
import { publicClient, chain } from "@/lib/chain";
import { getSigner } from "@/lib/signer";
import { getAddresses } from "@/lib/contracts/addresses";
import { TICKET_SALE_ABI, TICKET_NFT_ABI, TICKET_RESALE_ABI, ERC20_ABI } from "@/lib/contracts/abis";
import type { Event as PrismaEvent, Organizer } from "@prisma/client";

async function getOwnerClient() {
  const { ownerAccount } = await getSigner();
  return createWalletClient({ account: ownerAccount, chain, transport: http(process.env.RPC_URL) });
}

async function getTreasuryClient() {
  const { treasuryAccount } = await getSigner();
  return createWalletClient({ account: treasuryAccount, chain, transport: http(process.env.RPC_URL) });
}

// ── createEvent ───────────────────────────────────────────────────────────────

// PLANO_EVOLUCAO_V2.md §5.1/§5.2 — A1 opção (a): um evento on-chain agrupa N tipos
// de ingresso (área × dia × lote), criados na mesma transação do evento. O chamador
// (approve route) monta `types` a partir de `Event.ticketTypes`; sem tipos passados,
// `createEventOnChain` cria um tipo único a partir de `Event.ticketPriceUsdc` —
// usado só por chamadores que ainda não migraram (não deveria sobrar nenhum).
export interface TicketTypeInput {
  priceUsdc: number;
  /** Cota própria do tipo. 0/null = sem cota; quem limita é o teto do evento. */
  maxTickets?: number | null;
  /** Fim do lote por data. null = sem prazo próprio. */
  salesEndAt?: Date | null;
  /** "Pista — Dia 1 — Lote 2"; vira o `seat` do NFT. */
  label?: string;
}

interface OnchainTicketType {
  price: bigint;
  maxTickets: bigint;
  salesEndAt: bigint;
  label: string;
}

function toOnchainTicketType(t: TicketTypeInput): OnchainTicketType {
  return {
    price:      BigInt(Math.round(t.priceUsdc * 1_000_000)),
    maxTickets: BigInt(t.maxTickets ?? 0),
    salesEndAt: t.salesEndAt ? BigInt(Math.floor(t.salesEndAt.getTime() / 1000)) : BigInt(0),
    label:      t.label ?? "",
  };
}

export interface CreateEventResult {
  txHash: `0x${string}`;
  onchainEventId: number;
  royaltySplitterAddr: string;
  /** Ids dos tipos criados, na ordem em que foram passados. */
  ticketTypeIds: number[];
}

export async function createEventOnChain(
  event: PrismaEvent & { organizer: Organizer },
  types?: TicketTypeInput[]
): Promise<CreateEventResult> {
  const { sale, usdc } = getAddresses();
  const client = await getOwnerClient();

  const eventTimestamp = BigInt(Math.floor(event.eventDate.getTime() / 1000));

  // Sem tipos explícitos: um tipo único sem cota própria — o teto do evento é quem
  // limita, exatamente como antes de existir `TicketType`.
  const typeInputs = (types?.length ? types : [{ priceUsdc: Number(event.ticketPriceUsdc) }])
    .map(toOnchainTicketType);

  const txHash = await client.writeContract({
    address: sale,
    abi: TICKET_SALE_ABI,
    functionName: "createEvent",
    args: [
      event.organizer.payoutWallet as `0x${string}`,
      usdc,
      BigInt(event.platformFeeBps),
      BigInt(event.maxTickets ?? 0),
      event.title,
      eventTimestamp,
      BigInt(event.royaltyBps),       // uint96
      BigInt(event.royaltyOrgShareBps),
      typeInputs,
    ],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success") throw new Error("createEvent tx reverted");

  const logs = parseEventLogs({
    abi: TICKET_SALE_ABI,
    eventName: "EventCreated",
    logs: receipt.logs,
  });

  if (!logs.length) throw new Error("EventCreated log not found in receipt");

  const typeLogs = parseEventLogs({
    abi: TICKET_SALE_ABI,
    eventName: "TicketTypeAdded",
    logs: receipt.logs,
  });

  const { eventId, royaltySplitter } = logs[0].args;
  return {
    txHash,
    onchainEventId:      Number(eventId),
    royaltySplitterAddr: royaltySplitter as string,
    ticketTypeIds:       typeLogs.map((l) => Number(l.args.typeId)),
  };
}

// ── addTicketType ─────────────────────────────────────────────────────────────

/// Abre um lote novo ou libera uma área extra num evento já criado.
export async function addTicketTypeOnChain(
  onchainEventId: number,
  type: TicketTypeInput
): Promise<{ txHash: `0x${string}`; typeId: number }> {
  const { sale } = getAddresses();
  const client = await getOwnerClient();

  const txHash = await client.writeContract({
    address: sale,
    abi: TICKET_SALE_ABI,
    functionName: "addTicketType",
    args: [BigInt(onchainEventId), toOnchainTicketType(type)],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success") throw new Error("addTicketType tx reverted");

  const logs = parseEventLogs({
    abi: TICKET_SALE_ABI,
    eventName: "TicketTypeAdded",
    logs: receipt.logs,
  });
  if (!logs.length) throw new Error("TicketTypeAdded log not found in receipt");

  return { txHash, typeId: Number(logs[0].args.typeId) };
}

// ── buyTicketFor ──────────────────────────────────────────────────────────────

export interface BuyTicketResult {
  txHash: `0x${string}`;
  tokenId: number;
}

export async function buyTicketOnChain(
  onchainEventId: number,
  onchainTicketTypeId: number,
  recipientWallet: `0x${string}`
): Promise<BuyTicketResult> {
  const { sale } = getAddresses();
  const client = await getTreasuryClient();

  const txHash = await client.writeContract({
    address: sale,
    abi: TICKET_SALE_ABI,
    functionName: "buyTicketFor",
    args: [BigInt(onchainEventId), BigInt(onchainTicketTypeId), recipientWallet],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success") throw new Error("buyTicketFor tx reverted");

  const logs = parseEventLogs({
    abi: TICKET_SALE_ABI,
    eventName: "TicketSold",
    logs: receipt.logs,
  });

  if (!logs.length) throw new Error("TicketSold log not found in receipt");

  const { tokenId } = logs[0].args;
  return { txHash, tokenId: Number(tokenId) };
}

// ── Reads ─────────────────────────────────────────────────────────────────────

/// On-chain USDC balance of `wallet`, returned as a human USDC amount (6 decimals).
export async function getUsdcBalance(wallet: `0x${string}`): Promise<number> {
  const { usdc } = getAddresses();
  const raw = (await publicClient.readContract({
    address: usdc,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [wallet],
  })) as bigint;
  return Number(raw) / 1_000_000;
}

/// Current on-chain owner of a token; returns null if the token does not exist.
export async function getTokenOwner(tokenId: number): Promise<`0x${string}` | null> {
  const { nft } = getAddresses();
  try {
    return (await publicClient.readContract({
      address: nft,
      abi: TICKET_NFT_ABI,
      functionName: "ownerOf",
      args: [BigInt(tokenId)],
    })) as `0x${string}`;
  } catch {
    return null;
  }
}

/// Authoritative ticket number ("#N") as recorded on-chain at mint time.
/// Avoids the race of deriving it from an off-chain count().
export async function getOnchainTicketNumber(tokenId: number): Promise<number> {
  const { nft } = getAddresses();
  const data = (await publicClient.readContract({
    address: nft,
    abi: TICKET_NFT_ABI,
    functionName: "getTicketData",
    args: [BigInt(tokenId)],
  })) as { ticketNumber: bigint };
  return Number(data.ticketNumber);
}

// ── setBaseURI ────────────────────────────────────────────────────────────────

export async function setBaseURIOnChain(baseURI: string): Promise<`0x${string}`> {
  const { nft } = getAddresses();
  const client = await getOwnerClient();

  const txHash = await client.writeContract({
    address: nft,
    abi: TICKET_NFT_ABI,
    functionName: "setBaseURI",
    args: [baseURI],
  });

  await publicClient.waitForTransactionReceipt({ hash: txHash });
  return txHash;
}

// ── toggleEventPause ──────────────────────────────────────────────────────────

export async function toggleEventPauseOnChain(onchainEventId: number): Promise<`0x${string}`> {
  const { sale } = getAddresses();
  const client = await getOwnerClient();

  const txHash = await client.writeContract({
    address: sale,
    abi: TICKET_SALE_ABI,
    functionName: "toggleEventPause",
    args: [BigInt(onchainEventId)],
  });

  await publicClient.waitForTransactionReceipt({ hash: txHash });
  return txHash;
}

// ── Resale — settler-only (treasury wallet) ───────────────────────────────────

export async function lockListingOnChain(onchainListingId: number, buyer: `0x${string}`): Promise<void> {
  const { resale } = getAddresses();
  const client = await getTreasuryClient();
  const txHash = await client.writeContract({
    address: resale,
    abi: TICKET_RESALE_ABI,
    functionName: "lockListing",
    args: [BigInt(onchainListingId), buyer],
  });
  await publicClient.waitForTransactionReceipt({ hash: txHash });
}

export async function unlockListingOnChain(onchainListingId: number): Promise<void> {
  const { resale } = getAddresses();
  const client = await getTreasuryClient();
  const txHash = await client.writeContract({
    address: resale,
    abi: TICKET_RESALE_ABI,
    functionName: "unlockListing",
    args: [BigInt(onchainListingId)],
  });
  await publicClient.waitForTransactionReceipt({ hash: txHash });
}

// Fluxo Cripto (LAYOUT_UPDATE.md §5.7) — a tesouraria paga em USDC o preço do
// anúncio (l.price on-chain; o contrato não aceita agreedPrice aqui) e o
// contrato faz o split atomicamente: vendedor recebe na própria carteira
// (a mesma que anunciou — §5.7.3, sem payoutWallet configurável), o
// RoyaltySplitter do evento recebe e divide entre organizador/plataforma.
// ⚠️ Requer setup operacional fora deste código: a tesouraria precisa manter
// saldo em USDC e ter aprovado o contrato de resale a gastar esse saldo
// (approve prévio). Sem isso, esta chamada reverte por saldo/allowance
// insuficiente — não é um bug de código, é infraestrutura de tesouraria que
// precisa existir antes deste caminho rodar em produção.
export async function buyListedTicketForOnChain(
  onchainListingId: number,
  recipientWallet: `0x${string}`
): Promise<`0x${string}`> {
  const { resale } = getAddresses();
  const client = await getTreasuryClient();
  const txHash = await client.writeContract({
    address: resale,
    abi: TICKET_RESALE_ABI,
    functionName: "buyListedTicketFor",
    args: [BigInt(onchainListingId), recipientWallet],
  });
  await publicClient.waitForTransactionReceipt({ hash: txHash });
  return txHash;
}

// agreedPriceUsdc — LAYOUT_UPDATE.md §5.7.2/§6.4: preço do anúncio quando não
// há negociação, ou o valor acordado quando há. É o que o contrato usa para
// calcular e gravar o split como atestado on-chain — nunca um valor pronto.
export async function settleListedTicketOnChain(
  onchainListingId: number,
  recipientWallet: `0x${string}`,
  agreedPriceUsdc: number
): Promise<`0x${string}`> {
  const { resale } = getAddresses();
  const client = await getTreasuryClient();
  const txHash = await client.writeContract({
    address: resale,
    abi: TICKET_RESALE_ABI,
    functionName: "settleListedTicket",
    args: [BigInt(onchainListingId), recipientWallet, BigInt(Math.round(agreedPriceUsdc * 1_000_000))],
  });
  await publicClient.waitForTransactionReceipt({ hash: txHash });
  return txHash;
}

// LAYOUT_UPDATE.md §5.7.2/§7 — lê o atestado on-chain gravado no evento
// TicketSettled de uma transação já minerada, para o extrato do organizador
// comparar contra o que o backend registrou no ledger ("conferido on-chain ✓").
export interface SettledSplit {
  agreedPrice: number;
  sellerAmount: number;
  royaltyAmount: number;
  royaltyReceiver: string;
  platformAmount: number;
}

export async function getSettledSplitFromTx(txHash: `0x${string}`): Promise<SettledSplit | null> {
  const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
  const logs = parseEventLogs({
    abi: TICKET_RESALE_ABI,
    logs: receipt.logs,
    eventName: "TicketSettled",
  });
  if (logs.length === 0) return null;
  const args = logs[0].args as {
    agreedPrice: bigint;
    sellerAmount: bigint;
    royaltyAmount: bigint;
    royaltyReceiver: string;
    platformAmount: bigint;
  };
  return {
    agreedPrice:     Number(args.agreedPrice) / 1_000_000,
    sellerAmount:    Number(args.sellerAmount) / 1_000_000,
    royaltyAmount:   Number(args.royaltyAmount) / 1_000_000,
    royaltyReceiver: args.royaltyReceiver,
    platformAmount:  Number(args.platformAmount) / 1_000_000,
  };
}

// ── Freeze — operator (owner or treasury) ────────────────────────────────────

export async function freezeTicketOnChain(tokenId: number, finalURI: string): Promise<`0x${string}`> {
  const { nft } = getAddresses();
  const client = await getOwnerClient();
  const txHash = await client.writeContract({
    address: nft,
    abi: TICKET_NFT_ABI,
    functionName: "freeze",
    args: [BigInt(tokenId), finalURI],
  });
  await publicClient.waitForTransactionReceipt({ hash: txHash });
  return txHash;
}

// ── Calldata helpers — encoded for frontend (seller's embedded wallet) ────────
// These return ABI-encoded calldata; the frontend signs and submits via Privy.

export function getApproveCalldata(tokenId: number, spender: `0x${string}`): `0x${string}` {
  return encodeFunctionData({
    abi: TICKET_NFT_ABI,
    functionName: "approve",
    args: [spender, BigInt(tokenId)],
  });
}

export function getListTicketCalldata(
  tokenId: number,
  priceUsdc: number,
  paymentToken: `0x${string}`,
  expiresAt: number
): `0x${string}` {
  return encodeFunctionData({
    abi: TICKET_RESALE_ABI,
    functionName: "listTicket",
    args: [BigInt(tokenId), BigInt(Math.round(priceUsdc * 1_000_000)), paymentToken, BigInt(expiresAt)],
  });
}

export function getCancelListingCalldata(onchainListingId: number): `0x${string}` {
  return encodeFunctionData({
    abi: TICKET_RESALE_ABI,
    functionName: "cancelListing",
    args: [BigInt(onchainListingId)],
  });
}
