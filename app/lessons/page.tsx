import { redirect } from "next/navigation";

// The course list now lives at /courses. Keep /lessons as a redirect so old
// links/bookmarks still work.
export default function LessonsIndexRedirect() {
  redirect("/courses");
}
