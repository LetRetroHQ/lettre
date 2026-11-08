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
  it("switches between grid and list and shows image details without another request", async () => {
    fake = fakeApi([
      { path: "/api/media", reply: () => ({ assets: [asset], total: 1, offset: 0, limit: 24 }) },
    ]);
    await mount(renderUploads);
    await settle();
    $("#mediaListView").click();
    expect($(".media-grid").classList.contains("is-list")).toBe(true);
    expect($("#mediaListView").getAttribute("aria-pressed")).toBe("true");
    $("[data-preview-id]").click();
    expect($(".media-inspector").hasAttribute("hidden")).toBe(false);
    expect($(".media-inspector").textContent).toContain("100 × 50");
    expect($(".media-inspector").textContent).toContain(asset.url);
    $(".media-inspector-close").click();
    expect($(".media-inspector").hasAttribute("hidden")).toBe(true);
    expect(fake.calls).toHaveLength(1);
  });
  it("lets the publisher clear a search with no results", async () => {
    vi.useFakeTimers();
    fake = fakeApi([
      { path: "/api/media", reply: () => ({ assets: [], total: 0, offset: 0, limit: 24 }) },
    ]);
    await mount(renderUploads);
    await vi.advanceTimersByTimeAsync(0);
    typeInto($<HTMLInputElement>("#mediaSearch"), "missing");
    await vi.advanceTimersByTimeAsync(300);
    expect($("#mediaResults").textContent).toContain("No images found");
    $("#mediaClearSearch").click();
    await vi.advanceTimersByTimeAsync(0);
    expect($<HTMLInputElement>("#mediaSearch").value).toBe("");
    expect($("#mediaResults").textContent).toContain("No images yet");
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
