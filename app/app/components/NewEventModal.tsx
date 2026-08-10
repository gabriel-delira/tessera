"use client";

import { useEffect, useState } from "react";
import { Modal } from "./ui/Modal";
import { Field, TextareaField, SelectField } from "./ui/Field";
import { RangeField } from "./ui/RangeField";
import { Button } from "./ui/Button";
import { getSocialHalfQuotaBps, isSocialHalfMandatory } from "@/lib/socialHalfQuota";

// Matriz de ingressos (dia × área × lote) — 2026-08-08. `TicketDim` é uma
// dimensão nomeada (dia OU área); `id` é gerado no cliente e nunca muda
// (renomear só troca `name`), é o que `MatrixRow.dayId`/`areaId` referenciam
// pra sobreviver a uma renomeação sem perder o preço já digitado. `null` em
// dayId/areaId = evento não usa aquela dimensão (passe único / área única).
export interface TicketDim {
  id: string;
  name: string;
  // Só em `ticketDays`: data de calendário "YYYY-MM-DD" daquele dia. É o que
  // permite a portaria saber qual dia do evento é hoje (lib/eventDay.ts) e,
  // com isso, barrar o ingresso do dia 2 apresentado no dia 1. Obrigatório
  // pra avançar do Step 2 quando o evento declara dias.
  date?: string | null;
}

export interface MatrixRow {
  // Conjunto de dias que este ingresso cobre: [] = evento sem dimensão de
  // dia; [d] = ingresso de um dia; [d1,d2,d3] = passe. Um passe é só uma
  // linha da matriz com mais de um dia — não uma entidade à parte.
  dayIds: string[];
  areaId: string | null;
  lotNumber: number;
  label: string;
  // Trava a regeneração automática do rótulo (renomear dia/área não
  // reescreve por cima do que o organizador editou à mão).
  labelTouched: boolean;
  priceUsdc: string;
  quantity: string;
  salesEndAt: string;
  // Minutos de entrada antecipada (perk do passe ultra). Vazio = sem perk.
  earlyEntryMinutes: string;
}

// Identidade de um grupo da matriz: mesmo conjunto de dias + mesma área.
// Ordenado pra [d2,d1] e [d1,d2] serem o mesmo grupo — espelha
// lib/ticketMatrix.ts:groupKey, que é quem decide isso no servidor.
function rowGroupKey(dayIds: string[], areaId: string | null): string {
  return `${[...dayIds].sort().join("|")}::${areaId ?? ""}`;
}

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
  ticketDays: TicketDim[];
  ticketAreas: TicketDim[];
  matrixRows: MatrixRow[];
  maxTicketsPerAccount: string;
  category: string;
  subcategory: string;
  lineup: string;
  doorsOpenAt: string;
  reservedTickets: string;
  hasSocialHalf: boolean;
  socialHalfBps: string;
}

function genDimId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// Pré-preenche a data do N-ésimo dia como "início do evento + N dias". Quase
// sempre é o que o organizador quer (dias consecutivos), e ele
// pode corrigir — melhor que obrigar a digitar 3 datas na mão. `eventDate`
// vem do Step 1 como datetime-local ("YYYY-MM-DDTHH:mm").
function defaultDayDate(eventDate: string, index: number): string {
  const base = eventDate.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(base)) return "";
  const d = new Date(`${base}T12:00:00Z`); // meio-dia: imune a DST
  d.setUTCDate(d.getUTCDate() + index);
  return d.toISOString().slice(0, 10);
}

// Rótulo auto-gerado a partir das 3 dimensões — "Pista — Dia 1 — Lote 2".
// `groupLotCount` só entra no rótulo quando o grupo tem mais de um lote; um
// grupo com lote único não precisa dizer "Lote 1" toda hora.
//
// Passe (mais de um dia) não lista os dias no rótulo: "Pista — Dia 1, Dia 2,
// Dia 3" fica ilegível e envelhece mal quando o organizador renomeia um dia.
// Vira "Passe 3 dias", que é como o ingresso é vendido de verdade.
function computeLabel(
  dayIds: string[],
  areaId: string | null,
  lotNumber: number,
  days: TicketDim[],
  areas: TicketDim[],
  groupLotCount: number
): string {
  const parts: string[] = [];
  const area = areas.find((a) => a.id === areaId);
  if (area) parts.push(area.name);
  if (dayIds.length > 1) {
    parts.push(dayIds.length === days.length ? "Passe completo" : `Passe ${dayIds.length} dias`);
  } else {
    const day = days.find((d) => d.id === dayIds[0]);
    if (day) parts.push(day.name);
  }
  if (groupLotCount > 1) parts.push(`Lote ${lotNumber}`);
  return parts.length ? parts.join(" — ") : "Inteira";
}

function makeRow(dayIds: string[], areaId: string | null, lotNumber: number, days: TicketDim[], areas: TicketDim[], groupLotCount: number): MatrixRow {
  return {
    dayIds, areaId, lotNumber,
    label: computeLabel(dayIds, areaId, lotNumber, days, areas, groupLotCount),
    labelTouched: false, priceUsdc: "", quantity: "", salesEndAt: "", earlyEntryMinutes: "",
  };
}

const EMPTY_FORM: NewEventForm = {
  title: "", description: "", venue: "", city: "", country: "BR", state: "",
  coverImageUrl: "", coverVideoUrl: "",
  eventDate: "", endDate: "",
  ticketDays: [], ticketAreas: [], matrixRows: [makeRow([], null, 1, [], [], 1)], maxTicketsPerAccount: "",
  category: "OUTRO", subcategory: "", lineup: "", doorsOpenAt: "",
  reservedTickets: "", hasSocialHalf: false, socialHalfBps: "",
};

// Teto agregado do evento — só existe se TODO row tiver cota própria, igual
// PLANO_EVOLUCAO_V2.md §5.1/A8 calcula no backend (lib/ticketMatrixInput.ts).
// Usado só pra decidir o que mostrar no Step 2 (hint de meia) e Step 3
// (reserva) — o valor real que vai pro servidor é recalculado lá.
function computeAggregateMaxTickets(rows: MatrixRow[]): number | null {
  if (rows.some((r) => !r.quantity)) return null;
  return rows.reduce((sum, r) => sum + (parseInt(r.quantity) || 0), 0);
}

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

// Filtra linhas cujo dayId/areaId não bate mais com nenhuma dimensão atual
// (órfãs de um dia/área removido, ou de um bug de migração já corrigido em
// addDay/addArea) — invisíveis na tabela, mas que sem este filtro contariam
// pra validação do Step 2 com preço vazio, travando "Continuar" sem
// nenhuma linha visível pra explicar o motivo. Rascunhos salvos antes desse
// fix ainda podem carregar essas órfãs; isso os limpa na hora de validar/enviar.
function reachableRows(f: NewEventForm): MatrixRow[] {
  const dayIds = new Set(f.ticketDays.map((d) => d.id));
  const areaIds = new Set(f.ticketAreas.map((a) => a.id));
  return f.matrixRows.filter(
    (r) =>
      // Evento com dias: a linha precisa citar pelo menos um dia existente, e
      // nenhum dia fantasma. Sem dias: a linha não pode citar dia nenhum.
      (f.ticketDays.length === 0
        ? r.dayIds.length === 0
        : r.dayIds.length > 0 && r.dayIds.every((d) => dayIds.has(d))) &&
      (r.areaId === null ? f.ticketAreas.length === 0 : areaIds.has(r.areaId))
  );
}

function step2Valid(f: NewEventForm): boolean {
  const rows = reachableRows(f);
  if (rows.length === 0) return false;
  if (!rows.every((r) => Number.isFinite(parseFloat(r.priceUsdc)) && parseFloat(r.priceUsdc) > 0)) return false;
  // Dia sem data deixaria a portaria sem saber qual dia do evento é hoje.
  if (f.ticketDays.some((d) => !d.date)) return false;
  // Duas datas iguais tornam "qual dia é hoje" ambíguo — o servidor recusa
  // (lib/ticketMatrixInput.ts), então não deixa nem chegar lá.
  const dates = f.ticketDays.map((d) => d.date);
  return new Set(dates).size === dates.length;
}

// Rede de segurança: a tabela do Step 2 só renderiza grupos que TÊM linha, e
// um evento sem nenhuma dimensão só tem o grupo (null, null). Se `matrixRows`
// ficar vazio (ou sem a linha base do evento sem dimensão), o organizador vê
// uma tabela vazia e não consegue preencher preço/qtd nem avançar — sem nada
// na tela explicando o motivo. Rascunhos salvos no localStorage antes deste
// fix carregam exatamente esse estado, então normalizar na carga também.
function ensureBaseRow(f: NewEventForm): NewEventForm {
  if (reachableRows(f).length > 0) return f;
  return { ...f, ticketDays: [], ticketAreas: [], matrixRows: [makeRow([], null, 1, [], [], 1)] };
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
        // ensureBaseRow: rascunho salvo com a matriz vazia (bug de remover
        // todos os dias/áreas) voltaria quebrado do localStorage mesmo depois
        // do fix — normalizar na carga conserta quem já ficou preso.
        setForm(raw ? ensureBaseRow({ ...EMPTY_FORM, ...JSON.parse(raw) }) : EMPTY_FORM);
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

  // ── Matriz de ingressos (dia × área × lote) ─────────────────────────────────
  // Edições incrementais direto em `matrixRows` (nunca regeneração do zero a
  // partir de dias×áreas) — é isso que garante que renomear um dia/área ou
  // mudar o nº de lotes de UM grupo nunca apaga preço já digitado em outro.
  // Relabela TODOS os grupos de uma vez. Antes era por grupo (dayId, areaId),
  // mas com passes um mesmo dia participa de vários grupos — rastrear quais
  // relabelar virou mais frágil que só recomputar o que não foi editado à mão.
  const relabelAll = (rows: MatrixRow[], days: TicketDim[], areas: TicketDim[]): MatrixRow[] => {
    const countByGroup = new Map<string, number>();
    for (const r of rows) {
      const k = rowGroupKey(r.dayIds, r.areaId);
      countByGroup.set(k, (countByGroup.get(k) ?? 0) + 1);
    }
    return rows.map((r) =>
      r.labelTouched
        ? r
        : { ...r, label: computeLabel(r.dayIds, r.areaId, r.lotNumber, days, areas, countByGroup.get(rowGroupKey(r.dayIds, r.areaId)) ?? 1) }
    );
  };

  const addDay = () => {
    const newId = genDimId();
    const name = `Dia ${form.ticketDays.length + 1}`;
    setForm((f) => {
      const isFirstDay = f.ticketDays.length === 0;
      const ticketDays = [...f.ticketDays, { id: newId, name, date: defaultDayDate(f.eventDate, f.ticketDays.length) }];
      // Primeiro dia: MIGRA as linhas órfãs (sem dia) pro novo dia, em vez de
      // criar linhas novas e abandonar as antigas — órfã sem dia vira
      // invisível assim que ticketDays deixa de estar vazio, mas continua
      // contando pra validação do Step 2 com preço vazio. Já foi bug.
      let matrixRows: MatrixRow[];
      if (isFirstDay) {
        matrixRows = f.matrixRows.map((r) => (r.dayIds.length === 0 ? { ...r, dayIds: [newId] } : r));
      } else {
        const areaList = f.ticketAreas.length ? f.ticketAreas.map((a) => a.id) : [null];
        matrixRows = [...f.matrixRows, ...areaList.map((areaId) => makeRow([newId], areaId, 1, ticketDays, f.ticketAreas, 1))];
      }
      return { ...f, ticketDays, matrixRows: relabelAll(matrixRows, ticketDays, f.ticketAreas) };
    });
  };
  const removeDay = (dayId: string) => {
    // Remover o ÚLTIMO dia é o inverso exato da migração de addDay: as linhas
    // voltam a ser órfãs de dia, não somem. Apagá-las deixava `matrixRows`
    // vazio e a tabela do Step 2 não renderizava nada — sem preço/qtd pra
    // preencher e sem como avançar.
    const isLastDay = form.ticketDays.length === 1;
    const affected = form.matrixRows.filter((r) => r.dayIds.includes(dayId));
    if (!isLastDay && affected.some((r) => r.priceUsdc) && !window.confirm("Remover este dia apaga os preços já preenchidos nas linhas dele. Continuar?")) return;
    setForm((f) => {
      const ticketDays = f.ticketDays.filter((d) => d.id !== dayId);
      if (isLastDay) {
        const matrixRows = f.matrixRows.map((r) => ({ ...r, dayIds: [] }));
        return ensureBaseRow({ ...f, ticketDays, matrixRows: relabelAll(matrixRows, ticketDays, f.ticketAreas) });
      }
      // Tira o dia de todo conjunto. Um passe que cobria [d1,d2,d3] vira
      // [d1,d2] e continua válido; uma linha que só cobria o dia removido
      // fica sem dia nenhum e é descartada (não vira passe de zero dias).
      const matrixRows = f.matrixRows
        .map((r) => ({ ...r, dayIds: r.dayIds.filter((d) => d !== dayId) }))
        .filter((r) => r.dayIds.length > 0);
      return ensureBaseRow({ ...f, ticketDays, matrixRows: relabelAll(matrixRows, ticketDays, f.ticketAreas) });
    });
  };
  const renameDay = (dayId: string, name: string) =>
    setForm((f) => {
      const ticketDays = f.ticketDays.map((d) => (d.id === dayId ? { ...d, name } : d));
      return { ...f, ticketDays, matrixRows: relabelAll(f.matrixRows, ticketDays, f.ticketAreas) };
    });

  // Data não entra no rótulo (computeLabel usa só o nome), então mudar a data
  // nunca precisa relabelar a matriz.
  const setDayDate = (dayId: string, date: string) =>
    setForm((f) => ({
      ...f,
      ticketDays: f.ticketDays.map((d) => (d.id === dayId ? { ...d, date } : d)),
    }));

  const addArea = () => {
    const newId = genDimId();
    const name = `Área ${form.ticketAreas.length + 1}`;
    setForm((f) => {
      const isFirstArea = f.ticketAreas.length === 0;
      const ticketAreas = [...f.ticketAreas, { id: newId, name }];
      // Mesma migração de órfãs que addDay — ver comentário lá.
      let matrixRows: MatrixRow[];
      if (isFirstArea) {
        matrixRows = f.matrixRows.map((r) => (r.areaId === null ? { ...r, areaId: newId } : r));
      } else {
        // Uma linha nova por conjunto de dias já existente — inclusive os
        // passes, senão a área nova não teria passe e o organizador teria que
        // recriar cada um à mão.
        const daySets = [...new Map(f.matrixRows.map((r) => [rowGroupKey(r.dayIds, null), r.dayIds])).values()];
        matrixRows = [...f.matrixRows, ...daySets.map((dayIds) => makeRow(dayIds, newId, 1, f.ticketDays, ticketAreas, 1))];
      }
      return { ...f, ticketAreas, matrixRows: relabelAll(matrixRows, f.ticketDays, ticketAreas) };
    });
  };
  const removeArea = (areaId: string) => {
    // Mesma simetria de removeDay — ver comentário lá.
    const isLastArea = form.ticketAreas.length === 1;
    const affected = form.matrixRows.filter((r) => r.areaId === areaId);
    if (!isLastArea && affected.some((r) => r.priceUsdc) && !window.confirm("Remover esta área apaga os preços já preenchidos nas linhas dela. Continuar?")) return;
    setForm((f) => {
      const ticketAreas = f.ticketAreas.filter((a) => a.id !== areaId);
      if (!isLastArea) {
        return ensureBaseRow({ ...f, ticketAreas, matrixRows: f.matrixRows.filter((r) => r.areaId !== areaId) });
      }
      const matrixRows = f.matrixRows.map((r) => (r.areaId === areaId ? { ...r, areaId: null } : r));
      return ensureBaseRow({ ...f, ticketAreas, matrixRows: relabelAll(matrixRows, f.ticketDays, ticketAreas) });
    });
  };
  const renameArea = (areaId: string, name: string) =>
    setForm((f) => {
      const ticketAreas = f.ticketAreas.map((a) => (a.id === areaId ? { ...a, name } : a));
      return { ...f, ticketAreas, matrixRows: relabelAll(f.matrixRows, f.ticketDays, ticketAreas) };
    });

  // ── Passes ────────────────────────────────────────────────────────────────
  // Um passe é uma linha da matriz com mais de um dia. Nasce cobrindo TODOS os
  // dias (o caso comum: "passe completo"), e o organizador desmarca dias pra
  // fazer um passe parcial — passe de fim de semana sai do mesmo mecanismo.
  const addPass = () =>
    setForm((f) => {
      if (f.ticketDays.length < 2) return f;
      const allDays = f.ticketDays.map((d) => d.id);
      const areaList = f.ticketAreas.length ? f.ticketAreas.map((a) => a.id) : [null];
      // Já existe um passe com exatamente esse conjunto? Criar outro igual só
      // geraria dois grupos idênticos na página do evento.
      const exists = areaList.every((areaId) =>
        f.matrixRows.some((r) => rowGroupKey(r.dayIds, r.areaId) === rowGroupKey(allDays, areaId))
      );
      if (exists) return f;
      const matrixRows = [...f.matrixRows, ...areaList.map((areaId) => makeRow(allDays, areaId, 1, f.ticketDays, f.ticketAreas, 1))];
      return { ...f, matrixRows: relabelAll(matrixRows, f.ticketDays, f.ticketAreas) };
    });

  // Liga/desliga um dia de um passe. Mexe em TODAS as áreas daquele passe de
  // uma vez — "o passe cobre o dia 3" é decisão do passe, não de cada área.
  const togglePassDay = (passDayIds: string[], dayId: string) =>
    setForm((f) => {
      const oldKey = rowGroupKey(passDayIds, null);
      const nextDayIds = passDayIds.includes(dayId)
        ? passDayIds.filter((d) => d !== dayId)
        : [...passDayIds, dayId];
      // Desmarcar até sobrar 1 dia deixaria de ser passe e viraria um segundo
      // grupo de dia único, colidindo com o que já existe. Menos de 2 dias não
      // é passe — o botão de remover é o caminho pra isso.
      if (nextDayIds.length < 2) return f;
      const matrixRows = f.matrixRows.map((r) =>
        rowGroupKey(r.dayIds, null) === oldKey ? { ...r, dayIds: nextDayIds } : r
      );
      return { ...f, matrixRows: relabelAll(matrixRows, f.ticketDays, f.ticketAreas) };
    });

  const removePass = (passDayIds: string[]) => {
    const key = rowGroupKey(passDayIds, null);
    const affected = form.matrixRows.filter((r) => rowGroupKey(r.dayIds, null) === key);
    if (affected.some((r) => r.priceUsdc) && !window.confirm("Remover este passe apaga os preços já preenchidos nele. Continuar?")) return;
    setForm((f) => ensureBaseRow({
      ...f,
      matrixRows: f.matrixRows.filter((r) => rowGroupKey(r.dayIds, null) !== key),
    }));
  };

  const addLot = (dayIds: string[], areaId: string | null) =>
    setForm((f) => {
      const key = rowGroupKey(dayIds, areaId);
      const groupRows = f.matrixRows.filter((r) => rowGroupKey(r.dayIds, r.areaId) === key);
      const nextLot = Math.max(...groupRows.map((r) => r.lotNumber), 0) + 1;
      const matrixRows = [...f.matrixRows, makeRow(dayIds, areaId, nextLot, f.ticketDays, f.ticketAreas, nextLot)];
      return { ...f, matrixRows: relabelAll(matrixRows, f.ticketDays, f.ticketAreas) };
    });
  const removeLot = (dayIds: string[], areaId: string | null) =>
    setForm((f) => {
      const key = rowGroupKey(dayIds, areaId);
      const groupRows = f.matrixRows.filter((r) => rowGroupKey(r.dayIds, r.areaId) === key);
      if (groupRows.length <= 1) return f;
      const maxLot = Math.max(...groupRows.map((r) => r.lotNumber));
      const target = groupRows.find((r) => r.lotNumber === maxLot)!;
      if (target.priceUsdc && !window.confirm("Remover este lote apaga o preço já preenchido. Continuar?")) return f;
      const matrixRows = f.matrixRows.filter(
        (r) => !(rowGroupKey(r.dayIds, r.areaId) === key && r.lotNumber === maxLot)
      );
      return { ...f, matrixRows: relabelAll(matrixRows, f.ticketDays, f.ticketAreas) };
    });
  const updateRow = (dayIds: string[], areaId: string | null, lotNumber: number, patch: Partial<MatrixRow>) =>
    setForm((f) => {
      const key = rowGroupKey(dayIds, areaId);
      return {
        ...f,
        matrixRows: f.matrixRows.map((r) =>
          rowGroupKey(r.dayIds, r.areaId) === key && r.lotNumber === lotNumber ? { ...r, ...patch } : r
        ),
      };
    });

  // Conjuntos de dias que são passe (mais de um dia), deduplicados entre as
  // áreas — o passe é o mesmo pra "Pista" e "Camarote", só o preço muda.
  const passDaySets: string[][] = [
    ...new Map(
      form.matrixRows
        .filter((r) => r.dayIds.length > 1)
        .map((r): [string, string[]] => [rowGroupKey(r.dayIds, null), [...r.dayIds]])
    ).values(),
  ];

  // Uma tabela de lotes para um grupo (conjunto de dias + área). Mesma
  // marcação para ingresso de dia único e para passe — a única diferença
  // entre eles é o tamanho do conjunto de dias.
  const renderGroup = (dayIds: string[], areaId: string | null) => {
    const key = rowGroupKey(dayIds, areaId);
    const groupRows = form.matrixRows
      .filter((r) => rowGroupKey(r.dayIds, r.areaId) === key)
      .sort((a, b) => a.lotNumber - b.lotNumber);
    if (groupRows.length === 0) return null;
    const multiLot = groupRows.length > 1;
    // Entrada antecipada é do TIPO, mas oferecer por lote confundiria (lote 1
    // entra antes e o lote 2 não?). Editado no cabeçalho e aplicado a todos.
    const earlyValue = groupRows[0].earlyEntryMinutes;
    return (
      <div key={key} className="overflow-x-auto rounded-md border border-border">
        <div className="flex flex-wrap items-center justify-between gap-2 bg-surface-2 px-3 py-1.5">
          <span className="text-xs font-medium text-text-muted">
            {form.ticketAreas.length > 0 ? form.ticketAreas.find((a) => a.id === areaId)?.name : "Ingresso"}
          </span>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-xs text-text-muted">
              entra
              <input
                type="number" min="0" max="720" placeholder="0"
                value={earlyValue}
                onChange={(e) => groupRows.forEach((r) => updateRow(dayIds, areaId, r.lotNumber, { earlyEntryMinutes: e.target.value }))}
                className="w-14 rounded border border-border-strong bg-surface-1 px-1.5 py-0.5 text-text outline-none"
                title="Minutos de entrada antecipada, antes da abertura dos portões"
              />
              min antes
            </label>
            <button type="button" onClick={() => removeLot(dayIds, areaId)} disabled={!multiLot} className="text-xs text-text-muted hover:text-erro-on-dark disabled:opacity-30">− lote</button>
            <button type="button" onClick={() => addLot(dayIds, areaId)} className="text-xs text-ouro-400 hover:text-ouro-300">+ lote</button>
          </div>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {groupRows.map((row) => (
              <tr key={row.lotNumber} className="border-t border-border first:border-t-0">
                <td className="p-2">
                  <input
                    value={row.label}
                    onChange={(e) => updateRow(dayIds, areaId, row.lotNumber, { label: e.target.value, labelTouched: true })}
                    className="w-full min-w-[9rem] bg-transparent text-text outline-none"
                    aria-label="Rótulo"
                  />
                </td>
                <td className="p-2">
                  <input
                    type="number" min="0.01" step="0.01" placeholder="Preço (USDC)"
                    value={row.priceUsdc}
                    onChange={(e) => updateRow(dayIds, areaId, row.lotNumber, { priceUsdc: e.target.value })}
                    className="w-28 rounded border border-border-strong bg-surface-1 px-2 py-1 text-text outline-none"
                  />
                </td>
                <td className="p-2">
                  <input
                    type="number" min="1" placeholder="Qtd. (sem limite)"
                    value={row.quantity}
                    onChange={(e) => updateRow(dayIds, areaId, row.lotNumber, { quantity: e.target.value })}
                    className="w-32 rounded border border-border-strong bg-surface-1 px-2 py-1 text-text outline-none"
                  />
                </td>
                {multiLot && (
                  <td className="p-2">
                    <input
                      type="datetime-local" title="Fim da venda deste lote"
                      value={row.salesEndAt}
                      onChange={(e) => updateRow(dayIds, areaId, row.lotNumber, { salesEndAt: e.target.value })}
                      className="rounded border border-border-strong bg-surface-1 px-2 py-1 text-text outline-none"
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const goNext = () => {
    if (step === 1 && !step1Valid(form)) { setError("Preencha título, endereço, cidade, e as datas de início e término (término precisa ser depois do início)."); return; }
    if (step === 2 && !step2Valid(form)) {
      // Erro específico: "informe um preço válido" quando o problema é a data
      // de um dia manda o organizador procurar no lugar errado.
      const dates = form.ticketDays.map((d) => d.date);
      if (form.ticketDays.some((d) => !d.date)) setError("Informe a data de cada dia do evento.");
      else if (new Set(dates).size !== dates.length) setError("Dois dias não podem ter a mesma data.");
      else setError("Informe um preço de ingresso válido.");
      return;
    }
    setError(null);
    setStep((s) => (s === 3 ? s : ((s + 1) as 2 | 3)));
  };
  const goBack = () => { setError(null); setStep((s) => (s === 1 ? s : ((s - 1) as 1 | 2))); };

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    const { matrixRows: _matrixRows, ticketDays, ticketAreas, maxTicketsPerAccount, ...rest } = form;
    const r = await authFetch("/api/organizer/events", {
      method: "POST",
      body: JSON.stringify({
        ...rest,
        ticketDays: ticketDays.length ? ticketDays : null,
        ticketAreas: ticketAreas.length ? ticketAreas : null,
        maxTicketsPerAccount: maxTicketsPerAccount ? parseInt(maxTicketsPerAccount) : null,
        ticketTypes: reachableRows(form).map((row) => ({
          dayIds:     row.dayIds,
          areaId:     row.areaId,
          lotNumber:  row.lotNumber,
          label:      row.label,
          priceUsdc:  parseFloat(row.priceUsdc),
          quantity:   row.quantity ? parseInt(row.quantity) : null,
          salesEndAt: row.salesEndAt || null,
          earlyEntryMinutes: row.earlyEntryMinutes ? parseInt(row.earlyEntryMinutes) : null,
        })),
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
          <div className="flex flex-col gap-5">
            {/* Acordeon — gera a estrutura da matriz. Responder "não" em
                ambas mantém uma linha só, igual o formulário simples de antes. */}
            <div className="flex flex-col gap-3 rounded-md border border-border p-3">
              {/* Dias em coluna (e não pílulas inline como as áreas) porque
                  cada dia carrega nome + data — a data é o que permite a
                  portaria saber qual dia do evento é hoje. */}
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-text">Este evento tem mais de um dia de venda separada?</span>
                  <Button size="sm" variant="secondary" onClick={addDay}>+ dia</Button>
                </div>
                {form.ticketDays.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    {form.ticketDays.map((d) => (
                      <div key={d.id} className="flex items-center gap-2 rounded-md border border-border-strong bg-surface-2 px-2.5 py-1.5">
                        <input
                          value={d.name}
                          onChange={(e) => renameDay(d.id, e.target.value)}
                          className="w-24 bg-transparent text-xs text-text outline-none"
                          aria-label="Nome do dia"
                        />
                        <input
                          type="date"
                          value={d.date ?? ""}
                          onChange={(e) => setDayDate(d.id, e.target.value)}
                          aria-label={`Data de ${d.name}`}
                          className={`rounded border bg-surface-1 px-2 py-1 text-xs text-text outline-none ${
                            d.date ? "border-border-strong" : "border-erro-on-dark"
                          }`}
                        />
                        <button type="button" onClick={() => removeDay(d.id)} className="ml-auto rounded-full px-1.5 text-text-muted hover:text-erro-on-dark" aria-label={`Remover ${d.name}`}>×</button>
                      </div>
                    ))}
                    <p className="text-xs text-text-muted">
                      A data de cada dia é o que permite a portaria aceitar o ingresso só no dia certo.
                    </p>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-text">Tem áreas diferentes (pista, camarote...)?</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {form.ticketAreas.map((a) => (
                    <span key={a.id} className="flex items-center gap-1 rounded-full border border-border-strong bg-surface-2 py-1 pl-2.5 pr-1 text-xs">
                      <input
                        value={a.name}
                        onChange={(e) => renameArea(a.id, e.target.value)}
                        className="w-20 bg-transparent text-text outline-none"
                      />
                      <button type="button" onClick={() => removeArea(a.id)} className="rounded-full px-1.5 text-text-muted hover:text-erro-on-dark" aria-label={`Remover ${a.name}`}>×</button>
                    </span>
                  ))}
                  <Button size="sm" variant="secondary" onClick={addArea}>+ área</Button>
                </div>
              </div>
            </div>

            {/* Tabela editável, agrupada por (conjunto de dias, área) —
                "quantos lotes" é controle POR GRUPO, não uma pergunta global:
                cada combinação pode ter uma quantidade de lotes diferente. */}
            <div className="flex flex-col gap-4">
              {/* Ingressos de um dia (ou o ingresso único do evento sem dias) */}
              {(form.ticketDays.length ? form.ticketDays.map((d) => [d.id]) : [[] as string[]]).map((dayIds) => (
                <div key={rowGroupKey(dayIds, null)} className="flex flex-col gap-2">
                  {dayIds.length > 0 && (
                    <h4 className="font-display text-sm text-text">{form.ticketDays.find((d) => d.id === dayIds[0])?.name}</h4>
                  )}
                  {(form.ticketAreas.length ? form.ticketAreas.map((a) => a.id) : [null]).map((areaId) =>
                    renderGroup(dayIds, areaId)
                  )}
                </div>
              ))}

              {/* Passes — grupos que cobrem mais de um dia. Só existem quando o
                  evento tem pelo menos 2 dias; sem isso não há o que combinar. */}
              {form.ticketDays.length >= 2 && (
                <div className="flex flex-col gap-2 rounded-md border border-dashed border-border-strong p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-sm font-medium text-text">Passes</span>
                      <p className="text-xs text-text-muted">
                        Um ingresso que dá entrada em vários dias. Desmarque dias para um passe parcial.
                      </p>
                    </div>
                    <Button size="sm" variant="secondary" onClick={addPass}>+ passe</Button>
                  </div>
                  {passDaySets.length === 0 ? (
                    <p className="text-xs text-text-muted">Nenhum passe. O público só poderá comprar dia a dia.</p>
                  ) : (
                    passDaySets.map((dayIds) => (
                      <div key={rowGroupKey(dayIds, null)} className="flex flex-col gap-2 rounded-md border border-border p-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {form.ticketDays.map((d) => {
                            const on = dayIds.includes(d.id);
                            return (
                              <button
                                key={d.id}
                                type="button"
                                onClick={() => togglePassDay(dayIds, d.id)}
                                aria-pressed={on}
                                className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                                  on ? "border-laranja-500 bg-laranja-500/10 text-text" : "border-border-strong text-text-muted hover:bg-white/5"
                                }`}
                              >
                                {d.name}
                              </button>
                            );
                          })}
                          <button
                            type="button"
                            onClick={() => removePass(dayIds)}
                            className="ml-auto rounded-full px-1.5 text-text-muted hover:text-erro-on-dark"
                            aria-label="Remover passe"
                          >
                            ×
                          </button>
                        </div>
                        {(form.ticketAreas.length ? form.ticketAreas.map((a) => a.id) : [null]).map((areaId) =>
                          renderGroup(dayIds, areaId)
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <Field
              label="Limite de ingressos por conta (opcional — em branco = sem limite)"
              type="number"
              min="1"
              value={form.maxTicketsPerAccount}
              onChange={(e) => set("maxTicketsPerAccount", e.target.value)}
            />

            {/* PLANO_EVOLUCAO_V2.md §10.2/A11-A14 — teto de revenda sempre
                travado em 100% da face, em toda categoria; não é mais escolha
                do organizador. Acima disso, a plataforma pode cobrar uma taxa
                de intermediação destacada (até 20%, lib/resaleCap.ts), somada
                por cima do valor pago ao comprador — nunca embutida aqui. */}
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-text">Teto de revenda</span>
              <p className="text-sm text-text">
                Travado em 100% do preço original em qualquer categoria — o vendedor nunca recebe
                acima da face. A plataforma pode cobrar uma taxa de intermediação por cima, mostrada
                separadamente pro comprador no anúncio.
              </p>
            </div>

            {(() => {
              const mandatory = isSocialHalfMandatory(form.category);
              const legalQuotaPct = getSocialHalfQuotaBps("BR", form.state || null) / 100;
              const checked = mandatory || form.hasSocialHalf;
              const currentPct = form.socialHalfBps ? Number(form.socialHalfBps) / 100 : legalQuotaPct;
              const aggregateMax = computeAggregateMaxTickets(form.matrixRows);

              return (
                <div className="flex flex-col gap-1.5">
                  {aggregateMax !== null ? (
                    // Com capacidade definida em TODO row, o organizador pode
                    // oferecer MAIS que a cota legal — checkbox binário não
                    // expressa isso. Meia continua no nível do evento nesta
                    // fatia (Onda 3, parte 2 migra pra por-tipo).
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
                          ? `= ${Math.floor((aggregateMax * currentPct) / 100)} de ${aggregateMax} ingressos`
                          : "Arraste para oferecer meia-entrada"
                      }
                    />
                  ) : (
                    // Sem capacidade agregada, não há total sobre o que
                    // calcular percentual — 40% de "ilimitado" não é um número.
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
            {computeAggregateMaxTickets(form.matrixRows) !== null ? (
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
