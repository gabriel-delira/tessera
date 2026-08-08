// Rate limit em memória, janela fixa. PLANO_EVOLUCAO_V2.md §10.6/D43 — o
// check-in por código de entrada PRECISA disso: a entropia de 10 chars
// protege menos do que parece contra força bruta num endpoint aberto, é o
// único ataque que o desenho do código não elimina sozinho.
//
// Escopo de processo único — cada instância do servidor tem seu próprio mapa.
// Suficiente pra um deploy de instância única; multi-instância exigiria um
// backend compartilhado (Redis). Registrado aqui, não resolvido — fora do
// escopo desta fatia.
const buckets = new Map<string, { count: number; windowStart: number }>();

export function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStart >= windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    return false;
  }
  bucket.count += 1;
  return bucket.count > limit;
}
