"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

// Avatar dùng chung: có ảnh (avatar_url từ Google) thì hiện ảnh, không có
// (hoặc ảnh lỗi) thì fallback về chữ cái đầu trên nền màu.
// - `className`: kích thước + bo góc, vd "h-8 w-8 rounded-full text-xs".
// - `fallbackClassName`: nền + chữ cho phần chữ cái đầu (mặc định gradient brand).
export function Avatar({
  src,
  name,
  className,
  fallbackClassName = "brand-gradient text-white",
}: {
  src?: string | null;
  name?: string | null;
  className?: string;
  fallbackClassName?: string;
}) {
  const [failed, setFailed] = useState(false);
  const initial = (name || "?").trim().slice(0, 1).toUpperCase() || "?";

  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name || "avatar"}
        onError={() => setFailed(true)}
        // referrerPolicy: ảnh Google (lh3.googleusercontent.com) có thể 403 nếu
        // gửi referrer → tắt đi cho chắc.
        referrerPolicy="no-referrer"
        className={cn("shrink-0 object-cover", className)}
      />
    );
  }

  return (
    <span
      aria-label={name || undefined}
      className={cn(
        "grid shrink-0 place-items-center font-black",
        fallbackClassName,
        className,
      )}
    >
      {initial}
    </span>
  );
}
