import { describe, it, expect } from "vitest";
import { generateTicketArtSvg } from "@/lib/ticketArt";

/**
 * Domain (PLANO_EVOLUCAO_V2.md §6.1/D13): arte de ingresso gerada no
 * servidor, determinística — mesma entrada sempre produz o mesmo SVG, sem
 * storage nem randomização.
 */
const base = {
  tokenId: 9200,
  eventTitle: "Show Retrô — Anos 80",
  ticketNumber: 101,
  city: "São Paulo",
  eventDateIso: "2026-03-15T22:00:00.000Z",
  attended: false,
};

describe("lib/ticketArt — geração de SVG do ingresso", () => {
  it("é determinística: mesma entrada produz o mesmo SVG", () => {
    expect(generateTicketArtSvg(base)).toBe(generateTicketArtSvg({ ...base }));
  });

  it("inclui o número do ingresso com padding e o título escapado", () => {
    const svg = generateTicketArtSvg(base);
    expect(svg).toContain("0101");
    expect(svg).toContain("Show Retrô");
  });

  it("escapa XML de títulos com caracteres especiais", () => {
    const svg = generateTicketArtSvg({ ...base, eventTitle: 'Rock & "Roll" <Live>' });
    expect(svg).not.toContain("<Live>");
    expect(svg).toContain("&amp;");
    expect(svg).toContain("&lt;Live&gt;");
  });

  it("mostra o selo 'Você esteve lá' só quando attended", () => {
    expect(generateTicketArtSvg(base)).not.toContain("ESTEVE LÁ");
    expect(generateTicketArtSvg({ ...base, attended: true })).toContain("ESTEVE LÁ");
  });

  it("é um documento SVG válido (root <svg>, sem tags não fechadas óbvias)", () => {
    const svg = generateTicketArtSvg(base);
    expect(svg.trim().startsWith("<svg")).toBe(true);
    expect(svg.trim().endsWith("</svg>")).toBe(true);
  });
});
