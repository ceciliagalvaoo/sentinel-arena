interface StatusDotProps {
  status: "active" | "paused";
  label?: string;
}

/** Live-stream indicator — pulsing dot per the web3-dashboard "connected to stream" convention. */
export function StatusDot({ status, label }: StatusDotProps) {
  const isActive = status === "active";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-secondary">
      <span className="relative flex h-2 w-2">
        {isActive && (
          <span className="absolute inline-flex h-full w-full animate-pulse-dot rounded-full bg-good opacity-75" />
        )}
        <span
          className={`relative inline-flex h-2 w-2 rounded-full ${isActive ? "bg-good" : "bg-ink-muted"}`}
        />
      </span>
      {label ?? (isActive ? "Ativo" : "Pausado")}
    </span>
  );
}
