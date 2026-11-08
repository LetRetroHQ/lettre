import { SELF } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { AUTH, base, PNG_1x1, readJson } from "./support/http";

async function draft() {
  const response = await SELF.fetch(`${base}/api/posts`, {
    method: "POST",
    headers: { ...AUTH, "content-type": "application/json" },
    body: JSON.stringify({ subject: "Library" }),
  });
  return (await readJson(response)).post.id as string;
}
function upload(path: string, name = "cover.png", type = "image/png", bytes: Uint8Array = PNG_1x1) {
  const body = new FormData();
  body.append("file", new File([bytes], name, { type }));
  return SELF.fetch(`${base}${path}`, { method: "POST", headers: AUTH, body });
}

describe("publication media library", () => {
  it("requires authentication on browse, upload, remove and attach", async () => {
    const post = await draft();
    for (const [method, path] of [
      ["GET", "/api/media"],
      ["POST", "/api/media"],
      ["DELETE", "/api/media/asset"],
      ["POST", `/api/posts/${post}/images/from-library/asset`],
    ] as const) {
      const res = await SELF.fetch(`${base}${path}`, { method });
      expect(res.status, path).toBe(401);
    }
  });
  it("indexes post uploads, reuses their object in another draft, and preserves it when the original draft is deleted", async () => {
    const first = await draft();
    const second = await draft();
    const up = await readJson(await upload(`/api/posts/${first}/images`));
    const library = await readJson(
      await SELF.fetch(`${base}/api/media?search=cover`, { headers: AUTH }),
    );
    const asset = library.assets.find((a: { url: string }) => a.url === up.image.url);
    expect(asset).toBeTruthy();
    const attach = await SELF.fetch(`${base}/api/posts/${second}/images/from-library/${asset.id}`, {
      method: "POST",
      headers: AUTH,
    });
    expect(attach.status).toBe(201);
    expect((await readJson(attach)).image.filename).toBe("cover.png");
    const again = await SELF.fetch(`${base}/api/posts/${second}/images/from-library/${asset.id}`, {
      method: "POST",
      headers: AUTH,
    });
    expect((await readJson(again)).image.filename).toBe("cover.png");
    expect(
      (await SELF.fetch(`${base}/api/posts/${first}`, { method: "DELETE", headers: AUTH })).status,
    ).toBe(200);
    expect((await SELF.fetch(up.image.url)).status).toBe(200);
    const images = await readJson(
      await SELF.fetch(`${base}/api/posts/${second}/images`, { headers: AUTH }),
    );
    expect(images.images[0].url).toBe(up.image.url);
    expect(
      (await SELF.fetch(`${base}/api/media/${asset.id}`, { method: "DELETE", headers: AUTH }))
        .status,
    ).toBe(200);
    expect((await SELF.fetch(up.image.url)).status).toBe(200);
    expect(
      (
        await readJson(await SELF.fetch(`${base}/api/media?search=cover`, { headers: AUTH }))
      ).assets.some((a: { id: string }) => a.id === asset.id),
    ).toBe(false);
  });
  it("gives an old image with spaces a Markdown-safe attachment name", async () => {
    const post = await draft();
    await env.DB.prepare(
      "INSERT INTO images (id, post_id, filename, storage_key, content_type, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
      .bind(
        crypto.randomUUID(),
        post,
        "old photo.png",
        `posts/${post}/old photo.png`,
        "image/png",
        Date.now(),
      )
      .run();
    await env.DB.prepare("UPDATE media_assets SET ready = 1 WHERE storage_key = ?")
      .bind(`posts/${post}/old photo.png`)
      .run();
    const data = await readJson(
      await SELF.fetch(`${base}/api/media?search=old%20photo`, { headers: AUTH }),
    );
    const response = await SELF.fetch(
      `${base}/api/posts/${post}/images/from-library/${data.assets[0].id}`,
      { method: "POST", headers: AUTH },
    );
    expect((await readJson(response)).image.filename).toBe("old-photo.png");
  });
  it("encodes legacy keys for the library, the post API and rendered Markdown", async () => {
    const post = await draft();
    const key = `posts/${post}/old #?% photo.png`;
    await env.MEDIA.put(key, PNG_1x1, { httpMetadata: { contentType: "image/png" } });
    await env.DB.prepare(
      "INSERT INTO images (id, post_id, filename, storage_key, content_type, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
      .bind(crypto.randomUUID(), post, "old #?% photo.png", key, "image/png", Date.now())
      .run();
    await env.DB.prepare("UPDATE media_assets SET ready = 1 WHERE storage_key = ?").bind(key).run();
    const data = await readJson(
      await SELF.fetch(`${base}/api/media?search=old`, { headers: AUTH }),
    );
    const asset = data.assets.find((a: { filename: string }) => a.filename === "old #?% photo.png");
    expect(asset.url).toContain("old%20%23%3F%25%20photo.png");
    expect((await SELF.fetch(asset.url)).status).toBe(200);
    const attached = await readJson(
      await SELF.fetch(`${base}/api/posts/${post}/images`, { headers: AUTH }),
    );
    expect(
      attached.images.find((i: { filename: string }) => i.filename === asset.filename).url,
    ).toBe(asset.url);
    const reuse = await readJson(
      await SELF.fetch(`${base}/api/posts/${post}/images/from-library/${asset.id}`, {
        method: "POST",
        headers: AUTH,
      }),
    );
    const current = await readJson(
      await SELF.fetch(`${base}/api/posts/${post}`, { headers: AUTH }),
    );
    const saved = await SELF.fetch(`${base}/api/posts/${post}`, {
      method: "PUT",
      headers: { ...AUTH, "content-type": "application/json" },
      body: JSON.stringify({
        markdown: `![photo](${reuse.image.filename})`,
        base_revision: current.post.current_revision,
      }),
    });
    expect(saved.status).toBe(200);
    const preview = await SELF.fetch(`${base}/api/posts/${post}/preview`, { headers: AUTH });
    expect(await preview.text()).toContain("old%20%23%3F%25%20photo.png");
  });
  it("attaches an asset only once when requests race", async () => {
    const post = await draft();
    const { asset } = await readJson(await upload("/api/media", "race.png"));
    const attach = () =>
      SELF.fetch(`${base}/api/posts/${post}/images/from-library/${asset.id}`, {
        method: "POST",
        headers: AUTH,
      });
    const responses = await Promise.all(Array.from({ length: 8 }, attach));
    expect(responses.every((response) => response.ok)).toBe(true);
    const names = await Promise.all(
      responses.map(async (response) => (await readJson(response)).image.filename),
    );
    expect(new Set(names)).toEqual(new Set(["race.png"]));
    const rows = await env.DB.prepare("SELECT filename FROM images WHERE post_id = ?")
      .bind(post)
      .all();
    expect(rows.results).toHaveLength(1);
  });
  it("rejects zero dimensions before storing an image and hides incomplete uploads", async () => {
    const zero = PNG_1x1.slice();
    zero.fill(0, 16, 20);
    expect((await upload("/api/media", "zero.png", "image/png", zero)).status).toBe(400);
    const post = await draft();
    expect((await upload(`/api/posts/${post}/images`, "zero.png", "image/png", zero)).status).toBe(
      400,
    );
    const id = crypto.randomUUID();
    await env.DB.prepare(
      "INSERT INTO images (id, post_id, filename, storage_key, content_type, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
      .bind(id, post, "pending.png", `posts/${post}/pending.png`, "image/png", Date.now())
      .run();
    const library = await readJson(
      await SELF.fetch(`${base}/api/media?search=pending`, { headers: AUTH }),
    );
    expect(library.assets).toEqual([]);
    expect(
      (
        await SELF.fetch(`${base}/api/posts/${post}/images/from-library/${id}`, {
          method: "POST",
          headers: AUTH,
        })
      ).status,
    ).toBe(404);
  });
  it("uploads distinct objects for duplicate names and validates image types and sizes", async () => {
    const a = await readJson(await upload("/api/media"));
    const b = await readJson(await upload("/api/media"));
    expect(a.asset.url).not.toBe(b.asset.url);
    expect(a.asset.width).toBe(1);
    expect(a.asset.size).toBe(PNG_1x1.length);
    expect((await upload("/api/media", "x.svg", "image/svg+xml")).status).toBe(400);
    expect(
      (await upload("/api/media", "large.png", "image/png", new Uint8Array(5 * 1024 * 1024 + 1)))
        .status,
    ).toBe(400);
    expect((await SELF.fetch(`${base}/api/media?offset=-1`, { headers: AUTH })).status).toBe(400);
  });
});
