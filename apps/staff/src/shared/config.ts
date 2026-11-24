import Constants from "expo-constants";
import { Platform } from "react-native";

/**
 * The web app's URL. `EXPO_PUBLIC_API_URL` wins; in development on a phone the API runs on the same
 * machine as the Expo dev server, so its host is taken from there (localhost would be the phone).
 */
function devHost(): string | null {
  const hostUri = Constants.expoConfig?.hostUri;
  return hostUri ? `http://${hostUri.split(":")[0]}:3000` : null;
}

/**
 * The deployed web build is served by the API itself (research R28): same origin, so the session
 * cookie is first-party in every browser. `EXPO_PUBLIC_API_SAME_ORIGIN` is set only for that build.
 */
const sameOrigin = (): string | null =>
  Platform.OS === "web" && process.env.EXPO_PUBLIC_API_SAME_ORIGIN === "true" ? window.location.origin : null;

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? sameOrigin() ?? devHost() ?? "http://localhost:3000";
export const APP_SCHEME = "bakerystaff";
