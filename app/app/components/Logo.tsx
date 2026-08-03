export function Logo({ size = 32 }: { size?: number }) {
  const width = Math.round((size * 32) / 40);
  return (
    <svg
      viewBox="0 0 32 40"
      width={width}
      height={size}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 37V16a12 12 0 0 1 24 0v21" />
      <rect x="10" y="15" width="12" height="19" rx="2" />
      <circle cx="16" cy="22.6" r="2.1" />
      <circle cx="16" cy="26.4" r="2.1" />
      <circle cx="14.1" cy="24.5" r="2.1" />
      <circle cx="17.9" cy="24.5" r="2.1" />
      <path d="M2 37h28" />
    </svg>
  );
}
