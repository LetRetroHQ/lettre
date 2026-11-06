import { afterEach, describe, expect, it, vi } from "vitest";
import { installTheme } from "./theme";

afterEach(() => {
  localStorage.removeItem("lettre-theme");
  document.documentElement.removeAttribute("data-theme");
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

describe("workspace theme", () => {
  it("starts with the system theme and saves the chosen alternative", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn() }));
    document.body.innerHTML =
      '<button id="themeToggle"><span class="theme-toggle-label"></span></button>';
    installTheme();
    const button = document.getElementById("themeToggle") as HTMLButtonElement;
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(button.getAttribute("aria-label")).toBe("Switch to light theme");
    button.click();
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem("lettre-theme")).toBe("light");
    expect(button.getAttribute("aria-label")).toBe("Switch to dark theme");
  });

  it("restores a saved choice over the system preference", () => {
    localStorage.setItem("lettre-theme", "dark");
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn() }));
    installTheme();
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});
