import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure the kuromoji dictionary ships with the /api/score serverless bundle
  // (file tracing doesn't follow the runtime dicPath on its own). Without this
  // the tokenizer fails to load and scoring falls back to kana-folded text
  // comparison — degraded but not broken.
  outputFileTracingIncludes: {
    "/api/score": ["./node_modules/kuromoji/dict/**/*"],
  },
};

export default nextConfig;
