import Link from "next/link";
import { Icon } from "./Icon";
import { Button } from "./Button";

const gradients = ["var(--grad-energia)", "var(--grad-profundidade)", "var(--grad-legado)"];

// PLANO_EVOLUCAO_V2.md §9.4.2/D33 — o slot vazio é o motor de demanda do
// álbum: precisa nomear a figurinha que falta (label, data, cidade), não só
// mostrar uma silhueta cinza. "Ver na Revenda" é botão, não link discreto —
// é a única ação da página vazia.
export function SlotPlaceholder({
  index,
  label,
  eventDate,
  city,
  eventId,
  listingId,
}: {
  index: number;
  label: string;
  eventDate: string;
  city: string;
  eventId: string;
  listingId: string | null;
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-dashed border-border-strong bg-surface/40 text-left">
      <div
        className="flex items-center justify-center opacity-35"
        style={{
          height: 110,
          borderRadius: "var(--radius-arch)",
          background: gradients[index % gradients.length],
        }}
      >
        <Icon name="quadrifolio" className="h-10 w-10 text-luz-500" />
      </div>
      <div className="flex flex-1 flex-col gap-2 px-3 py-2.5">
        <div>
          <p className="truncate font-display text-sm text-text-muted">{label}</p>
          <p className="truncate text-xs text-text-muted">
            {new Date(eventDate).toLocaleDateString("pt-BR")} · {city}
          </p>
        </div>
        {listingId ? (
          <Link href={`/revenda?tab=collectibles&event=${eventId}`} className="mt-auto">
            <Button size="sm" variant="secondary" className="w-full">
              Ver na Revenda
            </Button>
          </Link>
        ) : (
          <p className="mt-auto text-[11px] text-text-muted">Ninguém está revendendo esta edição.</p>
        )}
      </div>
    </div>
  );
}
