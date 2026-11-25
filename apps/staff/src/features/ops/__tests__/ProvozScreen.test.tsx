import type { ProvozResponse } from "@bakery/core/contracts";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { renderWithQuery } from "@/test/render";
import { ProvozScreen } from "../ProvozScreen";

const mockApi = jest.fn();
jest.mock("@/shared/api/http", () => ({ api: (...args: unknown[]) => mockApi(...args) }));

const stats = (over: Partial<ProvozResponse> = {}): ProvozResponse => ({
  period: { days: 7, from: "2026-11-17", to: "2026-11-24" },
  calls: { total: 12, order: 8, request: 2, abandoned: 1, capped: 0, error: 1, open: 0 },
  firstAudio: { samples: 40, p50Ms: 2100, p95Ms: 3300 },
  orders: { phone: 8, web: 3, staff: 5 },
  phoneCorrectedShare: null,
  cost: { shadowUsd: 0.12, perCallUsd: 0.01, perPhoneOrderUsd: 0.015, pricesReadOn: "2026-11-24" },
  notifications: { pushFailed: 0 },
  promptVersions: [{ version: "2026-11-24.4", calls: 12 }],
  ...over,
});

beforeEach(() => {
  mockApi.mockReset();
  mockApi.mockResolvedValue(stats());
});

describe("ProvozScreen (FR-033)", () => {
  it("shows outcomes, response time in seconds, channels and cost", async () => {
    await renderWithQuery(<ProvozScreen />);
    expect(await screen.findByLabelText("Celkem hovorů: 12")).toBeTruthy();
    expect(screen.getByLabelText("Objednávka: 8")).toBeTruthy();
    expect(screen.getByLabelText("Medián: 2,1 s")).toBeTruthy();
    expect(screen.getByLabelText("95 % odpovědí do: 3,3 s")).toBeTruthy();
    expect(screen.getByLabelText("Web: 3")).toBeTruthy();
    expect(screen.getByLabelText(/Na hovor: 0,01/)).toBeTruthy();
  });

  it("says what is not measured instead of showing zero", async () => {
    mockApi.mockResolvedValue(stats({ firstAudio: { samples: 0, p50Ms: null, p95Ms: null } }));
    await renderWithQuery(<ProvozScreen />);
    expect(await screen.findByText("Zatím žádné měření.")).toBeTruthy();
    expect(screen.getByLabelText("Telefonické objednávky opravené obsluhou: zatím neměřeno")).toBeTruthy();
  });

  it("switches between 7 and 30 days", async () => {
    await renderWithQuery(<ProvozScreen />);
    await screen.findByLabelText("Celkem hovorů: 12");
    expect(mockApi).toHaveBeenCalledWith("/api/staff/provoz?days=7", expect.anything());
    await fireEvent.press(screen.getByText("30 dní"));
    await waitFor(() => expect(mockApi).toHaveBeenCalledWith("/api/staff/provoz?days=30", expect.anything()));
  });
});
