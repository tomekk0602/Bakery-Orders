import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@bakery/core", "@bakery/db"],
  serverExternalPackages: ["pg"],
};

export default config;
