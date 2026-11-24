import Constants from "expo-constants";

/**
 * The web app's URL. `EXPO_PUBLIC_API_URL` wins; in development on a phone the API runs on the same
 * machine as the Expo dev server, so its host is taken from there (localhost would be the phone).
 */
function devHost(): string | null {
  const hostUri = Constants.expoConfig?.hostUri;
  return hostUri ? `http://${hostUri.split(":")[0]}:3000` : null;
}

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? devHost() ?? "http://localhost:3000";
export const APP_SCHEME = "bakerystaff";
