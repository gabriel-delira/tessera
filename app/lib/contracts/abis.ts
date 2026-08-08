// PLANO_EVOLUCAO_V2.md §5.2 / A1 opção (a): um Event agrupa N TicketType
// (área × dia × lote). O evento continua com um único RoyaltySplitter.
const TICKET_TYPE_INPUT = {
  type: "tuple",
  components: [
    { name: "price",      type: "uint256" },
    { name: "maxTickets", type: "uint256" },
    { name: "salesEndAt", type: "uint256" },
    { name: "label",      type: "string"  },
  ],
} as const;

export const TICKET_SALE_ABI = [
  {
    type: "function",
    name: "createEvent",
    inputs: [
      { name: "organizer",          type: "address" },
      { name: "paymentToken",       type: "address" },
      { name: "platformFeeBps",     type: "uint256" },
      { name: "maxTickets",         type: "uint256" },
      { name: "eventName",          type: "string"  },
      { name: "eventTimestamp",     type: "uint256" },
      { name: "royaltyBps",         type: "uint96"  },
      { name: "royaltyOrgShareBps", type: "uint256" },
      { ...TICKET_TYPE_INPUT, name: "types", type: "tuple[]" },
    ],
    outputs: [{ name: "eventId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "addTicketType",
    inputs: [
      { name: "eventId", type: "uint256" },
      { ...TICKET_TYPE_INPUT, name: "t" },
    ],
    outputs: [{ name: "typeId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "buyTicketFor",
    inputs: [
      { name: "eventId",   type: "uint256" },
      { name: "typeId",    type: "uint256" },
      { name: "recipient", type: "address" },
    ],
    outputs: [{ name: "tokenId", type: "uint256" }],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "toggleEventPause",
    inputs: [{ name: "eventId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "toggleTicketTypePause",
    inputs: [
      { name: "eventId", type: "uint256" },
      { name: "typeId",  type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "events",
    inputs: [{ name: "eventId", type: "uint256" }],
    outputs: [
      { name: "organizer",      type: "address" },
      { name: "paymentToken",   type: "address" },
      { name: "platformFeeBps", type: "uint256" },
      { name: "maxTickets",     type: "uint256" },
      { name: "soldTickets",    type: "uint256" },
      { name: "paused",         type: "bool"    },
      { name: "eventName",      type: "string"  },
      { name: "eventTimestamp", type: "uint256" },
      { name: "royaltyBps",     type: "uint96"  },
      { name: "royaltySplitter",type: "address" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "ticketTypeCount",
    inputs: [{ name: "eventId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getTicketType",
    inputs: [
      { name: "eventId", type: "uint256" },
      { name: "typeId",  type: "uint256" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "price",       type: "uint256" },
          { name: "maxTickets",  type: "uint256" },
          { name: "soldTickets", type: "uint256" },
          { name: "salesEndAt",  type: "uint256" },
          { name: "paused",      type: "bool"    },
          { name: "label",       type: "string"  },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "EventCreated",
    inputs: [
      { name: "eventId",        type: "uint256", indexed: true  },
      { name: "organizer",      type: "address", indexed: true  },
      { name: "maxTickets",     type: "uint256", indexed: false },
      { name: "royaltySplitter",type: "address", indexed: false },
    ],
  },
  {
    type: "event",
    name: "TicketTypeAdded",
    inputs: [
      { name: "eventId",    type: "uint256", indexed: true  },
      { name: "typeId",     type: "uint256", indexed: true  },
      { name: "price",      type: "uint256", indexed: false },
      { name: "maxTickets", type: "uint256", indexed: false },
      { name: "label",      type: "string",  indexed: false },
    ],
  },
  {
    type: "event",
    name: "TicketSold",
    inputs: [
      { name: "eventId", type: "uint256", indexed: true  },
      { name: "buyer",   type: "address", indexed: true  },
      { name: "tokenId", type: "uint256", indexed: true  },
      { name: "typeId",  type: "uint256", indexed: false },
      { name: "amount",  type: "uint256", indexed: false },
    ],
  },
] as const;

export const TICKET_NFT_ABI = [
  {
    type: "function",
    name: "setBaseURI",
    inputs: [{ name: "baseURI_", type: "string" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "to",      type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setApprovalForAll",
    inputs: [
      { name: "operator", type: "address" },
      { name: "approved", type: "bool"    },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "freeze",
    inputs: [
      { name: "tokenId",  type: "uint256" },
      { name: "finalURI", type: "string"  },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "frozen",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "ownerOf",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getTicketData",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "eventId",       type: "uint256" },
          { name: "eventName",     type: "string"  },
          { name: "ticketNumber",  type: "uint256" },
          { name: "totalTickets",  type: "uint256" },
          { name: "seat",          type: "string"  },
          { name: "eventTimestamp",type: "uint256" },
          { name: "organizer",     type: "address" },
          { name: "facePrice",     type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "TicketMinted",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true  },
      { name: "eventId", type: "uint256", indexed: true  },
      { name: "buyer",   type: "address", indexed: true  },
    ],
  },
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from",    type: "address", indexed: true  },
      { name: "to",      type: "address", indexed: true  },
      { name: "tokenId", type: "uint256", indexed: true  },
    ],
  },
] as const;

export const TICKET_RESALE_ABI = [
  {
    type: "function",
    name: "listTicket",
    inputs: [
      { name: "tokenId",      type: "uint256" },
      { name: "price",        type: "uint256" },
      { name: "paymentToken", type: "address" },
      { name: "expiresAt",    type: "uint256" },
    ],
    outputs: [{ name: "listingId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "cancelListing",
    inputs: [{ name: "listingId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "lockListing",
    inputs: [
      { name: "listingId", type: "uint256" },
      { name: "buyer",     type: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "unlockListing",
    inputs: [{ name: "listingId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    // Fluxo Cripto (LAYOUT_UPDATE.md §5.7) — tesouraria paga em USDC pelo
    // listingId.price e o próprio contrato faz o split atômico. Requer
    // aprovação prévia da tesouraria para o contrato de resale gastar USDC
    // (setup operacional, fora do código do app).
    type: "function",
    name: "buyListedTicketFor",
    inputs: [
      { name: "listingId", type: "uint256" },
      { name: "recipient", type: "address" },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "settleListedTicket",
    inputs: [
      { name: "listingId",   type: "uint256" },
      { name: "recipient",   type: "address" },
      { name: "agreedPrice", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "listings",
    inputs: [{ name: "listingId", type: "uint256" }],
    outputs: [
      { name: "seller",       type: "address" },
      { name: "tokenId",      type: "uint256" },
      { name: "price",        type: "uint256" },
      { name: "paymentToken", type: "address" },
      { name: "expiresAt",    type: "uint256" },
      { name: "active",       type: "bool"    },
      { name: "locked",       type: "bool"    },
      { name: "lockedBuyer",  type: "address" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "setSettler",
    inputs: [{ name: "_settler", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "TicketListed",
    inputs: [
      { name: "listingId", type: "uint256", indexed: true  },
      { name: "seller",    type: "address", indexed: true  },
      { name: "tokenId",   type: "uint256", indexed: true  },
      { name: "price",     type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ListingLocked",
    inputs: [
      { name: "listingId", type: "uint256", indexed: true  },
      { name: "buyer",     type: "address", indexed: true  },
    ],
  },
  {
    type: "event",
    name: "ListingCancelled",
    inputs: [
      { name: "listingId", type: "uint256", indexed: true },
    ],
  },
  {
    // LAYOUT_UPDATE.md §5.7.2 — atestado on-chain do split, gravado na mesma
    // transação que já transferia o NFT no fluxo de pagamento off-chain.
    type: "event",
    name: "TicketSettled",
    inputs: [
      { name: "listingId",       type: "uint256", indexed: true },
      { name: "recipient",       type: "address", indexed: true },
      { name: "tokenId",         type: "uint256", indexed: true },
      { name: "agreedPrice",     type: "uint256" },
      { name: "sellerAmount",    type: "uint256" },
      { name: "royaltyAmount",   type: "uint256" },
      { name: "royaltyReceiver", type: "address" },
      { name: "platformAmount",  type: "uint256" },
    ],
  },
] as const;

export const ERC20_ABI = [
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount",  type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "allowance",
    inputs: [
      { name: "owner",   type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;
