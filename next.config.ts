import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Strict Mode double-invokes effects in dev, which replays one-shot
  // animejs entrance animations (e.g. onboarding SplitReveal) twice.
  reactStrictMode: false,
};

export default nextConfig;
