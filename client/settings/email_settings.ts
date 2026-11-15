import { api, describeError } from "../api";
import { setTitle } from "../lifecycle";
import { $ } from "../ui/dom";
import { html, setHtml } from "../ui/html";
import { icon } from "../ui/icons";
import { providerLabel } from "./deploy";

interface EmailSettings {
  active_provider: string;
  resend: { api_key_set: boolean; webhook_secret_set: boolean };
}

export async function renderEmailSettings(root: HTMLElement, signal: AbortSignal): Promise<void> {
  setTitle(signal, "Email settings");
  setHtml(
    root,
    html`<div class="settings email-setup"><div class="page-head"><span class="email-setup-eyebrow">DELIVERY SETTINGS</span><h1>Email settings</h1><p class="set-lede">Manage the service that sends your newsletter and its delivery events.</p></div><div id="email-settings-content" aria-live="polite">Loading…</div></div>`,
  );
  const content = $("#email-settings-content", root);
  let settings: EmailSettings;
  try {
    settings = await api<EmailSettings>("/api/settings/email", { signal });
  } catch (error) {
    content.textContent = describeError(error);
    return;
  }
  if (signal.aborted) {
    return;
  }
  setHtml(
    content,
    html`<section class="email-active" aria-label="Email provider"><span class="email-icon">${icon("send")}</span><div><span class="email-overline">CURRENT SENDER</span><h2>${providerLabel(settings.active_provider)}</h2><p>${settings.active_provider === "none" ? "Connect a provider before sending." : "Your existing sender remains selected."}</p></div><span class="email-badge">${settings.active_provider === "none" ? "Not connected" : "Selected"}</span></section>
    <section class="email-provider"><div class="email-provider-head"><span class="email-icon">${icon("mail")}</span><div><span class="email-overline">EMAIL INTEGRATION</span><h2>Resend</h2><p>Prepare your credentials for a future connection.</p></div><span class="email-badge email-badge-muted">Not available yet</span></div>
    <div class="email-notice">${icon("info")}<p><strong>Resend sending is still being built.</strong> Saving these credentials won’t switch your provider or send emails.</p></div>
    <form id="resend-credentials" class="email-form"><div class="email-form-heading"><div><h3>Credentials</h3><p>Enter one or both values. Leave a field blank to keep its current value.</p></div><span class="email-security">${icon("readonly")} Encrypted at rest</span></div>
    <div class="email-fields"><div class="set-field"><div class="email-label"><label for="resend-api-key">API key</label><span id="api-key-status" class="email-field-status">${settings.resend.api_key_set ? "Saved" : "Not configured"}</span></div><input id="resend-api-key" name="api_key" type="password" autocomplete="off" placeholder="re_…" aria-describedby="api-key-help"><p id="api-key-help">Create a sending key in your Resend dashboard.</p></div>
    <div class="set-field"><div class="email-label"><label for="resend-webhook-secret">Webhook signing secret</label><span id="webhook-status" class="email-field-status">${settings.resend.webhook_secret_set ? "Saved" : "Not configured"}</span></div><input id="resend-webhook-secret" name="webhook_secret" type="password" autocomplete="off" placeholder="whsec_…" aria-describedby="webhook-help"><p id="webhook-help">Find this on your Resend webhook’s details page.</p></div></div>
    <div class="email-form-footer"><button type="submit" class="primary">${icon("readonly")} Save credentials</button><p id="email-settings-result" role="status" aria-live="polite"></p></div></form></section>`,
  );
  const form = $<HTMLFormElement>("#resend-credentials", content);
  form.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();
      const apiKey = $<HTMLInputElement>("#resend-api-key", form).value.trim();
      const webhookSecret = $<HTMLInputElement>("#resend-webhook-secret", form).value.trim();
      const result = $("#email-settings-result", form);
      const button = $<HTMLButtonElement>('button[type="submit"]', form);
      if (!apiKey && !webhookSecret) {
        result.textContent = "Enter a credential to save.";
        return;
      }
      try {
        button.disabled = true;
        result.textContent = "Saving…";
        const saved = await api<EmailSettings>("/api/settings/email", {
          method: "PUT",
          json: {
            ...(apiKey ? { api_key: apiKey } : {}),
            ...(webhookSecret ? { webhook_secret: webhookSecret } : {}),
          },
        });
        form.reset();
        $("#api-key-status", form).textContent = saved.resend.api_key_set
          ? "Saved"
          : "Not configured";
        $("#webhook-status", form).textContent = saved.resend.webhook_secret_set
          ? "Saved"
          : "Not configured";
        result.textContent = "Credentials saved.";
      } catch (error) {
        result.textContent = describeError(error);
      } finally {
        button.disabled = false;
      }
    },
    { signal },
  );
}
