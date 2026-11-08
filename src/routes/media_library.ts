/** Publication-wide index of public, durable image objects. */

import * as images from "../db/images";
import { readForm } from "../lib/body";
import { badRequest, json, notFound } from "../lib/errors";
import { newId } from "../lib/ids";
import { probeImageDimensions } from "../lib/image_dims";
import { mediaType, RASTER_IMAGE_TYPES } from "../lib/image_types";
import { param, type RequestContext } from "../router";
import { cleanName, MAX_POST_IMAGE_BYTES } from "./images";
import { requireDraft } from "./posts";

interface Asset {
  id: string;
  filename: string;
  storage_key: string;
  content_type: string;
  width: number | null;
  height: number | null;
  size: number | null;
  created_at: number;
}

function publicAsset(c: RequestContext, asset: Asset) {
  const { storage_key, ...metadata } = asset;
  return { ...metadata, url: `${c.config.mediaPublicBase}/${storage_key}` };
}

export async function listMedia(c: RequestContext): Promise<Response> {
  const raw = c.url.searchParams.get("offset") ?? "0";
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw))) {
    throw badRequest("offset must be a non-negative whole number", { field: "offset" });
  }
  const offset = Number(raw);
  const search = (c.url.searchParams.get("search") ?? "").trim().slice(0, 200);
  const pattern = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
  const where = "hidden = 0 AND filename LIKE ? ESCAPE '\\'";
  const count = await c.env.DB.prepare(`SELECT COUNT(*) AS total FROM media_assets WHERE ${where}`)
    .bind(pattern)
    .first<{ total: number }>();
  const rows = await c.env.DB.prepare(
    `SELECT * FROM media_assets WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT 24 OFFSET ?`,
  )
    .bind(pattern, offset)
    .all<Asset>();
  return json({
    assets: rows.results.map((row) => publicAsset(c, row)),
    total: count?.total ?? 0,
    offset,
    limit: 24,
  });
}

export async function uploadMedia(c: RequestContext): Promise<Response> {
  const form = await readForm(c.req);
  const file = form.get("file");
  if (!(file instanceof File)) {
    throw badRequest("Choose an image to upload.", { field: "file" });
  }
  const type = mediaType(file.type);
  if (!RASTER_IMAGE_TYPES.includes(type)) {
    throw badRequest("An image must be a PNG, JPEG, WebP, or GIF.", { field: "file" });
  }
  if (!file.size || file.size > MAX_POST_IMAGE_BYTES) {
    throw badRequest("An image must be non-empty and 5 MB or smaller.", { field: "file" });
  }
  const filename = cleanName(file.name);
  if (!filename) {
    throw badRequest("A filename is required.", { field: "file" });
  }
  const bytes = await file.arrayBuffer();
  const dims = probeImageDimensions(new Uint8Array(bytes));
  const id = newId();
  const key = `library/${id}/${filename}`;
  await c.env.MEDIA.put(key, bytes, { httpMetadata: { contentType: type } });
  try {
    await c.env.DB.prepare(
      "INSERT INTO media_assets (id, filename, storage_key, content_type, width, height, size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
      .bind(
        id,
        filename,
        key,
        type,
        dims?.width ?? null,
        dims?.height ?? null,
        bytes.byteLength,
        Date.now(),
      )
      .run();
  } catch (err) {
    await c.env.MEDIA.delete(key);
    throw err;
  }
  const row = await c.env.DB.prepare("SELECT * FROM media_assets WHERE id = ?")
    .bind(id)
    .first<Asset>();
  if (!row) {
    throw notFound("image");
  }
  return json({ asset: publicAsset(c, row) }, 201);
}

export async function hideMedia(c: RequestContext): Promise<Response> {
  const result = await c.env.DB.prepare(
    "UPDATE media_assets SET hidden = 1 WHERE id = ? AND hidden = 0",
  )
    .bind(param(c, "assetId"))
    .run();
  if (!result.meta.changes) {
    throw notFound("image");
  }
  return json({ removed: true });
}

export async function useMedia(c: RequestContext): Promise<Response> {
  const post = await requireDraft(c);
  const asset = await c.env.DB.prepare("SELECT * FROM media_assets WHERE id = ? AND hidden = 0")
    .bind(param(c, "assetId"))
    .first<Asset>();
  if (!asset) {
    throw notFound("image");
  }
  // If already attached, use its existing Markdown name.
  const existing = await c.env.DB.prepare(
    "SELECT * FROM images WHERE post_id = ? AND storage_key = ?",
  )
    .bind(post.id, asset.storage_key)
    .first<images.ImageRow>();
  if (existing && cleanName(existing.filename) === existing.filename) {
    return json({ image: { filename: existing.filename } });
  }
  const name = cleanName(asset.filename) || "image";
  for (let n = 1; ; n++) {
    const dot = name.lastIndexOf(".");
    const filename =
      n === 1 ? name : dot > 0 ? `${name.slice(0, dot)}-${n}${name.slice(dot)}` : `${name}-${n}`;
    const row = await images.insertImageIfNameFree(c.env.DB, {
      postId: post.id,
      filename,
      storageKey: asset.storage_key,
      contentType: asset.content_type,
      width: asset.width,
      height: asset.height,
    });
    if (row) {
      return json({ image: { filename: row.filename } }, 201);
    }
  }
}
