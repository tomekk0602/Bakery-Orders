import type { BakerySettings } from "@bakery/core/contracts";
import { fireEvent, waitFor } from "@testing-library/react-native";
import { renderWithQuery } from "@/test/render";
import { SettingsScreen } from "../SettingsScreen";

const mockApi = jest.fn();
jest.mock("@/shared/api/http", () => ({ api: (...args: unknown[]) => mockApi(...args) }));

const settings: BakerySettings = {
  cutoffDaysBefore: 1,
  cutoffTime: "14:00",
  closedWeekdays: [7],
  closedDays: [],
  products: [{ id: "rohlik", name: "Rohlík", priceCzk: 4, dailyLimit: null, active: true, buffers: [120, 120, 120, 120, 120, 180, 0] }],
};

beforeEach(() => {
  mockApi.mockReset();
  mockApi.mockImplementation((path: string, _s: unknown, init?: RequestInit) => {
    if (path === "/api/staff/settings") return Promise.resolve(init?.method === "PUT" ? JSON.parse(String(init.body)) : settings);
    return Promise.resolve({ ok: true });
  });
});

const putCall = () => mockApi.mock.calls.find((c) => (c[2] as RequestInit | undefined)?.method === "PUT");

describe("SettingsScreen (FR-011, FR-042)", () => {
  it("saves a new price, a limit and a buffer as numbers", async () => {
    const screen = await renderWithQuery(<SettingsScreen />);
    await fireEvent.changeText(await screen.findByLabelText("Cena: Rohlík"), "5");
    await fireEvent.changeText(screen.getByLabelText("Limit za den: Rohlík"), "300");
    await fireEvent.changeText(screen.getByLabelText("Odhad prodeje: Rohlík, So"), "200");
    await fireEvent.press(screen.getByText("Uložit nastavení"));
    await waitFor(() => expect(putCall()).toBeTruthy());
    const sent = JSON.parse(String((putCall()![2] as RequestInit).body)) as BakerySettings;
    expect(sent.products[0]).toMatchObject({ priceCzk: 5, dailyLimit: 300, buffers: [120, 120, 120, 120, 120, 200, 0] });
  });

  it("a bad price blocks saving", async () => {
    const screen = await renderWithQuery(<SettingsScreen />);
    await fireEvent.changeText(await screen.findByLabelText("Cena: Rohlík"), "0");
    await fireEvent.press(screen.getByText("Uložit nastavení"));
    expect(await screen.findByText("Zadejte cenu v Kč.")).toBeTruthy();
    expect(putCall()).toBeUndefined();
  });

  it("closing every weekday is refused before sending", async () => {
    const screen = await renderWithQuery(<SettingsScreen />);
    for (const d of ["Po", "Út", "St", "Čt", "Pá", "So"]) await fireEvent.press(await screen.findByLabelText(d));
    await fireEvent.press(screen.getByText("Uložit nastavení"));
    expect(await screen.findByText("Alespoň jeden den v týdnu musí být otevřeno.")).toBeTruthy();
    expect(putCall()).toBeUndefined();
  });

  it("reset demo needs a second tap", async () => {
    const screen = await renderWithQuery(<SettingsScreen />);
    await fireEvent.press(await screen.findByText("Obnovit demo"));
    expect(mockApi).not.toHaveBeenCalledWith("/api/staff/reset", expect.anything(), expect.anything());
    await fireEvent.press(screen.getByText("Opravdu obnovit"));
    await waitFor(() => expect(mockApi).toHaveBeenCalledWith("/api/staff/reset", expect.anything(), expect.objectContaining({ method: "POST" })));
  });
});
