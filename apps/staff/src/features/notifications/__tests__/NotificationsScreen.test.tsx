import type { NotificationList, NotificationSettings } from "@bakery/core/contracts";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { renderWithQuery } from "@/test/render";
import { NotificationsScreen } from "../NotificationsScreen";

const mockApi = jest.fn();
jest.mock("@/shared/api/http", () => ({ api: (...args: unknown[]) => mockApi(...args) }));
const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));

const list: NotificationList = {
  unread: 1,
  quiet: false,
  items: [
    {
      id: "00000000-0000-4000-8000-000000000001",
      kind: "request",
      title: "Nový požadavek",
      body: "Zákazník chce, abyste mu zavolali.",
      link: "/pozadavky",
      createdAt: "2026-11-24T09:00:00.000Z",
      readAt: null,
    },
    {
      id: "00000000-0000-4000-8000-000000000002",
      kind: "plan_summary",
      title: "Plán na středa 25. 11.",
      body: "3 objednávky.",
      link: "/plan",
      createdAt: "2026-11-23T13:00:00.000Z",
      readAt: "2026-11-23T14:00:00.000Z",
    },
  ],
};
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
  mockPush.mockReset();
  mockApi.mockImplementation((path: string, _schema: unknown, init?: RequestInit) => {
    if (path === "/api/staff/notifications") return Promise.resolve(list);
    if (path === "/api/staff/notification-settings" && init?.method === "PUT")
      return Promise.resolve(JSON.parse(String(init.body)) as unknown);
    if (path === "/api/staff/notification-settings") return Promise.resolve(settings);
    if (path === "/api/staff/notifications/read-all") return Promise.resolve({ read: 1 });
    return Promise.resolve({ ok: true });
  });
});

/** The list is read again after a mutation; waiting for it keeps the refetch inside this test. */
const listReads = () => mockApi.mock.calls.filter((c) => c[0] === "/api/staff/notifications").length;

/** Renders and waits until both the list and the settings have loaded, so no update overlaps the next test. */
async function renderScreen() {
  await renderWithQuery(<NotificationsScreen />);
  await screen.findByText("Plán na další den");
  await screen.findByText("Toto zařízení upozornění neumí. V aplikaci je uvidíte i tak.");
}

describe("NotificationsScreen (spec 002 FR-007, FR-008)", () => {
  it("lists the person's notifications; opening one reads it and goes where it points", async () => {
    await renderScreen();
    await fireEvent.press(
      await screen.findByLabelText("Nepřečtené: Nový požadavek. Zákazník chce, abyste mu zavolali."),
    );
    await waitFor(() =>
      expect(mockApi).toHaveBeenCalledWith(
        "/api/staff/notifications/00000000-0000-4000-8000-000000000001",
        expect.anything(),
        expect.objectContaining({ method: "PATCH" }),
      ),
    );
    expect(mockPush).toHaveBeenCalledWith("/pozadavky");
    await waitFor(() => expect(listReads()).toBe(2));
  });

  it("an already read one is not read again; all can be marked read", async () => {
    await renderScreen();
    await fireEvent.press(await screen.findByLabelText("Plán na středa 25. 11.. 3 objednávky."));
    expect(mockPush).toHaveBeenCalledWith("/plan");
    expect(mockApi).not.toHaveBeenCalledWith(expect.stringMatching(/0002$/), expect.anything(), expect.anything());
    await fireEvent.press(screen.getByText("Označit vše jako přečtené"));
    await waitFor(() =>
      expect(mockApi).toHaveBeenCalledWith(
        "/api/staff/notifications/read-all",
        expect.anything(),
        expect.objectContaining({ method: "POST" }),
      ),
    );
    await waitFor(() => expect(listReads()).toBe(2));
  });
});
