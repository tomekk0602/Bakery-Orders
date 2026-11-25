import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { planKeys } from "@/features/plan/api";
import { orderKeys, useCancelOrder } from "../api";

const mockApi = jest.fn();
jest.mock("@/shared/api/http", () => ({ api: (...args: unknown[]) => mockApi(...args) }));

describe("cancelling an order refreshes the plan as well (spec 001 FR-062)", () => {
  it("marks the orders and the plan stale", async () => {
    mockApi.mockResolvedValue({ ok: true });
    const client = new QueryClient({
      defaultOptions: { queries: { gcTime: Infinity }, mutations: { gcTime: Infinity } },
    });
    client.setQueryData(orderKeys.day(null), { day: "2026-11-26", orders: [] });
    client.setQueryData(planKeys.day(null), { lines: [] });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = await renderHook(() => useCancelOrder(), { wrapper });
    await act(() => result.current.mutateAsync("11111111-1111-4111-8111-111111111111"));
    expect(client.getQueryState(orderKeys.day(null))?.isInvalidated).toBe(true);
    expect(client.getQueryState(planKeys.day(null))?.isInvalidated).toBe(true);
  });
});
