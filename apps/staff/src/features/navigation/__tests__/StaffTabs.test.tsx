import { ROLE_PERMISSIONS, type Role } from "@bakery/core/permissions";
import { renderRouter } from "expo-router/testing-library";
import { Text } from "react-native";
import "@/shared/i18n";
import { StaffTabs } from "../StaffTabs";

// The session and the server's answer are stand-ins; the behaviour under test is which tabs a role gets.
jest.mock("@/shared/auth/client", () => ({ authClient: { signOut: jest.fn() }, useSession: jest.fn() }));
const mockMe = jest.fn();
jest.mock("@/features/auth/use-me", () => ({ useMe: () => mockMe() }));

async function signInAs(role: Role) {
  mockMe.mockReturnValue({ isPending: false, isError: false, data: { user: { id: "1", name: role, email: `${role}@x`, role }, permissions: ROLE_PERMISSIONS[role] } });
  const tab = () => <Text>tab</Text>;
  return await renderRouter(
    { "(app)/_layout": StaffTabs, "(app)/dnes": tab, "(app)/nova": tab, "(app)/plan": tab, "(app)/pozadavky": tab, "(app)/nastaveni": tab, "(app)/provoz": tab },
    { initialUrl: "/dnes" },
  );
}

describe("StaffTabs (FR-045)", () => {
  it("an employee sees the counter tabs but not Nastavení or Provoz", async () => {
    const screen = await signInAs("employee");
    for (const title of ["Dnes", "Nová objednávka", "Plán", "Požadavky"]) expect(screen.getAllByText(title).length).toBeGreaterThan(0);
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
});
