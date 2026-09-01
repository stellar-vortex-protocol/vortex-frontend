import type { ReactNode } from "react";

type EmptyStateProps = {
  icon?: ReactNode;
  title?: string;
  message: string;
  action?: ReactNode;
  /** Controls the ARIA role: "error" surfaces role="alert", "empty" (default) role="status". */
  variant?: "empty" | "error";
};

export function EmptyState({ icon, title, message, action, variant = "empty" }: EmptyStateProps) {
  return (
    <div role={variant === "error" ? "alert" : "status"} className="card p-8 text-center">
      {icon && <div className="mb-3 flex justify-center text-vx-sage">{icon}</div>}
      {title && <h2 className="text-base font-semibold text-vx-text">{title}</h2>}
      <p className={`text-sm text-vx-muted ${title ? "mt-2" : ""}`}>{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
