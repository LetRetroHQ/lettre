import { api, describeError } from "../api";
import { setTitle } from "../lifecycle";
import { copyWith } from "../ui/copy";
import { $, $$ } from "../ui/dom";
import { html, setHtml } from "../ui/html";
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
    html`<div class="media-tools"><label for="mediaSearch">Search images</label><input type="search" id="mediaSearch" placeholder="Search by filename"><button type="button" class="media-upload" id="mediaUpload">Upload image</button><input id="mediaFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden></div>
    <p class="hint">PNG, JPEG, WebP or GIF · up to 5 MB. Images are public and remain available at their URLs, even when removed from this library.</p>
    <div id="mediaResults" aria-live="polite"><p class="muted">Loading images…</p></div><div id="mediaPager" class="media-pager"></div>`,
  );
  const results = $("#mediaResults", root);
  const pager = $("#mediaPager", root);
  const search = $<HTMLInputElement>("#mediaSearch", root);
  const file = $<HTMLInputElement>("#mediaFile", root);
  $("#mediaUpload", root).onclick = () => file.click();
  let offset = 0;
  let request = 0;
  async function load() {
    const current = ++request;
    setHtml(results, html`<p class="muted">Loading images…</p>`);
    try {
      const query = new URLSearchParams({ search: search.value.trim(), offset: String(offset) });
      const page = await api<Page>(`/api/media?${query}`, { signal });
      if (current !== request || signal.aborted) {
        return;
      }
      if (!page.assets.length) {
        setHtml(
          results,
          html`<p class="muted">${search.value ? "No images match your search." : "No images yet. Upload one here or in a draft."}</p>`,
        );
      } else {
        setHtml(
          results,
          html`<div class="media-grid">${page.assets.map(
            (a) => html`<article class="media-card">
          <a class="media-preview" href="${a.url}" target="_blank" rel="noopener noreferrer" aria-label="Open ${a.filename} in a new tab"><img src="${a.url}" alt="" loading="lazy"></a>
          <div class="media-details"><strong title="${a.filename}">${a.filename}</strong><span>${a.content_type.replace("image/", "").toUpperCase()}${a.width && a.height ? ` · ${a.width} × ${a.height}` : ""}${a.size ? ` · ${(a.size / 1024).toFixed(0)} KB` : ""}</span><span>${new Date(a.created_at).toLocaleDateString()}</span>
          <div class="media-actions"><button type="button" data-copy-id="${a.id}">Copy URL</button>${select ? html`<button type="button" class="primary" data-use-id="${a.id}">Insert</button>` : html`<button type="button" data-remove-id="${a.id}">Remove</button>`}</div></div>
        </article>`,
          )}</div>`,
        );
      }
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
        html`<p role="alert">${describeError(error)}</p><button type="button" id="mediaRetry">Try again</button>`,
      );
      $("#mediaRetry", results).onclick = () => void load();
    }
  }
  let timer = 0;
  search.oninput = () => {
    window.clearTimeout(timer);
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
      file.value = "";
    }
  };
  void load();
}

export function renderUploads(root: HTMLElement, signal: AbortSignal): void {
  setTitle(signal, "Uploads");
  setHtml(
    root,
    html`<div class="page-head"><h1>Uploads</h1><p class="muted">Your publication’s image library</p></div><div id="library"></div>`,
  );
  mountLibrary($("#library", root), signal);
}
