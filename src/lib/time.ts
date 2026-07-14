export function timeAgo(iso: string, now: number = Date.now()): string {
  const diffSeconds = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));

  if (diffSeconds < 5) return "just now";
  if (diffSeconds < 60) return `${diffSeconds}s ago`;

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function timeRemaining(iso: string, now: number = Date.now()): string {
  const diffSeconds = Math.floor((new Date(iso).getTime() - now) / 1000);
  if (diffSeconds <= 0) return "Expired";
  if (diffSeconds < 60) return `${diffSeconds}s`;

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m`;

  const diffHours = Math.floor(diffMinutes / 60);
  return `${diffHours}h`;
}
