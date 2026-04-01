const KEY = "fleetvu_theme";

export function getThemePref() {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "dark") return "dark";
    return "light";
  } catch {
    return "light";
  }
}

export function setThemePref(theme) {
  try {
    localStorage.setItem(KEY, theme === "light" ? "light" : "dark");
  } catch {}
}

