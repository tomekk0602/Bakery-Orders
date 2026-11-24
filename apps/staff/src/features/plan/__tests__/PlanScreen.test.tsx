import type { BakingPlanResponse } from "@bakery/core/contracts";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { renderWithQuery } from "@/test/render";
import { PlanScreen } from "../PlanScreen";

const mockApi = jest.fn();
jest.mock("@/shared/api/http", () => ({ api: (...args: unknown[]) => mockApi(...args) }));

const days = [
  { date: "2026-11-24", weekdayName: "úterý", relative: "today", closed: false },
  { date: "2026-11-25", weekdayName: "středa", relative: "tomorrow", closed: false },
  { date: "2026-11-29", weekdayName: "neděle", relative: null, closed: true },
] as const;
const plan = (date: string): BakingPlanResponse => ({
  day: days.find((d) => d.date === date) ?? days[1],
  lines: [
    { productId: "chleb-kminovy", name: "Kmínový chléb", reserved: 12, buffer: 15, toBake: 27 },
    { productId: "rohlik", name: "Rohlík", reserved: 40, buffer: 120, toBake: 160 },
  ],
  totals: { reserved: 52, buffer: 135, toBake: 187 },
  days: [...days],
});

const renderScreen = () => renderWithQuery(<PlanScreen />);

beforeEach(() => {
  mockApi.mockReset();
  mockApi.mockImplementation((path: string) => Promise.resolve(plan(path.split("day=")[1] ?? "2026-11-25")));
});

describe("PlanScreen (FR-010, FR-044)", () => {
  it("shows ordered, buffer and to-bake per product and in total, read-only", async () => {
    await renderScreen();
    expect(await screen.findByLabelText("Kmínový chléb, 12, 15, 27")).toBeTruthy();
    expect(screen.getByLabelText("Celkem, 52, 135, 187")).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("asks the server for the next open day first, then for a chosen day", async () => {
    await renderScreen();
    await screen.findByLabelText("Kmínový chléb, 12, 15, 27");
    expect(mockApi).toHaveBeenCalledWith("/api/staff/plan", expect.anything());
    await fireEvent.press(screen.getByLabelText(/neděle|29\. 11\..*zavřeno/));
    await waitFor(() => expect(mockApi).toHaveBeenCalledWith("/api/staff/plan?day=2026-11-29", expect.anything()));
  });
});
