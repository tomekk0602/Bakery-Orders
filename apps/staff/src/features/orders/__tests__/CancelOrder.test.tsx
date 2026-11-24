import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { renderWithQuery } from "@/test/render";
import { CancelOrder } from "../CancelOrder";

const mockApi = jest.fn();
jest.mock("@/shared/api/http", () => ({ api: (...args: unknown[]) => mockApi(...args) }));
const ID = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  mockApi.mockReset();
  mockApi.mockResolvedValue({ ok: true });
});

describe("CancelOrder (FR-013)", () => {
  it("asks before cancelling and sends nothing on the first tap", async () => {
    await renderWithQuery(<CancelOrder id={ID} />);
    await fireEvent.press(screen.getByText("Zrušit objednávku"));
    expect(screen.getByText("Opravdu zrušit tuto objednávku?")).toBeTruthy();
    expect(mockApi).not.toHaveBeenCalled();
  });

  it("cancels on yes", async () => {
    await renderWithQuery(<CancelOrder id={ID} />);
    await fireEvent.press(screen.getByText("Zrušit objednávku"));
    await fireEvent.press(screen.getByText("Ano, zrušit"));
    await waitFor(() =>
      expect(mockApi).toHaveBeenCalledWith(
        `/api/staff/orders/${ID}`,
        expect.anything(),
        expect.objectContaining({ method: "PATCH", body: JSON.stringify({ status: "cancelled" }) }),
      ),
    );
  });

  it("keeps the order on no", async () => {
    await renderWithQuery(<CancelOrder id={ID} />);
    await fireEvent.press(screen.getByText("Zrušit objednávku"));
    await fireEvent.press(screen.getByText("Ne, ponechat"));
    expect(screen.getByText("Zrušit objednávku")).toBeTruthy();
    expect(mockApi).not.toHaveBeenCalled();
  });
});
