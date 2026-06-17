import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  transpilePackages: ["mapbox-gl"],
};

export default withSentryConfig(nextConfig, {
  silent: true,
  telemetry: false,
  disableLogger: true,
  automaticVercelMonitors: false,
});
