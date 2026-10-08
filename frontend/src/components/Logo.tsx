export function Logo({ className = '', size = 26 }: { className?: string; size?: number }) {
  return (
    <span className={`inline-flex items-center gap-2 font-display font-extrabold uppercase tracking-[0.14em] ${className}`} style={{ fontSize: size }}>
      <svg width={size * 1.1} height={size * 1.1} viewBox="0 0 64 64" aria-hidden>
        <rect width="64" height="64" rx="14" fill="#f2b705" />
        <path d="M11 45 L32 14 L53 45" fill="none" stroke="#0b0f0d" strokeWidth="7" strokeLinejoin="round" strokeLinecap="round" />
        <path d="M21 45h22" stroke="#1f9d55" strokeWidth="7" strokeLinecap="round" />
      </svg>
      ALONG
    </span>
  );
}
