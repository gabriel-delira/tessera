"use client";

import { useEffect, useState } from "react";
import { Panel } from "./ui/Panel";
import { Button } from "./ui/Button";
import { Field, SelectField } from "./ui/Field";

interface SlotView {
  id: string;
  label: string | null;
  event: { id: string; title: string; eventDate: string };
}

interface CollectionView {
  id: string;
  title: string;
  description: string | null;
  slots: SlotView[];
}

// Álbum de figurinhas — PLANO_EVOLUCAO_V2.md §6.2/D15. O organizador cria a
// Collection (a série, ex.: "Show Retrô — Edições") e anexa Events já
// existentes dele como Slots (cada edição/ano). Sem auto-detecção: decisão
// explícita, pra não depender de heurística de título.
export function CollectionsManager({
  organizerEvents,
  authFetch,
}: {
  organizerEvents: { id: string; title: string; eventDate: string }[];
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}) {
  const [collections, setCollections] = useState<CollectionView[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const r = await authFetch("/api/organizer/collections");
    if (!r.ok) { setLoading(false); return; }
    const d = await r.json();
    setCollections(d.collections ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const createCollection = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    setError(null);
    const r = await authFetch("/api/organizer/collections", {
      method: "POST",
      body: JSON.stringify({ title: newTitle.trim() }),
    });
    const d = await r.json();
    setCreating(false);
    if (!r.ok) { setError(d.error ?? "Erro ao criar coleção"); return; }
    setCollections((prev) => [{ ...d.collection }, ...prev]);
    setNewTitle("");
  };

  const addSlot = async (collectionId: string) => {
    if (!selectedEventId) return;
    setError(null);
    const r = await authFetch(`/api/organizer/collections/${collectionId}/slots`, {
      method: "POST",
      body: JSON.stringify({ eventId: selectedEventId }),
    });
    const d = await r.json();
    if (!r.ok) { setError(d.error ?? "Erro ao adicionar edição"); return; }
    setCollections((prev) =>
      prev.map((c) => (c.id === collectionId ? { ...c, slots: [...c.slots, d.slot] } : c))
    );
    setAddingTo(null);
    setSelectedEventId("");
  };

  const removeSlot = async (collectionId: string, slotId: string) => {
    const r = await authFetch(`/api/organizer/collections/${collectionId}/slots/${slotId}`, { method: "DELETE" });
    if (!r.ok) return;
    setCollections((prev) =>
      prev.map((c) => (c.id === collectionId ? { ...c, slots: c.slots.filter((s) => s.id !== slotId) } : c))
    );
  };

  if (loading) return null;

  return (
    <Panel title="Coleções (álbum de figurinhas)" className="mt-8">
      <div className="flex flex-col gap-6">
        <p className="text-sm text-text-muted">
          Agrupe edições do mesmo evento (ex.: anos de uma turnê) numa coleção. Quem foi em algumas
          edições mas não em outras vê o slot vazio no álbum, com link pra Revenda se houver anúncio.
        </p>

        <div className="flex items-end gap-2">
          <Field
            label="Nova coleção"
            placeholder="Show Retrô — Edições"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="flex-1"
          />
          <Button onClick={createCollection} disabled={creating || !newTitle.trim()}>
            {creating ? "Criando…" : "Criar"}
          </Button>
        </div>

        {error && <p className="text-xs text-erro-on-dark">{error}</p>}

        {collections.length === 0 ? (
          <p className="text-sm text-text-muted">Nenhuma coleção ainda.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {collections.map((c) => {
              const availableEvents = organizerEvents.filter(
                (e) => !c.slots.some((s) => s.event.id === e.id)
              );
              return (
                <div key={c.id} className="rounded-lg border border-border p-4">
                  <p className="font-display text-text">{c.title}</p>
                  <div className="mt-2 flex flex-col gap-1.5">
                    {c.slots.map((s) => (
                      <div key={s.id} className="flex items-center justify-between text-sm">
                        <span className="text-text">
                          {s.label ?? s.event.title} — {new Date(s.event.eventDate).toLocaleDateString("pt-BR")}
                        </span>
                        <button
                          onClick={() => removeSlot(c.id, s.id)}
                          className="text-xs text-erro-on-dark underline"
                        >
                          Remover
                        </button>
                      </div>
                    ))}
                    {c.slots.length === 0 && <p className="text-xs text-text-muted">Nenhuma edição ainda.</p>}
                  </div>

                  {addingTo === c.id ? (
                    <div className="mt-3 flex items-end gap-2">
                      <SelectField
                        label="Evento"
                        value={selectedEventId}
                        onChange={(e) => setSelectedEventId(e.target.value)}
                        className="flex-1"
                      >
                        <option value="">Selecione…</option>
                        {availableEvents.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.title} ({new Date(e.eventDate).toLocaleDateString("pt-BR")})
                          </option>
                        ))}
                      </SelectField>
                      <Button size="sm" onClick={() => addSlot(c.id)} disabled={!selectedEventId}>
                        Adicionar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setAddingTo(null); setSelectedEventId(""); }}>
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="mt-3"
                      onClick={() => setAddingTo(c.id)}
                      disabled={availableEvents.length === 0}
                    >
                      Adicionar edição
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Panel>
  );
}
