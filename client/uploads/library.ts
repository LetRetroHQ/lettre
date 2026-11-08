import { api, describeError } from "../api";
import { setTitle } from "../lifecycle";
import { copyWith } from "../ui/copy";
import { $, $$ } from "../ui/dom";
import { html, setHtml } from "../ui/html";
import { icon } from "../ui/icons";
import { modal, toast } from "../ui/widgets";

interface Asset {
  id: string;
  filename: string;
  url: string;
  content_type: string;
  width: number | null;
  height: number | null;
  size: number | null;
  created_at: number;
}
interface Page {
  assets: Asset[];
  total: number;
  offset: number;
  limit: number;
}

/** Shared library browser, with an optional action for inserting an image into a draft. */
export function mountLibrary(
  root: HTMLElement,
  signal: AbortSignal,
  select?: (asset: Asset) => Promise<void>,
): void {
  setHtml(
    root,
    html`<div class="media-library">
      <div class="media-tools">
        <div class="media-search">${icon("search")}<label class="visually-hidden" for="mediaSearch">Search images by filename</label><input type="search" id="mediaSearch" placeholder="Search images…" autocomplete="off"></div>
        <button type="button" class="primary media-upload" id="mediaUpload">${icon("upload")}<span>Upload image</span></button>
        <input id="mediaFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden>
      </div>
      <p class="media-upload-hint">PNG, JPEG, WebP or GIF · Up to 5 MB per image</p>
      <div id="mediaResults" aria-live="polite"><div class="media-state"><p>Loading images…</p></div></div>
      <div id="mediaPager" class="media-pager"></div>
    </div>`,
  );
  const results = $("#mediaResults", root);
  const pager = $("#mediaPager", root);
  const search = $<HTMLInputElement>("#mediaSearch", root);
  const file = $<HTMLInputElement>("#mediaFile", root);
  const upload = $<HTMLButtonElement>("#mediaUpload", root);
  upload.onclick = () => file.click();
  let offset = 0;
  let request = 0;
  let view: "grid" | "list" = "grid";
  async function load() {
    const current = ++request;
    setHtml(results, html`<div class="media-state"><p>Loading images…</p></div>`);
    setHtml(pager, html``);
    try {
      const query = new URLSearchParams({ search: search.value.trim(), offset: String(offset) });
      const page = await api<Page>(`/api/media?${query}`, { signal });
      if (current !== request || signal.aborted) {
        return;
      }
      if (!page.assets.length) {
        setHtml(
          results,
          search.value
            ? html`<div class="media-state"><div class="media-state-icon">${icon("search")}</div><h2>No images found</h2><p>Try a different filename or clear your search.</p><button type="button" id="mediaClearSearch">Clear search</button></div>`
            : html`<div class="media-state"><div class="media-state-icon">${icon("upload")}</div><h2>No images yet</h2><p>Upload an image here or add one while writing a draft.</p><button type="button" id="mediaEmptyUpload">Upload your first image</button></div>`,
        );
        const clear = results.querySelector<HTMLButtonElement>("#mediaClearSearch");
        if (clear) {
          clear.onclick = () => {
            search.value = "";
            offset = 0;
            void load();
            search.focus();
          };
        }
        const emptyUpload = results.querySelector<HTMLButtonElement>("#mediaEmptyUpload");
        if (emptyUpload) {
          emptyUpload.onclick = () => file.click();
        }
      } else {
        setHtml(
          results,
          html`<div class="media-section-head"><div class="media-section-title"><h2>Images</h2><span>${page.total} ${page.total === 1 ? "image" : "images"}</span></div><div class="media-view-switch" role="group" aria-label="Choose image view"><button type="button" id="mediaGridView" aria-pressed="${view === "grid" ? "true" : "false"}">Grid</button><button type="button" id="mediaListView" aria-pressed="${view === "list" ? "true" : "false"}">List</button></div></div><div class="media-browser"><div class="media-grid${view === "list" ? " is-list" : ""}">${page.assets.map(
            (a) => html`<article class="media-card">
          <button type="button" class="media-preview" data-preview-id="${a.id}" aria-label="View details for ${a.filename}" aria-pressed="false"><img src="${a.url}" alt="" loading="lazy"></button>
          <div class="media-details"><strong title="${a.filename}">${a.filename}</strong><span class="media-meta">${a.content_type.replace("image/", "").toUpperCase()}${a.width && a.height ? ` · ${a.width} × ${a.height}` : ""}${a.size ? ` · ${a.size < 1024 * 1024 ? `${Math.max(1, Math.round(a.size / 1024))} KB` : `${(a.size / 1024 / 1024).toFixed(1)} MB`}` : ""}</span><span class="media-date">${new Date(a.created_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</span></div>
          <div class="media-actions"><button type="button" data-copy-id="${a.id}" data-copy-word="Copy URL" aria-label="Copy URL for ${a.filename}">${icon("copyout")}<span>Copy URL</span></button>${select ? html`<button type="button" class="media-insert" data-use-id="${a.id}" aria-label="Insert ${a.filename}">Insert</button>` : html`<button type="button" data-remove-id="${a.id}" aria-label="Remove ${a.filename} from library">Remove</button>`}</div>
        </article>`,
          )}</div><aside class="media-inspector" aria-label="Image details" hidden></aside></div>`,
        );
        const grid = $(".media-grid", results);
        const gridButton = $<HTMLButtonElement>("#mediaGridView", results);
        const listButton = $<HTMLButtonElement>("#mediaListView", results);
        const setView = (next: "grid" | "list") => {
          view = next;
          grid.classList.toggle("is-list", next === "list");
          gridButton.setAttribute("aria-pressed", String(next === "grid"));
          listButton.setAttribute("aria-pressed", String(next === "list"));
        };
        gridButton.onclick = () => setView("grid");
        listButton.onclick = () => setView("list");
        const inspector = $<HTMLElement>(".media-inspector", results);
        for (const button of $$<HTMLButtonElement>("[data-preview-id]", results)) {
          button.onclick = () => {
            const asset = page.assets.find((item) => item.id === button.dataset.previewId);
            if (!asset) {
              return;
            }
            for (const other of $$<HTMLButtonElement>("[data-preview-id]", results)) {
              other.setAttribute("aria-pressed", String(other === button));
            }
            inspector.hidden = false;
            setHtml(
              inspector,
              html`<div class="media-inspector-head"><h3>Image details</h3><button type="button" class="media-inspector-close" aria-label="Close image details">${icon("x")}</button></div>
              <div class="media-inspector-preview"><img src="${asset.url}" alt=""></div>
              <h4 title="${asset.filename}">${asset.filename}</h4>
              <dl><div><dt>Format</dt><dd>${asset.content_type.replace("image/", "").toUpperCase()}</dd></div><div><dt>Dimensions</dt><dd>${asset.width && asset.height ? `${asset.width} × ${asset.height}` : "Unavailable"}</dd></div><div><dt>Uploaded</dt><dd>${new Date(asset.created_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</dd></div></dl>
              <div class="media-inspector-url"><span>Public URL</span><code>${asset.url}</code></div>
              <div class="media-inspector-actions"><button type="button" id="mediaInspectorCopy" data-copy-word="Copy URL" aria-label="Copy URL for ${asset.filename}">${icon("copyout")}<span>Copy URL</span></button><a href="${asset.url}" target="_blank" rel="noopener noreferrer">Open original ↗</a></div>`,
            );
            $(".media-inspector-close", inspector).onclick = () => {
              inspector.hidden = true;
              button.setAttribute("aria-pressed", "false");
              button.focus();
            };
            const copy = $("#mediaInspectorCopy", inspector);
            copy.onclick = () => void copyWith(copy, asset.url);
            $(".media-inspector-close", inspector).focus({ preventScroll: true });
            if (window.matchMedia("(max-width: 720px)").matches) {
              inspector.scrollIntoView({ block: "nearest" });
            }
          };
        }
      }
      if (page.total > page.limit) {
        setHtml(
          pager,
          html`<button type="button" id="mediaPrev"${offset === 0 ? html` disabled` : null}>Previous</button><span>${page.total ? `${offset + 1}–${Math.min(offset + page.limit, page.total)} of ${page.total}` : "0 images"}</span><button type="button" id="mediaNext"${offset + page.limit >= page.total ? html` disabled` : null}>Next</button>`,
        );
        $("#mediaPrev", pager).onclick = () => {
          offset = Math.max(0, offset - page.limit);
          void load();
        };
        $("#mediaNext", pager).onclick = () => {
          offset += page.limit;
          void load();
        };
      }
      for (const button of $$<HTMLButtonElement>("[data-copy-id]", results)) {
        button.onclick = () => {
          const a = page.assets.find((item) => item.id === button.dataset.copyId);
          if (a) {
            void copyWith(button, a.url);
          }
        };
      }
      for (const button of $$<HTMLButtonElement>("[data-use-id]", results)) {
        button.onclick = async () => {
          const a = page.assets.find((item) => item.id === button.dataset.useId);
          if (!a || !select) {
            return;
          }
          button.disabled = true;
          try {
            await select(a);
          } catch (error) {
            toast(describeError(error));
            button.disabled = false;
          }
        };
      }
      for (const button of $$<HTMLButtonElement>("[data-remove-id]", results)) {
        button.onclick = () => {
          const a = page.assets.find((item) => item.id === button.dataset.removeId);
          if (!a) {
            return;
          }
          const dialog = modal(
            html`<h3 id="removeMediaTitle">Remove ${a.filename} from the library?</h3><p>The image will be hidden here. Its public URL and any images in posts, archives and sent emails will continue to work.</p><div class="actions"><button type="button" id="cancelRemove">Cancel</button><button type="button" class="danger" id="confirmRemove">Remove</button></div>`,
            signal,
          );
          $(".modal", dialog.el).setAttribute("aria-labelledby", "removeMediaTitle");
          $("#cancelRemove", dialog.el).onclick = dialog.close;
          const confirm = $<HTMLButtonElement>("#confirmRemove", dialog.el);
          confirm.onclick = async () => {
            confirm.disabled = true;
            try {
              await api(`/api/media/${encodeURIComponent(a.id)}`, { method: "DELETE" });
              dialog.close();
              if (page.assets.length === 1 && offset > 0) {
                offset = Math.max(0, offset - page.limit);
              }
              await load();
            } catch (error) {
              confirm.disabled = false;
              dialog.error(describeError(error));
            }
          };
        };
      }
    } catch (error) {
      if (signal.aborted || current !== request) {
        return;
      }
      setHtml(
        results,
        html`<div class="media-state"><h2>Couldn’t load images</h2><p role="alert">${describeError(error)}</p><button type="button" id="mediaRetry">Try again</button></div>`,
      );
      $("#mediaRetry", results).onclick = () => void load();
    }
  }
  let timer = 0;
  search.oninput = () => {
    window.clearTimeout(timer);
    request++;
    timer = window.setTimeout(() => {
      offset = 0;
      void load();
    }, 250);
  };
  signal.addEventListener("abort", () => window.clearTimeout(timer), { once: true });
  file.onchange = async () => {
    const chosen = file.files?.[0];
    if (!chosen) {
      return;
    }
    file.disabled = true;
    upload.disabled = true;
    setHtml(upload, html`${icon("upload")}<span>Uploading…</span>`);
    try {
      const body = new FormData();
      body.append("file", chosen);
      await api("/api/media", { method: "POST", body });
      offset = 0;
      search.value = "";
      await load();
      toast("Image uploaded");
    } catch (error) {
      toast(describeError(error));
    } finally {
      file.disabled = false;
      upload.disabled = false;
      setHtml(upload, html`${icon("upload")}<span>Upload image</span>`);
      file.value = "";
    }
  };
  void load();
}

export function renderUploads(root: HTMLElement, signal: AbortSignal): void {
  setTitle(signal, "Uploads");
  setHtml(
    root,
    html`<div class="page-head media-page-head"><div><p class="media-eyebrow">YOUR LIBRARY</p><h1>Uploads</h1><p class="muted">All the images you’ve uploaded, ready to use in your posts.</p></div></div><div id="library"></div>`,
  );
  mountLibrary($("#library", root), signal);
}
