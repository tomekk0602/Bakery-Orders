import { ROLE_PERMISSIONS, type Role } from "@bakery/core/permissions";
import { renderRouter } from "expo-router/testing-library";
import { Text } from "react-native";
import "@/shared/i18n";
import { StaffTabs } from "../StaffTabs";

// The session and the server's answer are stand-ins; the behaviour under test is which tabs a role gets.
jest.mock("@/shared/auth/client", () => ({ authClient: { signOut: jest.fn() }, useSession: jest.fn() }));
const mockMe = jest.fn();
jest.mock("@/features/auth/use-me", () => ({ useMe: () => mockMe() }));
// the banner has its own tests and needs a query client this test does not set up
jest.mock("@/features/notifications/NotificationBanner", () => ({ NotificationBanner: () => null }));
jest.mock("@/features/notifications/api", () => ({
  notificationKeys: { list: ["notifications"] },
  useNotifications: () => ({ data: { unread: 3, quiet: false, items: [] } }),
  useReadNotification: () => ({ mutate: jest.fn() }),
}));
jest.mock("@/features/requests/api", () => ({
  useRequests: () => ({ data: { open: [{ id: "a" }, { id: "b" }], done: [] } }),
}));

async function signInAs(role: Role) {
  mockMe.mockReturnValue({
    isPending: false,
    isError: false,
    data: { user: { id: "1", name: role, email: `${role}@x`, role }, permissions: ROLE_PERMISSIONS[role] },
  });
  const tab = () => <Text>tab</Text>;
  return await renderRouter(
    {
      "(app)/_layout": StaffTabs,
      "(app)/dnes": tab,
      "(app)/nova": tab,
      "(app)/plan": tab,
      "(app)/pozadavky": tab,
      "(app)/nastaveni": tab,
      "(app)/provoz": tab,
      "(app)/upozorneni": tab,
    },
    { initialUrl: "/dnes" },
  );
}

describe("StaffTabs (FR-045)", () => {
  it("the selected tab's icon is filled, the others outlined; an employee has none of the owner's (FR-075)", async () => {
    const screen = await signInAs("employee");
    // the icons are hidden from screen readers, which read the tab's label instead
    const hidden = { includeHiddenElements: true };
    expect(screen.getByTestId("tab-icon-dnes-filled", hidden)).toBeTruthy();
    for (const tab of ["nova", "plan", "pozadavky"])
      expect(screen.getByTestId(`tab-icon-${tab}-outline`, hidden)).toBeTruthy();
    expect(screen.queryByTestId("tab-icon-nastaveni-outline", hidden)).toBeNull();
    expect(screen.queryByTestId("tab-icon-provoz-outline", hidden)).toBeNull();
  });

  it("the bar shows the short label, the page keeps its full title (FR-075)", async () => {
    const screen = await signInAs("employee");
    expect(screen.getAllByText("Nová").length).toBeGreaterThan(0);
  });

  it("an employee sees the counter tabs but not Nastavení or Provoz", async () => {
    const screen = await signInAs("employee");
    for (const title of ["Dnes", "Nová", "Plán", "Požadavky"])
      expect(screen.getAllByText(title).length).toBeGreaterThan(0);
    expect(screen.queryByText("Nastavení")).toBeNull();
    expect(screen.queryByText("Provoz")).toBeNull();
    expect(screen.getByText("Prodavač")).toBeTruthy();
  });

  it("an owner also sees Nastavení and Provoz", async () => {
    const screen = await signInAs("owner");
    expect(screen.getAllByText("Nastavení").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Provoz").length).toBeGreaterThan(0);
    expect(screen.getByText("Majitel")).toBeTruthy();
  });

  it("shows the number of open requests on the Požadavky tab (FR-041)", async () => {
    const screen = await signInAs("employee");
    expect(screen.getAllByText("2").length).toBeGreaterThan(0);
  });
});
