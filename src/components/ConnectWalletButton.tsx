export function ConnectWalletButton({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <button
        className="px-3 py-1.5 text-xs rounded-lg border border-vx-border text-vx-muted
                   hover:border-vx-sage/30 hover:text-vx-text transition-all"
      >
        Connect Freighter
      </button>
    );
  }

  return (
    <button
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-vx-border
                 text-sm text-vx-muted hover:text-vx-text hover:border-vx-sage/30
                 transition-all duration-150"
    >
      <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      Connect Freighter
    </button>
  );
}
