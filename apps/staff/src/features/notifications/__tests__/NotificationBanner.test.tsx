import type { NotificationList, StaffOrderDetail } from "@bakery/core/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "@/shared/i18n";
import { NotificationBanner } from "../NotificationBanner";

let mockList: NotificationList = { unread: 0, quiet: false, items: [] };
const mockRead = jest.fn();
const mockPush = jest.fn();
const mockChime = jest.fn();
jest.mock("../api", () => ({
  notificationKeys: { list: ["notifications"] },
  useNotifications: () => ({ data: mockList }),
  useReadNotification: () => ({ mutate: mockRead }),
}));
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("../sound", () => ({
  isSoundOn: () => true,
  playChime: () => mockChime(),
  unlockSoundOnFirstTouch: () => undefined,
}));
const order: StaffOrderDetail = {
  id: "11111111-1111-4111-8111-111111111111",
  number: 1023,
  source: "web",
  status: "confirmed",
  customerName: "Jana Nováková",
  customerPhone: "+420777123456",
  pickupDay: "2026-11-26",
  totalCzk: 162,
  lines: [
    { productId: "chleb-kminovy", name: "Kmínový chléb", quantity: 2, unitPriceCzk: 69 },
    { productId: "rohlik", name: "Rohlík", quantity: 6, unitPriceCzk: 4 },
  ],
  createdAt: "2026-11-25T09:05:00.000Z",
  transcript: null,
};
const mockRefresh = jest.fn();
jest.mock("@/features/orders/api", () => ({
  useOrder: () => ({ data: order }),
  refreshOrderViews: () => mockRefresh(),
}));

const newOrder = {
  id: "22222222-2222-4222-8222-222222222222",
  kind: "new_order" as const,
  title: "Nová objednávka",
  body: "Na čtvrtek 26. 11., přes web.",
  link: `/objednavka/${order.id}`,
  createdAt: "2026-11-25T09:05:00.000Z",
  readAt: null,
};
const older = { ...newOrder, id: "33333333-3333-4333-8333-333333333333", createdAt: "2026-11-25T08:00:00.000Z" };

beforeEach(() => {
  mockList = { unread: 1, quiet: false, items: [older] };
  mockRead.mockReset();
  mockPush.mockReset();
  mockChime.mockReset();
  mockRefresh.mockReset();
});

const METRICS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
// one client for render and rerender: rerendering replaces the whole tree, provider included
const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
const ui = () => (
  <QueryClientProvider client={client}>
    <SafeAreaProvider initialMetrics={METRICS}>
      <NotificationBanner />
    </SafeAreaProvider>
  </QueryClientProvider>
);

async function arrive(quiet = false) {
  const view = await render(ui());
  expect(screen.queryByText(/Nová objednávka č\./)).toBeNull(); // the list at opening replays nothing
  mockList = { unread: 2, quiet, items: [newOrder, older] };
  await view.rerender(ui());
}

describe("NotificationBanner (spec 002 FR-021–FR-024)", () => {
  it("a new order slides in with its details and a sound", async () => {
    await arrive();
    expect(await screen.findByText("Nová objednávka č. 1023")).toBeTruthy();
    expect(screen.getByText("Jana Nováková")).toBeTruthy();
    expect(screen.getByText("2× Kmínový chléb, 6× Rohlík")).toBeTruthy();
    expect(screen.getByText("162 Kč")).toBeTruthy();
    expect(mockChime).toHaveBeenCalledTimes(1);
    expect(mockRefresh).toHaveBeenCalledTimes(1); // the day's list and the plan follow (spec 001 FR-062)
  });

  it("no sound in quiet hours", async () => {
    await arrive(true);
    expect(await screen.findByText("Nová objednávka č. 1023")).toBeTruthy();
    expect(mockChime).not.toHaveBeenCalled();
  });

  it("a tap reads it and opens the order", async () => {
    await arrive();
    await fireEvent.press(await screen.findByLabelText("Nová objednávka. Na čtvrtek 26. 11., přes web."));
    expect(mockRead).toHaveBeenCalledWith(newOrder.id);
    expect(mockPush).toHaveBeenCalledWith(`/objednavka/${order.id}`);
  });

  it("× closes it without opening anything", async () => {
    await arrive();
    await fireEvent.press(await screen.findByLabelText("Zavřít upozornění"));
    expect(mockRead).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
