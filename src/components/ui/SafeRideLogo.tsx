import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  SAFERIDE_LOGO_ALT,
  SAFERIDE_LOGO_ASPECT,
  SAFERIDE_LOGO_HEIGHT,
  SAFERIDE_LOGO_SRC,
  SAFERIDE_LOGO_WIDTH,
} from "@/lib/brand";

const HEIGHTS = {
  xs: 28,
  sm: 32,
  md: 40,
  lg: 48,
  xl: 56,
} as const;

export type SafeRideLogoSize = keyof typeof HEIGHTS;

interface SafeRideLogoProps {
  size?: SafeRideLogoSize;
  className?: string;
  imageClassName?: string;
  priority?: boolean;
  /** When set, wraps the logo in a home link. Pass `null` to render without a link. */
  href?: string | null;
}

export function SafeRideLogo({
  size = "sm",
  className,
  imageClassName,
  priority = false,
  href = "/",
}: SafeRideLogoProps) {
  const height = HEIGHTS[size];
  const width = Math.round(height * SAFERIDE_LOGO_ASPECT);

  const image = (
    <Image
      src={SAFERIDE_LOGO_SRC}
      alt={SAFERIDE_LOGO_ALT}
      width={SAFERIDE_LOGO_WIDTH}
      height={SAFERIDE_LOGO_HEIGHT}
      priority={priority}
      className={cn("w-auto object-contain object-left", imageClassName)}
      style={{ height, width }}
    />
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cn("inline-flex shrink-0 items-center", className)}
        aria-label="SafeRide home"
      >
        {image}
      </Link>
    );
  }

  return (
    <span className={cn("inline-flex shrink-0 items-center", className)}>
      {image}
    </span>
  );
}