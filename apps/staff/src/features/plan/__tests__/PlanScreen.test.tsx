import type { BakingPlanResponse } from "@bakery/core/contracts";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { renderWithQuery } from "@/test/render";
import { PlanScreen } from "../PlanScreen";

const mockApi = jest.fn();
jest.mock("@/shared/api/http", () => ({ api: (...args: unknown[]) => mockApi(...args) }));
// the day is in the address (spec 002 FR-028): the test sets it and sees what the screen asks for
let mockParams: { day?: string } = {};
const mockSetParams = jest.fn();
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ setParams: mockSetParams }),
}));

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
  mockParams = {};
  mockSetParams.mockReset();
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

  it("without a day it asks for the next open day; choosing a day puts it in the address", async () => {
    await renderScreen();
    await screen.findByLabelText("Kmínový chléb, 12, 15, 27");
    expect(mockApi).toHaveBeenCalledWith("/api/staff/plan", expect.anything());
    await fireEvent.press(screen.getByLabelText(/neděle|29\. 11\..*zavřeno/));
    expect(mockSetParams).toHaveBeenCalledWith({ day: "2026-11-29" });
  });

  it("opened from a plan notification it shows the day the notification names (spec 002 FR-028)", async () => {
    mockParams = { day: "2026-11-29" };
    await renderScreen();
    await waitFor(() => expect(mockApi).toHaveBeenCalledWith("/api/staff/plan?day=2026-11-29", expect.anything()));
    expect(mockApi).not.toHaveBeenCalledWith("/api/staff/plan", expect.anything());
  });
});
