import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { lessonSeoBySlug } from "@/lib/seo-content";
import { SITE_NAME } from "@/lib/seo";

export const lessonShareImageAlt = `${SITE_NAME} lesson preview`;
export const lessonShareImageSize = {
  width: 1200,
  height: 630,
};
export const lessonShareImageContentType = "image/png";

function clip(value: string | null | undefined, max: number): string {
  const text = (value ?? "").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

export async function generateLessonShareImage(id: string) {
  const lesson = await lessonSeoBySlug(id);
  const logo = await readFile(path.join(process.cwd(), "public/logo-mark.png"));
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;
  const title = lesson?.title ?? "Shadowing lesson";
  const ja = lesson?.firstSentence?.ja_text ?? "";
  const vi = lesson?.firstSentence?.vi_translation ?? "";
  const topic = lesson?.topic ?? "Shadowing";
  const level = lesson?.level ?? "Japanese";

  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "stretch",
          background:
            "linear-gradient(135deg, #f7f5ff 0%, #eef6ff 48%, #fff7ed 100%)",
          color: "#17172f",
          display: "flex",
          flexDirection: "column",
          fontFamily: "sans-serif",
          height: "100%",
          justifyContent: "center",
          padding: 62,
          width: "100%",
        }}
      >
        <div
          style={{
            background: "rgba(255,255,255,0.9)",
            border: "1px solid rgba(99,96,242,0.2)",
            borderRadius: 44,
            boxShadow: "0 32px 90px rgba(71,63,180,0.18)",
            display: "flex",
            flexDirection: "column",
            height: "100%",
            justifyContent: "space-between",
            overflow: "hidden",
            padding: 54,
            position: "relative",
            width: "100%",
          }}
        >
          <div
            style={{
              background: "#6c5cf6",
              borderRadius: 999,
              display: "flex",
              height: 280,
              opacity: 0.08,
              position: "absolute",
              right: -90,
              top: -110,
              width: 280,
            }}
          />
          <div style={{ alignItems: "center", display: "flex", gap: 18 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoSrc} width={72} height={72} style={{ borderRadius: 18 }} alt="" />
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <div style={{ color: "#6b5cf6", fontSize: 32, fontWeight: 900 }}>
                {SITE_NAME}
              </div>
              <div style={{ color: "#667085", fontSize: 22, fontWeight: 700 }}>
                Japanese shadowing practice
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ display: "flex", gap: 12 }}>
              {[topic, level].filter(Boolean).map((item) => (
                <div
                  key={item}
                  style={{
                    background: "rgba(99,96,242,0.1)",
                    borderRadius: 999,
                    color: "#5b52e8",
                    display: "flex",
                    fontSize: 24,
                    fontWeight: 900,
                    padding: "9px 18px",
                  }}
                >
                  {item}
                </div>
              ))}
            </div>
            <div
              style={{
                color: "#15152d",
                display: "flex",
                flexDirection: "column",
                fontSize: 62,
                fontWeight: 900,
                letterSpacing: -1,
                lineHeight: 1.12,
                maxWidth: 900,
              }}
            >
              {clip(title, 58)}
            </div>
            {(ja || vi) && (
              <div
                style={{
                  borderLeft: "8px solid #6b5cf6",
                  color: "#475467",
                  display: "flex",
                  flexDirection: "column",
                  fontSize: 28,
                  fontWeight: 700,
                  gap: 10,
                  lineHeight: 1.38,
                  maxWidth: 940,
                  paddingLeft: 22,
                }}
              >
                {ja && <div>{clip(ja, 70)}</div>}
                {vi && <div style={{ color: "#667085", fontSize: 24 }}>{clip(vi, 82)}</div>}
              </div>
            )}
          </div>

          <div
            style={{
              alignItems: "center",
              color: "#667085",
              display: "flex",
              fontSize: 24,
              fontWeight: 800,
              justifyContent: "space-between",
            }}
          >
            <span>Listen · Speak · Repeat</span>
            <span>shadowing-jp</span>
          </div>
        </div>
      </div>
    ),
    lessonShareImageSize,
  );
}
