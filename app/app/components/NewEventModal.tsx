"use client";

import { useEffect, useState } from "react";
import { Modal } from "./ui/Modal";
import { Field, TextareaField, SelectField } from "./ui/Field";
import { RangeField } from "./ui/RangeField";
import { Button } from "./ui/Button";
import { getSocialHalfQuotaBps, isSocialHalfMandatory } from "@/lib/socialHalfQuota";

export interface NewEventForm {
  title: string;
  description: string;
  venue: string;
  city: string;
  country: string;
  state: string;
  coverImageUrl: string;
  coverVideoUrl: string;
  eventDate: string;
  endDate: string;
  ticketPriceUsdc: string;
  maxTickets: string;
  category: string;
  subcategory: string;
  lineup: string;
  doorsOpenAt: string;
  reservedTickets: string;
  hasSocialHalf: boolean;
  socialHalfBps: string;
}

const EMPTY_FORM: NewEventForm = {
  title: "", description: "", venue: "", city: "", country: "BR", state: "",
  coverImageUrl: "", coverVideoUrl: "",
  eventDate: "", endDate: "", ticketPriceUsdc: "", maxTickets: "",
  category: "OUTRO", subcategory: "", lineup: "", doorsOpenAt: "",
  reservedTickets: "", hasSocialHalf: false, socialHalfBps: "",
};

// UF — só usada pra hierarquia da cota de meia (§5.5/D24); "sem UF" cai pra
// cota do país. Fora do escopo desta fatia expor país (hoje só existe BR).
const UF_OPTIONS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

const CATEGORY_OPTIONS = [
  { value: "SHOW", label: "Show" },
  { value: "FESTIVAL", label: "Festival" },
  { value: "TEATRO", label: "Teatro" },
  { value: "ESPORTE", label: "Esporte" },
  { value: "CONFERENCIA", label: "Conferência" },
  { value: "OUTRO", label: "Outro" },
];

const STEPS = [
  { n: 1, label: "Informações gerais" },
  { n: 2, label: "Dados do ingresso" },
  { n: 3, label: "Customizações" },
] as const;

const DRAFT_KEY = "tessera:new-event-draft";

function step1Valid(f: NewEventForm): boolean {
  return !!(f.title && f.venue && f.city && f.eventDate && f.endDate && f.endDate > f.eventDate);
}
function step2Valid(f: NewEventForm): boolean {
  const price = parseFloat(f.ticketPriceUsdc);
  return Number.isFinite(price) && price > 0;
}

// Modal de criação de evento em 3 passos — PLANO_EVOLUCAO_V2.md §4.3.
// Step 2 já nasce na forma final (uma linha só, hoje) porque a Onda 3 vai
// preencher essa mesma estrutura com lotes/áreas/dias em vez de refazer a
// tela (TicketType ainda não existe no schema — preço e capacidade seguem
// únicos por evento até lá).
export function NewEventModal({
  open,
  onClose,
  onCreated,
  authFetch,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (event: unknown) => void;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [form, setForm] = useState<NewEventForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reabrir retoma o rascunho salvo — perder um formulário de 3 passos por
  // fechar sem querer (ou refresh) é inaceitável. Ajuste de estado durante o
  // render em resposta à prop `open` mudando, não um efeito.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setStep(1);
      setError(null);
      try {
        const raw = localStorage.getItem(DRAFT_KEY);
        setForm(raw ? { ...EMPTY_FORM, ...JSON.parse(raw) } : EMPTY_FORM);
      } catch {
        setForm(EMPTY_FORM);
      }
    }
  }

  useEffect(() => {
    if (!open) return;
    localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
  }, [open, form]);

  const set = <K extends keyof NewEventForm>(key: K, value: NewEventForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // PLANO_EVOLUCAO_V2.md §10.3-10.4/D38-D39 — trocar a categoria pode LIGAR
  // meia-entrada obrigatória. O servidor valida de qualquer jeito, mas forçar
  // aqui também evita o organizador digitar um valor que vai ser rejeitado.
  // Teto de revenda não depende mais de categoria — é sempre 100% (§10.2/A14).
  const setCategory = (cat: string) =>
    setForm((f) => ({
      ...f,
      category: cat,
      hasSocialHalf: isSocialHalfMandatory(cat) ? true : f.hasSocialHalf,
    }));

  const goNext = () => {
    if (step === 1 && !step1Valid(form)) { setError("Preencha título, endereço, cidade, e as datas de início e término (término precisa ser depois do início)."); return; }
    if (step === 2 && !step2Valid(form)) { setError("Informe um preço de ingresso válido."); return; }
    setError(null);
    setStep((s) => (s === 3 ? s : ((s + 1) as 2 | 3)));
  };
  const goBack = () => { setError(null); setStep((s) => (s === 1 ? s : ((s - 1) as 1 | 2))); };

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    const r = await authFetch("/api/organizer/events", {
      method: "POST",
      body: JSON.stringify({
        ...form,
        ticketPriceUsdc: parseFloat(form.ticketPriceUsdc),
        maxTickets: form.maxTickets ? parseInt(form.maxTickets) : null,
      }),
    });
    const d = await r.json();
    setSubmitting(false);
    if (!r.ok) { setError(d.error ?? "Erro ao criar evento"); return; }
    localStorage.removeItem(DRAFT_KEY);
    setForm(EMPTY_FORM);
    onCreated(d.event);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Novo evento" size="large">
      <div className="flex flex-col gap-6">
        {/* Breadcrumb — só volta livremente; avançar exige o passo atual válido. */}
        <div className="flex items-center gap-2 text-sm">
          {STEPS.map((s, i) => (
            <div key={s.n} className="flex items-center gap-2">
              {i > 0 && <span className="text-text-muted">›</span>}
              <button
                type="button"
                disabled={s.n > step}
                onClick={() => s.n < step && setStep(s.n)}
                className={`rounded-full px-3 py-1 font-medium ${
                  s.n === step
                    ? "bg-laranja-500 text-noite-800"
                    : s.n < step
                    ? "text-text underline decoration-dotted hover:text-ouro-400"
                    : "text-text-muted"
                }`}
              >
                {s.n}. {s.label}
              </button>
            </div>
          ))}
        </div>

        {step === 1 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Título do evento" value={form.title} onChange={(e) => set("title", e.target.value)} />
            <Field label="Cidade" value={form.city} onChange={(e) => set("city", e.target.value)} />
            <SelectField
              label="UF (define a cota de meia-entrada do evento)"
              value={form.state}
              onChange={(e) => set("state", e.target.value)}
            >
              <option value="">Sem UF — usa a cota nacional</option>
              {UF_OPTIONS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
            </SelectField>
            <Field
              label="Endereço / local"
              className="sm:col-span-2"
              value={form.venue}
              onChange={(e) => set("venue", e.target.value)}
            />
            <Field
              label="Data e hora de início"
              type="datetime-local"
              value={form.eventDate}
              onChange={(e) => set("eventDate", e.target.value)}
            />
            <Field
              label="Data e hora de término"
              type="datetime-local"
              min={form.eventDate || undefined}
              value={form.endDate}
              onChange={(e) => set("endDate", e.target.value)}
            />
            <SelectField label="Categoria" value={form.category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </SelectField>
            <Field
              label="Subcategoria (opcional)"
              placeholder="Rock, Stand-up…"
              value={form.subcategory}
              onChange={(e) => set("subcategory", e.target.value)}
            />
          </div>
        )}

        {step === 2 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              label="Preço do ingresso (USDC)"
              type="number"
              min="0.01"
              step="0.01"
              value={form.ticketPriceUsdc}
              onChange={(e) => set("ticketPriceUsdc", e.target.value)}
            />
            <Field
              label="Quantidade máxima (opcional — em branco = sem limite)"
              type="number"
              min="1"
              value={form.maxTickets}
              onChange={(e) => set("maxTickets", e.target.value)}
            />
            {/* PLANO_EVOLUCAO_V2.md §10.2/A11-A14 — teto de revenda sempre
                travado em 100% da face, em toda categoria; não é mais escolha
                do organizador. Acima disso, a plataforma pode cobrar uma taxa
                de intermediação destacada (até 20%, lib/resaleCap.ts), somada
                por cima do valor pago ao comprador — nunca embutida aqui. */}
            <div className="sm:col-span-2 flex flex-col gap-1">
              <span className="text-sm font-medium text-text">Teto de revenda</span>
              <p className="text-sm text-text">
                Travado em 100% do preço original em qualquer categoria — o vendedor nunca recebe
                acima da face. A plataforma pode cobrar uma taxa de intermediação por cima, mostrada
                separadamente pro comprador no anúncio.
              </p>
            </div>
            {/* Lotes, áreas e ingresso por dia chegam com o modelo TicketType
                (Onda 3) — hoje o evento tem um preço e uma capacidade só. */}
            {(() => {
              const mandatory = isSocialHalfMandatory(form.category);
              const legalQuotaPct = getSocialHalfQuotaBps("BR", form.state || null) / 100;
              const checked = mandatory || form.hasSocialHalf;
              const currentPct = form.socialHalfBps ? Number(form.socialHalfBps) / 100 : legalQuotaPct;

              return (
                <div className="sm:col-span-2 flex flex-col gap-1.5">
                  {form.maxTickets ? (
                    // Com capacidade definida, o organizador pode oferecer MAIS
                    // que a cota legal — checkbox binário não expressa isso.
                    <RangeField
                      label={`Meia-entrada — ${checked ? `${currentPct}%` : "desativada"}`}
                      min={mandatory ? 40 : 0}
                      max={100}
                      step={5}
                      value={checked ? currentPct : 0}
                      onChange={(e) => {
                        const pct = Number(e.target.value);
                        const active = mandatory || pct > 0;
                        setForm((f) => ({
                          ...f,
                          hasSocialHalf: active,
                          socialHalfBps: active ? String(pct * 100) : "",
                        }));
                      }}
                      hint={
                        checked
                          ? `= ${Math.floor((Number(form.maxTickets) * currentPct) / 100)} de ${form.maxTickets} ingressos`
                          : "Arraste para oferecer meia-entrada"
                      }
                    />
                  ) : (
                    // Sem capacidade, não há total sobre o que calcular
                    // percentual — 40% de "ilimitado" não é um número.
                    <label className="flex items-center gap-2 text-sm text-text">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={mandatory}
                        onChange={(e) => set("hasSocialHalf", e.target.checked)}
                        className="h-4 w-4 rounded border-border-strong accent-ouro-500 disabled:opacity-60"
                      />
                      Este evento tem meia-entrada
                    </label>
                  )}
                  {mandatory && (
                    <p className="text-xs text-text-muted">
                      Obrigatório para esta categoria — Lei 12.933/2013 assegura o benefício em pelo
                      menos 40% dos ingressos de espetáculo artístico-cultural ou esportivo.
                    </p>
                  )}
                  {checked && (
                    <p className="text-xs text-text-muted">
                      Cota legal de referência: {legalQuotaPct}%
                      {form.state ? ` (${form.state})` : " (padrão nacional)"} — ingresso de meia é
                      nominal e não pode ser revendido.
                    </p>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {step === 3 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              label="Abertura dos portões (opcional)"
              type="datetime-local"
              value={form.doorsOpenAt}
              onChange={(e) => set("doorsOpenAt", e.target.value)}
            />
            <Field
              label="Line-up / atrações (opcional)"
              value={form.lineup}
              onChange={(e) => set("lineup", e.target.value)}
            />
            <Field
              label="URL da imagem de capa (opcional)"
              value={form.coverImageUrl}
              onChange={(e) => set("coverImageUrl", e.target.value)}
            />
            <Field
              label="URL do vídeo de capa (opcional — só no carrossel de destaque)"
              value={form.coverVideoUrl}
              onChange={(e) => set("coverVideoUrl", e.target.value)}
            />
            {form.maxTickets ? (
              // PLANO_EVOLUCAO_V2.md §10.5/D40 — segurar vaga só existe com
              // teto (é o que se subtrai da oferta pública).
              <Field
                label="Qtd. de vagas a reservar (opcional)"
                type="number"
                min="0"
                placeholder="Uso próprio, imprensa, cortesias…"
                value={form.reservedTickets}
                onChange={(e) => set("reservedTickets", e.target.value)}
              />
            ) : (
              // Sem teto não há o que segurar — mas presentear (nomear um
              // beneficiário, que ganha ingresso + colecionável) continua
              // valendo em qualquer evento, feito depois na tabela de eventos.
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-text">Ingressos reservados</span>
                <p className="text-sm text-text-muted">
                  Este evento não tem quantidade máxima, então não há vaga pra segurar. Você ainda
                  pode presentear alguém depois de criar o evento, na tabela de &quot;Meus eventos&quot;.
                </p>
              </div>
            )}
            <TextareaField
              label="Descrição (opcional)"
              className="col-span-full h-24"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>
        )}

        {error && <p className="text-sm text-erro-on-dark">{error}</p>}

        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={goBack} disabled={step === 1 || submitting}>
            Voltar
          </Button>
          {step < 3 ? (
            <Button onClick={goNext}>Continuar</Button>
          ) : (
            <Button onClick={submit} disabled={submitting}>
              {submitting ? "Enviando…" : "Submeter para aprovação"}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
