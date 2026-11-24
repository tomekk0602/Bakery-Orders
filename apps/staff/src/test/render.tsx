import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react-native";
import type { ReactElement } from "react";
import "@/shared/i18n";

/**
 * Renders a screen with its own query client. `gcTime: Infinity` schedules no cache-cleanup timers,
 * which would otherwise keep Jest running after the tests finish.
 */
export async function renderWithQuery(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { gcTime: Infinity } } });
  return await render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}
