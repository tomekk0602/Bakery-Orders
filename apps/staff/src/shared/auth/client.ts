import { expoClient } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";
import { API_URL, APP_SCHEME } from "../config";

/**
 * The one session module (ADR-0015). Better Auth keeps the session cookie in SecureStore on the
 * phone and in the browser's cookies on the web. No password is ever stored on the device.
 */
export const authClient = createAuthClient({
  baseURL: API_URL,
  fetchOptions: { credentials: "include" },
  plugins: [expoClient({ scheme: APP_SCHEME, storagePrefix: "bakery", storage: SecureStore })],
});

export const useSession = authClient.useSession;
