import { ImageResponse } from "next/og";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/seo";

export const alt = "Shadowing JP - 日本語シャドーイング";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "linear-gradient(135deg, #f7f5ff 0%, #eef6ff 52%, #fff7ed 100%)",
          color: "#17172f",
          display: "flex",
          fontFamily: "sans-serif",
          height: "100%",
          justifyContent: "center",
          padding: 72,
          width: "100%",
        }}
      >
        <div
          style={{
            background: "rgba(255,255,255,0.88)",
            border: "1px solid rgba(99,96,242,0.18)",
            borderRadius: 44,
            boxShadow: "0 32px 90px rgba(71,63,180,0.18)",
            display: "flex",
            flexDirection: "column",
            gap: 28,
            padding: 62,
            width: "100%",
          }}
        >
          <div style={{ alignItems: "center", display: "flex", gap: 18 }}>
            <div
              style={{
                alignItems: "center",
                background: "#6b5cf6",
                borderRadius: 22,
                color: "white",
                display: "flex",
                fontSize: 34,
                fontWeight: 900,
                height: 72,
                justifyContent: "center",
                width: 72,
              }}
            >
              話
            </div>
            <div style={{ color: "#6b5cf6", fontSize: 34, fontWeight: 900 }}>
              {SITE_NAME}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 78,
              fontWeight: 900,
              letterSpacing: -2,
              lineHeight: 1.02,
            }}
          >
            <span>Cùng luyện nói tiếng Nhật,</span>
            <span>mỗi ngày một chút.</span>
          </div>
          <div style={{ color: "#666b8d", fontSize: 28, fontWeight: 700, lineHeight: 1.45, maxWidth: 860 }}>
            {SITE_DESCRIPTION}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
