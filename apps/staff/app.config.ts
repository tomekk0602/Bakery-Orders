import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * app.json plus one build-time switch: the deployed web build is served by the web app under `/staff`
 * (research R28), so `EXPO_BASE_URL` sets the path its routes and assets live under. Unset in
 * development and for the native apps.
 */
export default ({ config }: ConfigContext): ExpoConfig =>
  ({
    ...config,
    experiments: { ...config.experiments, baseUrl: process.env.EXPO_BASE_URL ?? "" },
  }) as ExpoConfig;
