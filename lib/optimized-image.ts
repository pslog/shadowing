const OPTIMIZED_IMAGE_SOURCES: Record<string, string> = {
  "/author/nhat-ha-anime.png": "/author/nhat-ha-anime-768.webp",
  "/course-covers/minanonihongo1.png": "/course-covers/minanonihongo1-640.webp",
  "/course-covers/minanonihongo2.png": "/course-covers/minanonihongo2-640.webp",
  "/course-covers/jlpt-n2-choukai.png": "/course-covers/jlpt-n2-choukai-640.webp",
  "/logo-mark.png": "/logo-mark-256.webp",
};

export function optimizedImageSrc(src: string | null | undefined): string | null {
  if (!src) return null;
  return OPTIMIZED_IMAGE_SOURCES[src] ?? src;
}
