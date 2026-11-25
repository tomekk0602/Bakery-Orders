import type { NotificationSettings } from "@bakery/core/contracts";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { renderWithQuery } from "@/test/render";
import { NotificationSettingsSection } from "../NotificationSettingsSection";

const mockApi = jest.fn();
jest.mock("@/shared/api/http", () => ({ api: (...args: unknown[]) => mockApi(...args) }));

const settings: NotificationSettings = {
  kinds: [
    { kind: "request", inApp: true, push: true, allowed: true },
    { kind: "plan_summary", inApp: false, push: false, allowed: true },
    { kind: "near_limit", inApp: false, push: false, allowed: false },
    { kind: "plan_changed", inApp: true, push: true, allowed: true },
    { kind: "assistant_down", inApp: false, push: false, allowed: false },
  ],
  quietHours: { enabled: true, from: "20:00", to: "04:00" },
  vapidPublicKey: null,
  devices: [],
};

beforeEach(() => {
  mockApi.mockReset();
  mockApi.mockImplementation((_path: string, _schema: unknown, init?: RequestInit) =>
    Promise.resolve(init?.method === "PUT" ? { ...settings, ...(JSON.parse(String(init.body)) as object) } : settings),
  );
});

describe("NotificationSettingsSection (spec 002 FR-013, FR-014, FR-015)", () => {
  it("shows only the kinds the role may get, and says when this device cannot get them", async () => {
    await renderWithQuery(<NotificationSettingsSection />);
    await screen.findByText("Plán na další den");
    expect(screen.queryByText("Telefonní asistent nefunguje")).toBeNull();
    expect(screen.getByText("Toto zařízení upozornění neumí. V aplikaci je uvidíte i tak.")).toBeTruthy();

    await fireEvent(screen.getByLabelText("Plán na další den: V aplikaci"), "valueChange", true);
    await fireEvent.press(screen.getByText("Uložit upozornění"));
    await waitFor(() =>
      expect(mockApi).toHaveBeenCalledWith(
        "/api/staff/notification-settings",
        expect.anything(),
        expect.objectContaining({ method: "PUT" }),
      ),
    );
    const put = mockApi.mock.calls.find((c) => (c[2] as RequestInit | undefined)?.method === "PUT")!;
    const body = JSON.parse(String((put[2] as RequestInit).body)) as { kinds: { kind: string; inApp: boolean }[] };
    expect(body.kinds.find((k) => k.kind === "plan_summary")?.inApp).toBe(true);
  });
});
