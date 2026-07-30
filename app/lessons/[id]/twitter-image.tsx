import {
  generateLessonShareImage,
  lessonShareImageAlt as alt,
  lessonShareImageContentType as contentType,
  lessonShareImageSize as size,
} from "./lesson-share-image";

export { alt, contentType, size };

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return generateLessonShareImage(id);
}
