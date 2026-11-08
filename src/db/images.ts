/** Image metadata queries. The bytes live in R2; this is the index over them. */
import { newId } from "../lib/ids";
import { unwrap } from "../lib/unwrap";

export interface ImageRow {
  id: string;
  post_id: string;
  filename: string;
  storage_key: string;
  content_type: string;
  width: number | null;
  height: number | null;
  created_at: number;
}

export interface ImageInput {
  postId: string;
  filename: string;
  storageKey: string;
  contentType: string;
  width: number | null;
  height: number | null;
}

export async function listImages(db: D1Database, postId: string): Promise<ImageRow[]> {
  const { results } = await db
    .prepare("SELECT * FROM images WHERE post_id = ? ORDER BY filename ASC")
    .bind(postId)
    .all<ImageRow>();
  return results;
}

export function getImage(
  db: D1Database,
  postId: string,
  filename: string,
): Promise<ImageRow | null> {
  return db
    .prepare("SELECT * FROM images WHERE post_id = ? AND filename = ?")
    .bind(postId, filename)
    .first<ImageRow>();
}

/**
 * Insert an image under its name, or answer null when this post already has that name. The
 * table's uniqueness decides, so of two uploads at once only one can take a name.
 */
export async function insertImageIfNameFree(
  db: D1Database,
  input: ImageInput,
): Promise<ImageRow | null> {
  const { meta } = await db
    .prepare(
      "INSERT INTO images (id, post_id, filename, storage_key, content_type, width, height, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (post_id, filename) DO NOTHING",
    )
    .bind(
      newId(),
      input.postId,
      input.filename,
      input.storageKey,
      input.contentType,
      input.width,
      input.height,
      Date.now(),
    )
    .run();
  if (meta.changes === 0) {
    return null;
  }
  return unwrap(await getImage(db, input.postId, input.filename), "image");
}

export async function deleteImageRow(
  db: D1Database,
  postId: string,
  filename: string,
): Promise<void> {
  await db
    .prepare("DELETE FROM images WHERE post_id = ? AND filename = ?")
    .bind(postId, filename)
    .run();
}

/** All attachments to one object, including legacy names that cannot be used in Markdown. */
export async function listImagesByStorageKey(
  db: D1Database,
  postId: string,
  key: string,
): Promise<ImageRow[]> {
  const { results } = await db
    .prepare("SELECT * FROM images WHERE post_id = ? AND storage_key = ? ORDER BY created_at, id")
    .bind(postId, key)
    .all<ImageRow>();
  return results;
}

/** Atomically attach an object unless another request already attached a usable alias. */
export async function attachImageIfAbsent(
  db: D1Database,
  input: ImageInput,
  ignoredIds: string[],
): Promise<ImageRow | null> {
  return db
    .prepare(`INSERT INTO images (id, post_id, filename, storage_key, content_type, width, height, created_at)
    SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (
      SELECT 1 FROM images WHERE post_id = ? AND storage_key = ? AND id NOT IN (SELECT value FROM json_each(?))
    ) ON CONFLICT (post_id, filename) DO NOTHING RETURNING *`)
    .bind(
      newId(),
      input.postId,
      input.filename,
      input.storageKey,
      input.contentType,
      input.width,
      input.height,
      Date.now(),
      input.postId,
      input.storageKey,
      JSON.stringify(ignoredIds),
    )
    .first<ImageRow>();
}
