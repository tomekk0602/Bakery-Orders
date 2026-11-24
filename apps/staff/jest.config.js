/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" },
  // Workspace packages ship TypeScript source; better-auth and friends ship ESM.
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|react-native-svg|@bakery/.*|better-auth|@better-auth/.*|@better-fetch/.*|nanostores|@nanostores/.*|i18next|react-i18next|zod|standard-navigation))",
  ],
};
