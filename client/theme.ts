/** The workspace follows the system until a person chooses a theme. */
type Theme = "light" | "dark";
const KEY = "lettre-theme";

function savedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

export function installTheme(): void {
  const button = document.getElementById("themeToggle");
  const media =
    typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-color-scheme: dark)")
      : null;
  let selected = savedTheme();
  const apply = () => {
    const theme = selected ?? (media?.matches ? "dark" : "light");
    document.documentElement.dataset.theme = theme;
    const next = theme === "dark" ? "light" : "dark";
    button?.setAttribute("aria-label", `Switch to ${next} theme`);
    button?.setAttribute("title", `Switch to ${next} theme`);
    const label = button?.querySelector(".theme-toggle-label");
    if (label) {
      label.textContent = `${next === "dark" ? "Dark" : "Light"} mode`;
    }
  };
  apply();
  button?.addEventListener("click", () => {
    selected = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    try {
      localStorage.setItem(KEY, selected);
    } catch {
      // The selected theme still works for this page when storage is unavailable.
    }
    apply();
  });
  media?.addEventListener?.("change", () => {
    if (!selected) {
      apply();
    }
  });
}
