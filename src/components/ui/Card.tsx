import { cn } from "@/lib/utils";
import { ReactNode, HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
  /** Pass `false` to remove the default `p-6` and lay out content yourself. */
  padding?: boolean;
  /** Lift on hover; pair with `<button>`/anchor wrappers, not bare cards. */
  hover?: boolean;
  /**
   * Plays the fade-in entrance animation on mount.
   * Default `false` so list re-renders (e.g. after a real-time event)
   * don't replay the animation on every item.
   */
  animateIn?: boolean;
}

export function Card({
  children,
  className,
  padding = true,
  hover = false,
  animateIn = false,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "bg-white border border-navy-200",
        animateIn && "fade-in",
        padding && "p-6",
        hover && "hover-scale",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("border-b border-navy-200 pb-4 mb-4", className)}>
      {children}
    </div>
  );
}

export function CardTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h3 className={cn("text-lg font-semibold text-navy-800", className)}>
      {children}
    </h3>
  );
}
