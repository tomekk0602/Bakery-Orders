import type { StaffRequestsResponse } from "@bakery/core/contracts";
import { fireEvent, waitFor } from "@testing-library/react-native";
import { renderWithQuery } from "@/test/render";
import { RequestsScreen } from "../RequestsScreen";

const mockApi = jest.fn();
jest.mock("@/shared/api/http", () => ({ api: (...args: unknown[]) => mockApi(...args) }));

const item = (over: Partial<StaffRequestsResponse["open"][number]>) => ({
  id: "55555555-5555-4555-8555-555555555555",
  kind: "callback" as const,
  origin: "agent" as const,
  customerName: "Bartošová",
  customerPhone: "+420604555666",
  note: "Ptá se na dort k narozeninám.",
  createdAt: "2026-11-24T08:00:00.000Z",
  doneAt: null,
  transcript: [{ role: "customer" as const, text: "Chtěla bych dort." }],
  ...over,
});
const data: StaffRequestsResponse = {
  open: [
    item({}),
    item({
      id: "66666666-6666-4666-8666-666666666666",
      origin: "promised_not_recorded",
      customerName: null,
      transcript: null,
    }),
  ],
  done: [],
};

beforeEach(() => {
  mockApi.mockReset();
  mockApi.mockImplementation((path: string) => Promise.resolve(path === "/api/staff/requests" ? data : { ok: true }));
});

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

  it("marks a request handled", async () => {
    const screen = await renderWithQuery(<RequestsScreen />);
    await screen.findByText("Bartošová");
    await fireEvent.press(screen.getAllByText("Vyřízeno")[0]!);
    await waitFor(() =>
      expect(mockApi).toHaveBeenCalledWith(
        "/api/staff/requests/55555555-5555-4555-8555-555555555555",
        expect.anything(),
        expect.objectContaining({ method: "PATCH", body: JSON.stringify({ done: true }) }),
      ),
    );
  });
});
