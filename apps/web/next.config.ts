import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@bakery/core", "@bakery/db"],
  serverExternalPackages: ["pg"],
  // The staff app's web build lives in public/staff (research R28). Its files are served as they are;
  // any other /staff path is a client-side route of that single-page app.
  async rewrites() {
    return [
      { source: "/staff", destination: "/staff/index.html" },
      { source: "/staff/:path*", destination: "/staff/index.html" },
    ];
  },
};

export default config;
