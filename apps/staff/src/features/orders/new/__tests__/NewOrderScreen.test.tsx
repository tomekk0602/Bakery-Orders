import type { OrderCard, OrderFormResponse } from "@bakery/core/contracts";
import { fireEvent, waitFor } from "@testing-library/react-native";
import { renderWithQuery } from "@/test/render";
import { NewOrderScreen } from "../NewOrderScreen";

const mockApi = jest.fn();
jest.mock("@/shared/api/http", () => ({ api: (...args: unknown[]) => mockApi(...args) }));

const form: OrderFormResponse = {
  products: [
    { id: "chleb-kminovy", name: "Kmínový chléb", priceCzk: 69 },
    { id: "rohlik", name: "Rohlík", priceCzk: 4 },
  ],
  days: [
    { date: "2026-11-24", weekdayName: "úterý", relative: "today", closed: false },
    { date: "2026-11-25", weekdayName: "středa", relative: "tomorrow", closed: false },
  ],
};
const card: OrderCard = {
  draftId: "33333333-3333-4333-8333-333333333333",
  customerName: "Nováková",
  customerPhone: null,
  pickupDate: "2026-11-25",
  pickupWeekdayName: "středa",
  lines: [{ productId: "chleb-kminovy", name: "Kmínový chléb", quantity: 2, unitPriceCzk: 69, subtotalCzk: 138 }],
  totalCzk: 138,
};

beforeEach(() => {
  mockApi.mockReset();
  mockApi.mockImplementation((path: string) => {
    if (path === "/api/staff/order-form") return Promise.resolve(form);
    if (path === "/api/staff/orders") return Promise.resolve(card);
    return Promise.resolve({ orderId: "44444444-4444-4444-8444-444444444444", orderNumber: 1042 });
  });
});

const renderScreen = () => renderWithQuery(<NewOrderScreen />);
async function renderForm() {
  const screen = await renderScreen();
  await fireEvent.press(await screen.findByText("Formulářem"));
  return screen;
}

describe("NewOrderScreen (US6, FR-017, FR-019, FR-021)", () => {
  it("form → card priced by the server → saved, with tomorrow preselected and no phone", async () => {
    const screen = await renderForm();
    await fireEvent.changeText(await screen.findByLabelText("Jméno zákazníka"), "Nováková");
    await fireEvent.press(screen.getByLabelText("Přidat: Kmínový chléb"));
    await fireEvent.press(screen.getByLabelText("Přidat: Kmínový chléb"));
    await fireEvent.press(screen.getByText("Zkontrolovat objednávku"));
    await waitFor(() =>
      expect(mockApi).toHaveBeenCalledWith(
        "/api/staff/orders",
        expect.anything(),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            customerName: "Nováková",
            customerPhone: null,
            pickupDate: "2026-11-25",
            items: [{ productId: "chleb-kminovy", quantity: 2 }],
          }),
        }),
      ),
    );
    expect(await screen.findByText("Celkem 138 Kč")).toBeTruthy();
    // nothing saved until "Potvrdit"
    expect(mockApi).not.toHaveBeenCalledWith(expect.stringContaining("/confirm"), expect.anything(), expect.anything());
    await fireEvent.press(screen.getByText("Potvrdit"));
    expect(await screen.findByText("Objednávka č. 1042 je uložená.")).toBeTruthy();
  });

  it("asks for a name and at least one product before sending anything", async () => {
    const screen = await renderForm();
    await fireEvent.press(await screen.findByText("Zkontrolovat objednávku"));
    expect(await screen.findByText("Zadejte jméno zákazníka.")).toBeTruthy();
    expect(screen.getByText("Přidejte alespoň jeden výrobek.")).toBeTruthy();
    expect(mockApi).not.toHaveBeenCalledWith("/api/staff/orders", expect.anything(), expect.anything());
  });

  it("shows the server's refusal on the form", async () => {
    mockApi.mockImplementation((path: string) =>
      path === "/api/staff/order-form" ? Promise.resolve(form) : Promise.reject(new Error("V tento den je zavřeno.")),
    );
    const screen = await renderForm();
    await fireEvent.changeText(await screen.findByLabelText("Jméno zákazníka"), "Novák");
    await fireEvent.press(screen.getByLabelText("Přidat: Rohlík"));
    await fireEvent.press(screen.getByText("Zkontrolovat objednávku"));
    expect(await screen.findByText("V tento den je zavřeno.")).toBeTruthy();
  });

  it("by voice: a complete sentence goes straight to the order card (FR-018, FR-019)", async () => {
    mockApi.mockImplementation((path: string) =>
      Promise.resolve(
        path === "/api/staff/order-form"
          ? form
          : {
              text: "x",
              extraction: { customerName: "Nováková", pickupDate: "2026-11-25", items: [] },
              unmatched: [],
              missing: [],
              card,
              refusal: null,
            },
      ),
    );
    const screen = await renderScreen();
    await fireEvent.changeText(await screen.findByLabelText("Objednávka"), "Nováková, dva kmínové na zítra");
    await fireEvent.press(screen.getByText("Zpracovat"));
    expect(await screen.findByText("Celkem 138 Kč")).toBeTruthy();
    expect(mockApi).toHaveBeenCalledWith(
      "/api/staff/dictation",
      expect.anything(),
      expect.objectContaining({ body: JSON.stringify({ text: "Nováková, dva kmínové na zítra" }) }),
    );
  });

  it("by voice: an unknown word is never guessed — staff pick the product, and the form is prefilled (FR-020)", async () => {
    mockApi.mockImplementation((path: string) => {
      if (path === "/api/staff/order-form") return Promise.resolve(form);
      if (path === "/api/staff/dictation")
        return Promise.resolve({
          text: "x",
          extraction: {
            customerName: "Nováková",
            pickupDate: "2026-11-25",
            items: [{ productId: "rohlik", quantity: 6 }],
          },
          unmatched: [{ word: "razowy", quantity: 1, candidates: [{ id: "chleb-kminovy", name: "Kmínový chléb" }] }],
          missing: [],
          card: null,
          refusal: null,
        });
      return Promise.resolve(card);
    });
    const screen = await renderScreen();
    await fireEvent.changeText(await screen.findByLabelText("Objednávka"), "Nováková, šest rohlíků a razowy");
    await fireEvent.press(screen.getByText("Zpracovat"));
    expect(await screen.findByText("Nerozpoznáno: „razowy“ (1×). Vyberte výrobek:")).toBeTruthy();
    expect(screen.getByLabelText("Jméno zákazníka").props.value).toBe("Nováková");
    await fireEvent.press(screen.getByRole("button", { name: "Kmínový chléb" }));
    await fireEvent.press(screen.getByText("Zkontrolovat objednávku"));
    await waitFor(() =>
      expect(mockApi).toHaveBeenCalledWith(
        "/api/staff/orders",
        expect.anything(),
        expect.objectContaining({
          body: JSON.stringify({
            customerName: "Nováková",
            customerPhone: null,
            pickupDate: "2026-11-25",
            items: [
              { productId: "rohlik", quantity: 6 },
              { productId: "chleb-kminovy", quantity: 1 },
            ],
          }),
        }),
      ),
    );
  });

  it("by voice: when dictation is unavailable the message says so and the form remains (FR-022)", async () => {
    mockApi.mockImplementation((path: string) =>
      path === "/api/staff/order-form"
        ? Promise.resolve(form)
        : Promise.reject(new Error("Diktování je teď nedostupné. Použijte formulář.")),
    );
    const screen = await renderScreen();
    await fireEvent.changeText(await screen.findByLabelText("Objednávka"), "dva chleby");
    await fireEvent.press(screen.getByText("Zpracovat"));
    expect(await screen.findByText("Diktování je teď nedostupné. Použijte formulář.")).toBeTruthy();
    expect(screen.getByText("Formulářem")).toBeTruthy();
  });
});
