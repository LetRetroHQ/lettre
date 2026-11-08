import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { $, type FakeApi, fakeApi, mount, resetShell, settle, typeInto } from "../test/support";
import { renderUploads } from "./library";

const asset = {
  id: "a1",
  filename: "cover.png",
  url: "https://media.test/cover.png",
  content_type: "image/png",
  width: 100,
  height: 50,
  size: 2048,
  created_at: 1700000000000,
};
describe("uploads library", () => {
  let fake: FakeApi;
  beforeEach(() => resetShell());
  afterEach(() => {
    fake?.restore();
    vi.useRealTimers();
  });
  it("browses, searches and confirms removal without losing the public URL", async () => {
    vi.useFakeTimers();
    fake = fakeApi([
      { path: "/api/media", reply: () => ({ assets: [asset], total: 1, offset: 0, limit: 24 }) },
      { method: "DELETE", path: "/api/media/a1", reply: () => ({ removed: true }) },
    ]);
    await mount(renderUploads);
    await vi.advanceTimersByTimeAsync(0);
    expect($(".media-card strong").textContent).toBe("cover.png");
    typeInto($<HTMLInputElement>("#mediaSearch"), "cover");
    await vi.advanceTimersByTimeAsync(300);
    expect(fake.calls.at(-1)?.url.searchParams.get("search")).toBe("cover");
    $("[data-remove-id]").click();
    expect($(".modal").textContent).toContain("public URL");
    expect(fake.calls.some((c) => c.method === "DELETE")).toBe(false);
    $("#confirmRemove").click();
    await vi.advanceTimersByTimeAsync(0);
    expect(
      fake.calls.some((c) => c.method === "DELETE" && c.url.pathname === "/api/media/a1"),
    ).toBe(true);
    expect(fake.unhandled).toEqual([]);
  });
  it("shows an empty state", async () => {
    fake = fakeApi([
      { path: "/api/media", reply: () => ({ assets: [], total: 0, offset: 0, limit: 24 }) },
    ]);
    await mount(renderUploads);
    await settle();
    expect($("#mediaResults").textContent).toContain("No images yet");
  });
});
