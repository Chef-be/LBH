"use client";

/**
 * Fournisseur React Query pour toutes les requêtes API.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function FournisseurRequetes({ children }: { children: React.ReactNode }) {
  const [clientRequetes] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={clientRequetes}>{children}</QueryClientProvider>
  );
}
