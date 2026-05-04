import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Surface primitive. Quiet by default; lifts subtly on hover when `interactive`.
 *
 * Usage:
 *   <Card>                             →  a static surface
 *   <Card interactive>                 →  hoverable (link/button wrapper)
 *   <Card elevated>                    →  always-on shadow (modals, hero cards)
 */
export function Card({
  className,
  interactive = false,
  elevated = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  interactive?: boolean;
  elevated?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-bg p-6",
        elevated ? "shadow-md" : "shadow-sm",
        interactive && "card-hover cursor-pointer",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-start justify-between gap-4 mb-4", className)}
      {...props}
    />
  );
}

export function CardTitle({
  className,
  as: As = "h3",
  ...props
}: React.HTMLAttributes<HTMLHeadingElement> & { as?: "h2" | "h3" | "h4" }) {
  return (
    <As
      className={cn(
        "text-lg font-semibold tracking-tight text-fg",
        className,
      )}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-sm text-fg-muted mt-0.5", className)} {...props} />
  );
}

export type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger";

export function Badge({
  className,
  tone = "neutral",
  dot = false,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
  /** Render a small coloured dot before the label. */
  dot?: boolean;
}) {
  const toneClass = {
    neutral: "bg-bg-muted text-fg-muted ring-border",
    info: "bg-info/10 text-info ring-info/20",
    success: "bg-success/10 text-success ring-success/20",
    warning: "bg-warning/10 text-warning ring-warning/20",
    danger: "bg-danger/10 text-danger ring-danger/20",
  }[tone];
  const dotColour = {
    neutral: "bg-fg-subtle",
    info: "bg-info",
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-danger",
  }[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        "ring-1 ring-inset",
        toneClass,
        className,
      )}
      {...props}
    >
      {dot ? (
        <span
          aria-hidden
          className={cn("h-1.5 w-1.5 rounded-full", dotColour)}
        />
      ) : null}
      {children}
    </span>
  );
}
