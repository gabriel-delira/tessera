import Link from "next/link";
import { Icon } from "./Icon";

export interface CollectionSlotView {
  slotId: string;
  eventId: string;
  label: string;
  eventDate: string;
  city: string;
  coverImageUrl: string | null;
  filled: boolean;
  tokenId: number | null;
  listingId: string | null;
}

export interface CollectionView {
  id: string;
  title: string;
  slots: CollectionSlotView[];
}

// Álbum de figurinhas — PLANO_EVOLUCAO_V2.md §6.2/D15. A figurinha faltante
// (slot vazio) é o motor de demanda: mostra a silhueta e, se existir anúncio
// da mesma edição na Revenda, o link pra comprar.
export function CollectionShelf({ collection }: { collection: CollectionView }) {
  const filledCount = collection.slots.filter((s) => s.filled).length;

  return (
    <div>
      <div className="mb-3 flex items-baseline gap-2">
        <h3 className="font-display text-lg text-text">{collection.title}</h3>
        <span className="text-xs text-text-muted">{filledCount} de {collection.slots.length}</span>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {collection.slots.map((s) => {
          const art = s.coverImageUrl ?? (s.tokenId !== null ? `/api/tickets/${s.tokenId}/art.svg` : null);
          return (
            <div
              key={s.slotId}
              className={`flex flex-col overflow-hidden rounded-lg border text-left ${
                s.filled ? "border-border bg-surface" : "border-dashed border-border-strong bg-surface/40"
              }`}
            >
              <div
                className="relative flex items-center justify-center"
                style={{
                  height: 110,
                  borderRadius: "var(--radius-arch)",
                  backgroundImage: art ? `url(${art})` : undefined,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              >
                {!s.filled && <Icon name="quadrifolio" className="h-10 w-10 text-text-muted opacity-40" />}
              </div>
              <div className="px-3 py-2.5">
                <p className={`truncate font-display text-sm ${s.filled ? "text-text" : "text-text-muted"}`}>
                  {s.label}
                </p>
                <p className="truncate text-xs text-text-muted">
                  {new Date(s.eventDate).toLocaleDateString("pt-BR")} · {s.city}
                </p>
                {!s.filled && s.listingId && (
                  <Link href="/revenda?tab=collectibles" className="mt-1 block text-xs text-violeta-300 underline">
                    Ver na Revenda
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
