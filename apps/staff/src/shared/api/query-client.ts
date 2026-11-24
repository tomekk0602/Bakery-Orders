import { QueryCache, QueryClient } from "@tanstack/react-query";
import { authClient } from "../auth/client";
import { ApiRequestError } from "./http";

/** An expired session ends here, in one place: sign out, and the router guard shows the login. */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => {
        if (error instanceof ApiRequestError && error.status === 401) void authClient.signOut();
      },
    }),
    defaultOptions: {
      queries: { retry: (count, error) => !(error instanceof ApiRequestError && error.status < 500) && count < 2 },
    },
  });
}
