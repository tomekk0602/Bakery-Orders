import type { RequestArchivePage } from "@bakery/core/contracts";
import { fireEvent, waitFor } from "@testing-library/react-native";
import { renderWithQuery } from "@/test/render";
import { ArchiveScreen } from "../ArchiveScreen";

const mockApi = jest.fn();
jest.mock("@/shared/api/http", () => ({ api: (...args: unknown[]) => mockApi(...args) }));
jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));

const closed = (n: number): RequestArchivePage["items"][number] => ({
  id: `00000000-0000-4000-8000-0000000000${String(n).padStart(2, "0")}`,
  kind: "callback",
  origin: "agent",
  customerName: `Zákazník ${n}`,
  customerPhone: "+420600000000",
  note: "Zavolat",
  createdAt: "2026-11-20T08:00:00.000Z",
  doneAt: "2026-11-21T08:00:00.000Z",
  transcript: null,
  outcome: "handled",
  callingNow: null,
  attempts: 0,
  canCloseUnreachable: false,
  history: [{ kind: "handled", by: "Jana", at: "2026-11-21T08:00:00.000Z", note: "domluveno", orderNumber: null }],
  orders: [],
});

beforeEach(() => {
  mockApi.mockReset();
  mockApi.mockImplementation((path: string) =>
    Promise.resolve(
      path.includes("cursor=c1")
        ? { items: [closed(2)], nextCursor: null }
        : path.startsWith("/api/staff/requests/archive")
          ? { items: [closed(1)], nextCursor: "c1" }
          : { ok: true },
    ),
  );
});

describe("ArchiveScreen (spec 001 FR-054–FR-056)", () => {
  it("lists closed requests and loads older ones", async () => {
    const screen = await renderWithQuery(<ArchiveScreen />);
    expect(await screen.findByText("Zákazník 1")).toBeTruthy();
    await fireEvent.press(screen.getByText("Načíst starší"));
    expect(await screen.findByText("Zákazník 2")).toBeTruthy();
    expect(screen.queryByText("Načíst starší")).toBeNull();
  });

  it("filters by outcome and searches after typing pauses", async () => {
    const screen = await renderWithQuery(<ArchiveScreen />);
    await screen.findByText("Zákazník 1");
    await fireEvent.press(screen.getByText("Nedovoláno"));
    await waitFor(() =>
      expect(mockApi).toHaveBeenCalledWith("/api/staff/requests/archive?outcome=unreachable", expect.anything()),
    );
    await fireEvent.changeText(screen.getByLabelText("Hledat jméno nebo telefon"), "777");
    await waitFor(() =>
      expect(mockApi).toHaveBeenCalledWith("/api/staff/requests/archive?outcome=unreachable&q=777", expect.anything()),
    );
  });

  it("a card can be reopened", async () => {
    const screen = await renderWithQuery(<ArchiveScreen />);
    await screen.findByText("Zákazník 1");
    await fireEvent.press(screen.getByText("Vrátit mezi otevřené"));
    await waitFor(() =>
      expect(mockApi).toHaveBeenCalledWith(
        "/api/staff/requests/00000000-0000-4000-8000-000000000001",
        expect.anything(),
        expect.objectContaining({ method: "PATCH", body: JSON.stringify({ action: "reopen" }) }),
      ),
    );
  });
});
