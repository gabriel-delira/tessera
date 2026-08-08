import { ShelfItem } from "./ShelfItem";
import { SlotPlaceholder } from "./SlotPlaceholder";

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

// Prateleira de coleção — mostrada como seção própria antes da listagem de
// ingressos (fora do álbum paginado), não mais como uma página dele.
export function CollectionShelf({
  collection,
  onSelect,
  hideEmptySlots,
}: {
  collection: CollectionView;
  onSelect: (tokenId: number) => void;
  // Lista mostra só o que o usuário já tem — os placeholders de "falta
  // comprar" só fazem sentido no Álbum, onde a coleção é o produto em si.
  hideEmptySlots?: boolean;
}) {
  const filledCount = collection.slots.filter((s) => s.filled).length;
  if (hideEmptySlots && filledCount === 0) return null;

  const visibleSlots = hideEmptySlots ? collection.slots.filter((s) => s.filled) : collection.slots;

  return (
    <div>
      <div className="mb-3 flex items-baseline gap-2">
        <h3 className="font-display text-lg text-text">{collection.title}</h3>
        <span className="text-xs text-text-muted">{filledCount} de {collection.slots.length}</span>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {visibleSlots.map((s, i) =>
          s.filled && s.tokenId !== null ? (
            <ShelfItem
              key={s.slotId}
              tokenId={s.tokenId}
              coverImageUrl={s.coverImageUrl}
              title={s.label}
              subtitle={`${new Date(s.eventDate).toLocaleDateString("pt-BR")} · ${s.city}`}
              onClick={() => onSelect(s.tokenId!)}
            />
          ) : (
            <SlotPlaceholder
              key={s.slotId}
              index={i}
              label={s.label}
              eventDate={s.eventDate}
              city={s.city}
              eventId={s.eventId}
              listingId={s.listingId}
            />
          )
        )}
      </div>
    </div>
  );
}
