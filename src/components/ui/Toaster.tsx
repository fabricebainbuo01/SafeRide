"use client";

import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      toastOptions={{
        classNames: {
          toast:
            "border border-navy-200 bg-white text-navy-800 text-sm font-sans",
          title: "font-semibold text-navy-800",
          description: "text-navy-600",
          success: "border-primary-200",
          error: "border-red-200",
          actionButton:
            "bg-primary-700 text-white hover:bg-primary-800 px-3 py-1 text-xs",
        },
      }}
    />
  );
}
