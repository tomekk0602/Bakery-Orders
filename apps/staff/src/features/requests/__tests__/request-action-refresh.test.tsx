import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { notificationKeys } from "@/features/notifications/api";
import { requestKeys, useRequestAction } from "../api";

const mockApi = jest.fn();
jest.mock("@/shared/api/http", () => ({ api: (...args: unknown[]) => mockApi(...args) }));

describe("closing a request refreshes the bell at once (spec 002 FR-029)", () => {
  it("marks the requests and the notification list stale", async () => {
    mockApi.mockResolvedValue({ ok: true });
    const client = new QueryClient({
      defaultOptions: { queries: { gcTime: Infinity }, mutations: { gcTime: Infinity } },
    });
    client.setQueryData(requestKeys.all, { open: [], closedToday: [] });
    client.setQueryData(notificationKeys.list, { unread: 1, quiet: false, items: [] });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = await renderHook(() => useRequestAction(), { wrapper });
    await act(() => result.current.mutateAsync({ id: "11111111-1111-4111-8111-111111111111", action: "handled" }));
    expect(client.getQueryState(requestKeys.all)?.isInvalidated).toBe(true);
    expect(client.getQueryState(notificationKeys.list)?.isInvalidated).toBe(true);
  });
});
