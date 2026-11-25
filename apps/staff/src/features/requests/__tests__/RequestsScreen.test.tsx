import type { StaffRequestsResponse } from "@bakery/core/contracts";
import { fireEvent, waitFor } from "@testing-library/react-native";
import { Linking } from "react-native";
import { renderWithQuery } from "@/test/render";
import { RequestsScreen } from "../RequestsScreen";

const mockApi = jest.fn();
jest.mock("@/shared/api/http", () => ({ api: (...args: unknown[]) => mockApi(...args) }));
const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));
let mockPermissions: string[] = ["request:view", "request:resolve"];
jest.mock("@/features/auth/use-me", () => ({ useMe: () => ({ data: { permissions: mockPermissions } }) }));

type Item = StaffRequestsResponse["open"][number];
const item = (over: Partial<Item>): Item => ({
  id: "55555555-5555-4555-8555-555555555555",
  kind: "callback",
  origin: "agent",
  customerName: "Bartošová",
  customerPhone: "+420604555666",
  note: "Ptá se na dort k narozeninám.",
  createdAt: "2026-11-24T08:00:00.000Z",
  doneAt: null,
  transcript: [{ role: "customer", text: "Chtěla bych dort." }],
  outcome: null,
  callingNow: null,
  attempts: 0,
  canCloseUnreachable: false,
  history: [],
  orders: [],
  ...over,
});
const CANCEL_ID = "77777777-7777-4777-8777-777777777777";
const ORDER_ID = "88888888-8888-4888-8888-888888888888";
let data: StaffRequestsResponse;

beforeEach(() => {
  data = {
    open: [
      item({}),
      item({
        id: "66666666-6666-4666-8666-666666666666",
        origin: "promised_not_recorded",
        customerName: null,
        transcript: null,
        callingNow: { name: "Jana" },
        attempts: 3,
        canCloseUnreachable: true,
        history: [{ kind: "unanswered", by: "Jana", at: "2026-11-25T09:42:00.000Z", note: null, orderNumber: null }],
      }),
    ],
    closedToday: [],
  };
  mockApi.mockReset();
  mockPush.mockReset();
  mockPermissions = ["request:view", "request:resolve"];
  mockApi.mockImplementation((path: string) => Promise.resolve(path === "/api/staff/requests" ? data : { ok: true }));
  jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
});

const sent = (path: string, body: unknown, method = "PATCH") =>
  waitFor(() =>
    expect(mockApi).toHaveBeenCalledWith(
      path,
      expect.anything(),
      expect.objectContaining({ method, body: JSON.stringify(body) }),
    ),
  );

describe("RequestsScreen (FR-008, FR-034, FR-041)", () => {
  it("shows what each request is, flags a promise the agent did not record, and shows the call", async () => {
    const screen = await renderWithQuery(<RequestsScreen />);
    expect(await screen.findByText("Bartošová")).toBeTruthy();
    expect(screen.getByText("Asistent slíbil, nezapsal")).toBeTruthy();
    expect(screen.getByText("Jméno neuvedeno")).toBeTruthy();
    expect(screen.queryByText("Chtěla bych dort.", { exact: false })).toBeNull();
    await fireEvent.press(screen.getByText("Zobrazit přepis hovoru"));
    expect(screen.getByText("Chtěla bych dort.", { exact: false })).toBeTruthy();
  });
});

describe("working a request through (FR-047–FR-051)", () => {
  it("handled asks for an optional note and sends it", async () => {
    const screen = await renderWithQuery(<RequestsScreen />);
    await screen.findByText("Bartošová");
    await fireEvent.press(screen.getAllByText("Vyřízeno")[0]!);
    await fireEvent.changeText(screen.getByLabelText("Poznámka (nepovinné)"), "přesunuto na sobotu");
    await fireEvent.press(screen.getByText("Uložit jako vyřízené"));
    await sent("/api/staff/requests/55555555-5555-4555-8555-555555555555", {
      action: "handled",
      note: "přesunuto na sobotu",
    });
  });

  it("calling records the call and dials; an unanswered call is one tap", async () => {
    const screen = await renderWithQuery(<RequestsScreen />);
    await screen.findByText("Bartošová");
    await fireEvent.press(screen.getAllByText("Zavolat +420604555666")[0]!);
    await sent("/api/staff/requests/55555555-5555-4555-8555-555555555555", { action: "call" });
    expect(Linking.openURL).toHaveBeenCalledWith("tel:+420604555666");
    await fireEvent.press(screen.getAllByText("Nedovoláno")[0]!);
    await sent("/api/staff/requests/55555555-5555-4555-8555-555555555555", { action: "unanswered" });
  });

  it("shows who is calling and the attempts; from the third it can close as unreachable", async () => {
    const screen = await renderWithQuery(<RequestsScreen />);
    expect(await screen.findByText("Volá Jana")).toBeTruthy();
    expect(screen.getByText(/^Nedovoláno 3×, naposledy .* \(Jana\)$/)).toBeTruthy();
    expect(screen.getAllByText("Uzavřít — nedovoláno")).toHaveLength(1);
    await fireEvent.press(screen.getByText("Uzavřít — nedovoláno"));
    await fireEvent.press(screen.getByText("Uzavřít jako nedovoláno"));
    await sent("/api/staff/requests/66666666-6666-4666-8666-666666666666", { action: "unreachable" });
  });
});

describe("cancelling from a request (FR-052)", () => {
  it("lists the customer's order and cancels it after asking twice", async () => {
    data.open = [
      item({
        id: CANCEL_ID,
        kind: "cancel",
        customerName: "Svoboda",
        orders: [
          {
            id: ORDER_ID,
            number: 1024,
            pickupDay: "2026-11-26",
            totalCzk: 24,
            lines: [{ productId: "rohlik", name: "Rohlík", quantity: 6, unitPriceCzk: 4 }],
          },
        ],
      }),
    ];
    const screen = await renderWithQuery(<RequestsScreen />);
    expect(await screen.findByText("6× Rohlík")).toBeTruthy();
    await fireEvent.press(screen.getByText("Zrušit objednávku"));
    await fireEvent.press(screen.getByText("Ano, zrušit"));
    await sent(`/api/staff/requests/${CANCEL_ID}/cancel-order`, { orderId: ORDER_ID }, "POST");
  });
});

describe("today's closed requests and the archive (FR-053, FR-054)", () => {
  it("today's closed ones are folded; an employee has no archive", async () => {
    data.closedToday = [
      item({ id: CANCEL_ID, customerName: "Uzavřená", doneAt: "2026-11-25T09:00:00.000Z", outcome: "handled" }),
    ];
    const screen = await renderWithQuery(<RequestsScreen />);
    await screen.findByText("Bartošová");
    expect(screen.queryByText("Uzavřená")).toBeNull();
    await fireEvent.press(screen.getByText(/Dnes uzavřený \(1\)/));
    expect(screen.getByText("Uzavřená")).toBeTruthy();
    expect(screen.queryByText("Archiv")).toBeNull();
  });

  it("the owner opens the archive", async () => {
    mockPermissions = ["request:view", "request:resolve", "request:archive"];
    const screen = await renderWithQuery(<RequestsScreen />);
    await screen.findByText("Bartošová");
    await fireEvent.press(screen.getByText("Archiv"));
    expect(mockPush).toHaveBeenCalledWith("/archiv");
  });
});
