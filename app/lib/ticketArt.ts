// Arte de ingresso gerada no servidor — PLANO_EVOLUCAO_V2.md §6.1/D13.
// Determinística (mesmos dados de entrada = mesmo SVG sempre), sem storage e
// sem dependência de rede — resolve de quebra as "imagens que não
// renderizam" no álbum (coverImageUrl nulo ou apontando pra host externo).
// O organizador pode sobrepor com arte custom via Event.coverImageUrl; esta
// função só entra quando ele não definiu uma.

const GRADIENT_PAIRS: [string, string][] = [
  ["#6B2FA3", "#FF6A00"], // --grad-energia
  ["#0C1324", "#6B2FA3"], // --grad-profundidade
  ["#FF6A00", "#C79A4A"], // --grad-legado
];

function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]!));
}

// Quebra o título em até 2 linhas de ~20 chars pra caber no cartão sem CSS.
function wrapTitle(title: string, maxLen = 20): [string, string] {
  if (title.length <= maxLen) return [title, ""];
  const words = title.split(" ");
  let line1 = "";
  let i = 0;
  while (i < words.length && (line1 + words[i]).length <= maxLen) {
    line1 += (line1 ? " " : "") + words[i];
    i++;
  }
  const line2 = words.slice(i).join(" ");
  return [line1 || title.slice(0, maxLen), line2.length > maxLen ? line2.slice(0, maxLen - 1) + "…" : line2];
}

export function generateTicketArtSvg(props: {
  tokenId: number;
  eventTitle: string;
  ticketNumber: number;
  city: string;
  eventDateIso: string;
  attended: boolean;
}): string {
  const { tokenId, eventTitle, ticketNumber, city, eventDateIso, attended } = props;
  const [from, to] = GRADIENT_PAIRS[tokenId % GRADIENT_PAIRS.length];
  const [titleLine1, titleLine2] = wrapTitle(eventTitle);
  const dateLabel = new Date(eventDateIso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const gradId = `g${tokenId}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
  <defs>
    <linearGradient id="${gradId}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${from}" />
      <stop offset="100%" stop-color="${to}" />
    </linearGradient>
  </defs>
  <rect width="800" height="800" fill="url(#${gradId})" />
  <rect x="24" y="24" width="752" height="752" rx="28" fill="none" stroke="#C79A4A" stroke-opacity="0.45" stroke-width="2" />
  <text x="400" y="360" text-anchor="middle" font-family="Georgia, serif" font-size="56" fill="#F5EFE3">${escapeXml(titleLine1)}</text>
  ${titleLine2 ? `<text x="400" y="425" text-anchor="middle" font-family="Georgia, serif" font-size="56" fill="#F5EFE3">${escapeXml(titleLine2)}</text>` : ""}
  <text x="400" y="480" text-anchor="middle" font-family="system-ui, sans-serif" font-size="24" letter-spacing="2" fill="#F5EFE3" fill-opacity="0.75">${escapeXml(dateLabel.toUpperCase())} · ${escapeXml(city.toUpperCase())}</text>
  <text x="400" y="700" text-anchor="middle" font-family="system-ui, sans-serif" font-size="20" letter-spacing="4" fill="#F5EFE3" fill-opacity="0.6">INGRESSO Nº ${String(ticketNumber).padStart(4, "0")}</text>
  ${attended ? `<g transform="translate(400,140)">
    <circle r="52" fill="none" stroke="#F5EFE3" stroke-width="2" stroke-opacity="0.85" />
    <circle r="44" fill="none" stroke="#F5EFE3" stroke-width="1" stroke-opacity="0.5" />
    <text x="0" y="-4" text-anchor="middle" font-family="system-ui, sans-serif" font-size="15" font-weight="bold" fill="#F5EFE3">VOCÊ</text>
    <text x="0" y="16" text-anchor="middle" font-family="system-ui, sans-serif" font-size="15" font-weight="bold" fill="#F5EFE3">ESTEVE LÁ</text>
  </g>` : ""}
</svg>`;
}
