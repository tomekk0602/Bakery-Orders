import type { StaffOrdersResponse } from "@bakery/core/contracts";
import { fireEvent, screen, waitFor, within } from "@testing-library/react-native";
import { renderWithQuery } from "@/test/render";
import { TodayScreen } from "../TodayScreen";

const mockApi = jest.fn();
jest.mock("@/shared/api/http", () => ({ api: (...args: unknown[]) => mockApi(...args) }));
const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));

const line = (productId: string, name: string, quantity: number, unitPriceCzk: number) => ({ productId, name, quantity, unitPriceCzk });
const day: StaffOrdersResponse = {
  day: "2026-11-24",
  orders: [
    { id: "11111111-1111-4111-8111-111111111111", number: 1002, source: "web", status: "picked_up", customerName: "Kučerová", customerPhone: null, pickupDay: "2026-11-24", totalCzk: 192, lines: [line("croissant", "Máslový croissant", 6, 32)], createdAt: "2026-11-23T10:00:00.000Z" },
    { id: "22222222-2222-4222-8222-222222222222", number: 1001, source: "phone", status: "confirmed", customerName: "Novák", customerPhone: "+420737777788", pickupDay: "2026-11-24", totalCzk: 162, lines: [line("chleb-kminovy", "Kmínový chléb", 2, 69), line("rohlik", "Rohlík", 6, 4)], createdAt: "2026-11-23T09:00:00.000Z" },
  ],
};

const renderScreen = () => renderWithQuery(<TodayScreen />);

beforeEach(() => {
  mockApi.mockReset();
  mockApi.mockImplementation((path: string) => Promise.resolve(path.startsWith("/api/staff/orders/") ? { ok: true } : day));
});

describe("TodayScreen (FR-012)", () => {
  it("lists the day's orders, waiting ones first, with counts", async () => {
    await renderScreen();
    expect(await screen.findByText("Novák")).toBeTruthy();
    expect(screen.getByText("2× Kmínový chléb, 6× Rohlík")).toBeTruthy();
    expect(screen.getByText(/K vydání: 1/)).toBeTruthy();
    const names = screen.getAllByText(/^(Novák|Kučerová)$/).map((n) => n.props.children);
    expect(names).toEqual(["Novák", "Kučerová"]);
  });

  it("hands an order over with one tap", async () => {
    await renderScreen();
    await fireEvent.press(await screen.findByText("Vydat"));
    await waitFor(() =>
      expect(mockApi).toHaveBeenCalledWith("/api/staff/orders/22222222-2222-4222-8222-222222222222", expect.anything(), expect.objectContaining({ method: "PATCH", body: JSON.stringify({ status: "picked_up" }) })),
    );
  });

  it("opens the order detail", async () => {
    await renderScreen();
    await fireEvent.press(await screen.findByLabelText("Otevřít objednávku č. 1001"));
    expect(mockPush).toHaveBeenCalledWith("/objednavka/22222222-2222-4222-8222-222222222222");
  });

  it("the hand-over button is not nested inside the pressable summary (invalid <button> in <button> on the web)", async () => {
    await renderScreen();
    const summary = await screen.findByLabelText("Otevřít objednávku č. 1001");
    expect(within(summary).queryByText("Vydat")).toBeNull();
    expect(screen.getByText("Vydat")).toBeTruthy();
  });
});
