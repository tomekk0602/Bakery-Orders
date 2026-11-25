import { type QueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

/**
 * Drops every cached answer when the signed-in person changes, signing out included, so the next
 * person never sees the previous one's data or permissions, not even for a moment (spec 001 FR-059).
 * The server checks permissions on every request either way; this is about what the screen shows.
 *
 * `resetQueries`, not `clear`: clearing removes a query a screen is already waiting on — right after
 * signing in, "/api/staff/me" — and that screen then waits for ever. Resetting empties every answer and
 * asks again for those on screen.
 */
export function useCachePerUser(queryClient: QueryClient, userId: string | null): void {
  const previous = useRef(userId);
  useEffect(() => {
    if (previous.current === userId) return;
    previous.current = userId;
    void queryClient.resetQueries();
  }, [queryClient, userId]);
}
