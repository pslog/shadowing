import json
import asyncio
import mimetypes
import os
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import quote, unquote, urlsplit
from urllib.request import Request, urlopen

import asyncpg


ROOT = Path(__file__).resolve().parents[1]


def read_env() -> dict[str, str]:
    env: dict[str, str] = {}
    for file_name in [".env.local", ".env"]:
        path = ROOT / file_name
        if not path.exists():
            continue
        for raw in path.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            env[key.strip()] = value.strip().strip("\"'")
    return env


def request_json(method: str, url: str, service_key: str, body=None, headers=None):
    data = None
    final_headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        **(headers or {}),
    }
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        final_headers["Content-Type"] = "application/json"
    req = Request(url, data=data, method=method, headers=final_headers)
    try:
        with urlopen(req, timeout=60) as res:
            text = res.read().decode("utf-8")
            return res.status, json.loads(text) if text else None
    except HTTPError as exc:
        text = exc.read().decode("utf-8")
        try:
            payload = json.loads(text) if text else None
        except json.JSONDecodeError:
            payload = text
        return exc.code, payload


def upload_file(base_url: str, service_key: str, bucket: str, object_name: str, path: Path):
    content_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    url = f"{base_url}/storage/v1/object/{bucket}/{quote(object_name)}"
    req = Request(
        url,
        data=path.read_bytes(),
        method="POST",
        headers={
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": content_type,
            "x-upsert": "true",
        },
    )
    try:
        with urlopen(req, timeout=120) as res:
            res.read()
            return res.status
    except HTTPError as exc:
        body = exc.read().decode("utf-8")
        raise RuntimeError(f"Upload failed for {object_name}: {exc.code} {body}") from exc


async def connect_db(db_url: str):
    parsed = urlsplit(db_url)
    return await asyncpg.connect(
        host=parsed.hostname,
        port=parsed.port or 5432,
        database=parsed.path.lstrip("/") or "postgres",
        user=unquote(parsed.username or ""),
        password=unquote(parsed.password or ""),
        ssl="require",
    )


async def run_sql(db_url: str, sql: str):
    conn = await connect_db(db_url)
    try:
        await conn.execute(sql)
    finally:
        await conn.close()


async def query_one(db_url: str, sql: str):
    conn = await connect_db(db_url)
    try:
        row = await conn.fetchrow(sql)
        return tuple(row)
    finally:
        await conn.close()


async def main():
    env = read_env()
    base_url = env["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
    service_key = env["SUPABASE_SERVICE_ROLE_KEY"]
    db_url = env["SUPABASE_DB_URL"]
    bucket = env.get("NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET", "recordings")

    print("Creating/updating storage bucket...")
    status, payload = request_json(
        "POST",
        f"{base_url}/storage/v1/bucket",
        service_key,
        {
            "id": bucket,
            "name": bucket,
            "public": True,
            "file_size_limit": 52428800,
            "allowed_mime_types": ["audio/mpeg", "audio/mp4", "audio/aac", "audio/x-m4a"],
        },
    )
    if status not in (200, 201) and not (
        status == 400 and isinstance(payload, dict) and "already exists" in str(payload).lower()
    ):
        raise RuntimeError(f"Could not create bucket: {status} {payload}")

    print("Uploading lesson audio...")
    audio_dir = ROOT / "public" / "audio" / "lessons"
    full_audio_files = sorted(audio_dir.glob("lesson-*.m4a"))
    for audio in full_audio_files:
        upload_file(base_url, service_key, bucket, f"lessons/{audio.name}", audio)

    sentence_clip_files = sorted(audio_dir.glob("lesson-*/*.m4a"))
    for clip in sentence_clip_files:
        relative = clip.relative_to(audio_dir).as_posix()
        upload_file(base_url, service_key, bucket, f"lessons/{relative}", clip)

    print("Running schema.sql...")
    await run_sql(db_url, (ROOT / "supabase" / "schema.sql").read_text(encoding="utf-8"))

    print("Running resource seed...")
    await run_sql(db_url, (ROOT / "supabase" / "seed.sql").read_text(encoding="utf-8"))

    public_base = f"{base_url}/storage/v1/object/public/{bucket}/lessons"
    update_lines = []
    for audio in full_audio_files:
        lesson_no = int(audio.stem.split("-")[1])
        lesson_id = f"00000000-0000-0000-0000-0000000b{lesson_no:04d}"
        media_url = f"{public_base}/{audio.name}"
        update_lines.append(
            "update public.lessons "
            f"set media_url = '{media_url}' "
            f"where id = '{lesson_id}';"
        )
    for clip in sentence_clip_files:
        lesson_dir = clip.parent.name
        lesson_no = int(lesson_dir.split("-")[1])
        sentence_no = int(clip.stem.replace("s", ""))
        sentence_id = f"00000000-0000-0000-{lesson_no:04d}-{sentence_no:012d}"
        relative = clip.relative_to(audio_dir).as_posix()
        audio_url = f"{public_base}/{relative}"
        update_lines.append(
            "update public.lesson_sentences "
            f"set audio_url = '{audio_url}' "
            f"where id = '{sentence_id}';"
        )
    await run_sql(db_url, "\n".join(update_lines))

    lesson_count, sentence_count = await query_one(
        db_url,
        """
        select
          (select count(*) from public.lessons where user_id is null and is_public = true),
          (select count(*) from public.lesson_sentences);
        """,
    )

    print(
        json.dumps(
            {
                "bucket": bucket,
                "uploaded_lesson_audio": len(full_audio_files),
                "uploaded_sentence_audio": len(sentence_clip_files),
                "public_lessons": lesson_count,
                "lesson_sentences": sentence_count,
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    asyncio.run(main())
