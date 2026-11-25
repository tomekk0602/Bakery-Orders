/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  // A cold CI runner spends seconds transforming the Expo modules before a file's first test runs: the
  // banner's first test hit Jest's 5 s default on GitHub (run 45548720101, 9 s for the file) and takes
  // well under a second locally. 15 s keeps a hang failing; the web tests already allow 30 s.
  testTimeout: 15_000,
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" },
  // Workspace packages ship TypeScript source; better-auth and friends ship ESM.
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|react-native-svg|@bakery/.*|better-auth|@better-auth/.*|@better-fetch/.*|nanostores|@nanostores/.*|i18next|react-i18next|zod|standard-navigation))",
  ],
};
