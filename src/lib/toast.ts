"use client";

import { toast as sonnerToast } from "sonner";

/**
 * Thin wrapper around sonner. Centralised so we can swap the toast
 * implementation later without touching every call site.
 */
export const toast = {
  success: (message: string, description?: string) =>
    sonnerToast.success(message, { description }),
  error: (message: string, description?: string) =>
    sonnerToast.error(message, { description }),
  info: (message: string, description?: string) =>
    sonnerToast.info(message, { description }),
  warning: (message: string, description?: string) =>
    sonnerToast.warning(message, { description }),
  message: (message: string, description?: string) =>
    sonnerToast(message, { description }),
};

export function toastError(err: unknown, fallback = "Something went wrong"): void {
  if (err instanceof Error) {
    toast.error(fallback, err.message);
  } else if (typeof err === "string") {
    toast.error(fallback, err);
  } else {
    toast.error(fallback);
  }
}
