import type { ReactNode } from "react";

type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  message: string;
  action?: ReactNode;
};

export function EmptyState({ icon, title, message, action }: EmptyStateProps) {
  return (
    <div className="card p-8 text-center">
      {icon && <div className="mb-3 flex justify-center text-vx-sage">{icon}</div>}
      <h2 className="text-base font-semibold text-vx-text">{title}</h2>
      <p className="mt-2 text-sm text-vx-muted">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
