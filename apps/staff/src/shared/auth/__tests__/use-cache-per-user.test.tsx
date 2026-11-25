import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { fireEvent, render, renderHook, screen } from "@testing-library/react-native";
import { memo, useState } from "react";
import { Pressable, Text } from "react-native";
import { useCachePerUser } from "../use-cache-per-user";

describe("useCachePerUser (spec 001 FR-059)", () => {
  it("keeps the cache for the same person and drops it when another signs in or the person signs out", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
    client.setQueryData(["staff", "me"], { user: "owner" });
    const view = await renderHook(({ id }: { id: string | null }) => useCachePerUser(client, id), {
      initialProps: { id: "owner-1" },
    });
    await view.rerender({ id: "owner-1" });
    expect(client.getQueryData(["staff", "me"])).toEqual({ user: "owner" });

    await view.rerender({ id: "employee-1" });
    expect(client.getQueryData(["staff", "me"])).toBeUndefined();

    client.setQueryData(["staff", "me"], { user: "employee" });
    await view.rerender({ id: null });
    expect(client.getQueryData(["staff", "me"])).toBeUndefined();
  });
});

describe("signing in does not leave a screen waiting (spec 001 FR-059)", () => {
  it("a query a screen is already waiting on when the person changes still gets its answer", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    // the first answer is still on its way when the session arrives
    let firstAnswer!: (v: string) => void;
    const fetchMe = jest
      .fn()
      .mockImplementationOnce(() => new Promise<string>((r) => (firstAnswer = r)))
      .mockResolvedValue("owner");
    // As in the app: the screen that asks for "me" does not re-render when the session arrives above it.
    const Screen = memo(function Screen() {
      const me = useQuery({ queryKey: ["staff", "me"], queryFn: fetchMe });
      return <Text>{me.isPending ? "loading" : `me: ${me.data}`}</Text>;
    });
    function Gate() {
      const [userId, setUserId] = useState<string | null>(null);
      useCachePerUser(client, userId);
      return (
        <>
          <Pressable onPress={() => setUserId("owner-1")}>
            <Text>sign in</Text>
          </Pressable>
          <Screen />
        </>
      );
    }
    await render(
      <QueryClientProvider client={client}>
        <Gate />
      </QueryClientProvider>,
    );
    await fireEvent.press(screen.getByText("sign in"));
    firstAnswer("owner");
    expect(await screen.findByText("me: owner")).toBeTruthy();
  });
});
