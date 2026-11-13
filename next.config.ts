import type { NextConfig } from "next";

// Built as a plain static website (no server), so it can be hosted free on
// GitHub Pages. PAGES_BASE_PATH is set by the deploy workflow, e.g. "/ai".
const basePath = process.env.PAGES_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  reactStrictMode: true,
};

export default nextConfig;
