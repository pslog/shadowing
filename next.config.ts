import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    qualities: [70, 72, 75],
    formats: ["image/webp"],
  },
  async headers() {
    return [
      {
        source:
          "/:path*.:ext(avif|webp|png|jpg|jpeg|gif|svg|ico|mp3|m4a|mp4|webmanifest)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
  // Ensure the kuromoji dictionary ships with the /api/score serverless bundle
  // (file tracing doesn't follow the runtime dicPath on its own). Without this
  // the tokenizer fails to load and scoring falls back to kana-folded text
  // comparison — degraded but not broken.
  outputFileTracingIncludes: {
    "/api/score": ["./node_modules/kuromoji/dict/**/*"],
  },
};

export default nextConfig;
