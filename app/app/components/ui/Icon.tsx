const paths: Record<string, { strokeWidth?: number; linecap?: "round"; content: React.ReactNode }> = {
  // Marcas da casa (portal / quadrifolio / ticket): traço mais fino e
  // desenho de contorno contínuo — aparecem em tamanho grande como selo.
  portal: {
    strokeWidth: 1.2,
    content: (
      <>
        <path d="M5 20V11a7 7 0 0 1 14 0v9" />
        <path d="M7.8 20v-9a4.2 4.2 0 0 1 8.4 0v9" />
        <path d="M3 20h18" />
      </>
    ),
  },
  ticket: {
    strokeWidth: 1.2,
    content: (
      <path d="M4.5 7h15A1.5 1.5 0 0 1 21 8.5v1.9a1.6 1.6 0 0 0 0 3.2v1.9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 15.5v-1.9a1.6 1.6 0 0 0 0-3.2V8.5A1.5 1.5 0 0 1 4.5 7Z" />
    ),
  },
  // Quadrifólio gótico: quatro semicírculos erguidos sobre os lados de um
  // quadrado, num único contorno (sem os arcos internos de círculos sobrepostos).
  quadrifolio: {
    strokeWidth: 1.2,
    content: <path d="M8 8a4 4 0 0 1 8 0 4 4 0 0 1 0 8 4 4 0 0 1-8 0 4 4 0 0 1 0-8Z" />,
  },
  local: {
    content: (
      <>
        <path d="M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11Z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
  },
  calendario: {
    content: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </>
    ),
  },
  olho: {
    content: (
      <>
        <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z" />
        <circle cx="12" cy="12" r="2.6" />
      </>
    ),
  },
  carrinho: {
    content: (
      <>
        <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.6L21 8H6" />
        <circle cx="9.5" cy="19.5" r="1.4" />
        <circle cx="17" cy="19.5" r="1.4" />
      </>
    ),
  },
  saida: {
    content: (
      <>
        <path d="M14 5v-.5A1.5 1.5 0 0 0 12.5 3h-6A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h6a1.5 1.5 0 0 0 1.5-1.5V19" />
        <path d="M10 12h11M17 8l4 4-4 4" />
      </>
    ),
  },
  check: { strokeWidth: 2, content: <path d="M4 12.5 9.5 18 20 6.5" /> },
  cadeado: {
    content: (
      <>
        <rect x="4" y="10" width="16" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
  },
  // Fachada clássica: cornija e estilóbata em linha dupla, três fustes entre elas.
  coluna: {
    strokeWidth: 1.2,
    content: (
      <>
        <path d="M4 5h16M5.5 7.5h13" />
        <path d="M7.5 7.5v9M12 7.5v9M16.5 7.5v9" />
        <path d="M5.5 16.5h13M4 19h16" />
      </>
    ),
  },
  // Escudo só é usado inline (~14px): um contorno interno completo empasta
  // nesse tamanho, então a segunda linha é o "chefe" heráldico.
  escudo: {
    content: (
      <>
        <path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6l7-3Z" />
        <path d="M5.6 9.5h12.8" />
      </>
    ),
  },
  // Também é CATEGORY_ICON: renderiza sempre em tamanho grande, logo 1.2 como as demais.
  cartao: {
    strokeWidth: 1.2,
    content: (
      <>
        <rect x="2.5" y="5.5" width="19" height="13" rx="2" />
        <path d="M2.5 10h19" />
      </>
    ),
  },
  repetir: {
    content: (
      <>
        <path d="M4 9h12a4 4 0 0 1 4 4M20 15H8a4 4 0 0 1-4-4" />
        <path d="M7 6 4 9l3 3M17 18l3-3-3-3" />
      </>
    ),
  },
  moeda: {
    content: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 6.5v11M9.5 9.5h4a1.8 1.8 0 0 1 0 3.6h-3a1.8 1.8 0 0 0 0 3.6h4" />
      </>
    ),
  },
  scanner: {
    content: (
      <>
        <path d="M3 8V5.5A2.5 2.5 0 0 1 5.5 3H8M16 3h2.5A2.5 2.5 0 0 1 21 5.5V8M21 16v2.5a2.5 2.5 0 0 1-2.5 2.5H16M8 21H5.5A2.5 2.5 0 0 1 3 18.5V16" />
        <path d="M3 12h18" />
      </>
    ),
  },
  x: { strokeWidth: 2, content: <path d="M6 6l12 12M18 6L6 18" /> },
  relogio: {
    content: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 7.5V12l3 2" />
      </>
    ),
  },
  pausar: { strokeWidth: 1.8, content: <path d="M9.5 6v12M14.5 6v12" /> },
  play: { content: <path d="M8 5.5v13l11-6.5-11-6.5Z" /> },
  sol: {
    content: (
      <>
        <circle cx="12" cy="12" r="4.2" />
        <path d="M12 2.5v2.4M12 19.1v2.4M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7" />
      </>
    ),
  },
  lua: { content: <path d="M20 14.2A8.5 8.5 0 1 1 9.8 4a7 7 0 0 0 10.2 10.2Z" /> },
  mapa: {
    content: (
      <>
        <path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4Z" />
        <path d="M9 4v13M15 6.5v13" />
      </>
    ),
  },
};

export type IconName = keyof typeof paths;

export function Icon({
  name,
  className = "",
}: {
  name: IconName;
  className?: string;
}) {
  const spec = paths[name];
  if (!spec) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth={spec.strokeWidth ?? 1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`inline-block h-[1.15em] w-[1.15em] align-[-0.2em] ${className}`}
    >
      {spec.content}
    </svg>
  );
}
