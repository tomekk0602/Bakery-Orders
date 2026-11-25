import { ROLE_PERMISSIONS } from "@bakery/core/permissions";
import { Redirect, router } from "expo-router";
import { act, fireEvent, renderRouter, screen } from "expo-router/testing-library";
import { Text } from "react-native";
import "@/shared/i18n";
import { StaffTabs } from "../StaffTabs";

jest.mock("@/shared/auth/client", () => ({ authClient: { signOut: jest.fn() }, useSession: jest.fn() }));
const mockMe = jest.fn();
jest.mock("@/features/auth/use-me", () => ({ useMe: () => mockMe() }));
jest.mock("@/features/notifications/NotificationBanner", () => ({ NotificationBanner: () => null }));
jest.mock("@/features/notifications/api", () => ({
  useNotifications: () => ({ data: { unread: 3, quiet: false, items: [] } }),
}));
jest.mock("@/features/requests/api", () => ({ useRequests: () => ({ data: { open: [], done: [] } }) }));

const page = (label: string) => () => <Text>{label}</Text>;
// the app's own index route: the first tab every role has
function RedirectToDnes() {
  return <Redirect href="/dnes" />;
}

async function open(initialUrl = "/dnes") {
  mockMe.mockReturnValue({
    isPending: false,
    isError: false,
    data: { user: { id: "1", name: "e", email: "e@x", role: "employee" }, permissions: ROLE_PERMISSIONS.employee },
  });
  await renderRouter(
    {
      "(app)/_layout": StaffTabs,
      "(app)/index": RedirectToDnes,
      "(app)/dnes": page("dnes"),
      "(app)/nova": page("nova"),
      "(app)/plan": page("plan"),
      "(app)/pozadavky": page("pozadavky"),
      "(app)/objednavka/[id]": page("order detail"),
      "(app)/upozorneni": page("notifications"),
    },
    { initialUrl },
  );
}

// Routes without a tab button must stay reachable: with `href: null` Expo Router 58 redirected them to
// the first tab (spec 001 FR-012 order detail, spec 002 FR-007 notification list).
describe("routes without a tab", () => {
  it("signing in opens Dnes, not a route without a tab (spec 001 FR-045, research R38)", async () => {
    await open("/");
    expect(screen).toHavePathname("/dnes");
    expect(screen.getByText("dnes")).toBeTruthy();
  });

  it("the bell opens Upozornění", async () => {
    await open();
    await fireEvent.press(screen.getByLabelText("Upozornění, 3 nepřečtená"));
    expect(screen).toHavePathname("/upozorneni");
    expect(screen.getByText("notifications")).toBeTruthy();
  });

  it("an order's detail opens", async () => {
    await open();
    await act(() => router.push("/objednavka/abc"));
    expect(screen).toHavePathname("/objednavka/abc");
    expect(screen.getByText("order detail")).toBeTruthy();
  });

  it("Zpět returns to the tab the person came from", async () => {
    await open("/pozadavky");
    await fireEvent.press(screen.getByLabelText("Upozornění, 3 nepřečtená"));
    expect(screen).toHavePathname("/upozorneni");
    await fireEvent.press(screen.getByText("‹ Zpět"));
    expect(screen).toHavePathname("/pozadavky");
  });

  it("Zpět without history, e.g. opened from a device notification, goes to Dnes", async () => {
    await open("/objednavka/abc");
    await fireEvent.press(screen.getByText("‹ Zpět"));
    expect(screen).toHavePathname("/dnes");
  });
});
