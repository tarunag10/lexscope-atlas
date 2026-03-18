// ── Shared Constants ──
export const STORAGE_KEY = "lexscope_atlas_imports_v1";
export const PROFILES_KEY = "lexscope_profiles_v1";
export const THEME_KEY = "lexscope_theme";
export const API_KEYS_KEY = "lexscope_api_keys_v1";
export const RESULTS_KEY = "lexscope_last_results";
export const PROFILE_KEY = "lexscope_last_profile";
export const TODAY = new Date().toISOString().slice(0, 10);

// ── API Keys ──
export function getApiKeys() {
  return JSON.parse(localStorage.getItem(API_KEYS_KEY) || "{}");
}
export function saveApiKeys(keys) {
  localStorage.setItem(API_KEYS_KEY, JSON.stringify(keys));
}

// ── Persist evaluation results across pages ──
export function storeResults(profile, results) {
  sessionStorage.setItem(RESULTS_KEY, JSON.stringify(results));
  sessionStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}
export function getStoredResults() {
  try {
    return JSON.parse(sessionStorage.getItem(RESULTS_KEY) || "null");
  } catch { return null; }
}
export function getStoredProfile() {
  try {
    return JSON.parse(sessionStorage.getItem(PROFILE_KEY) || "null");
  } catch { return null; }
}

// ── Theme ──
export function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved) document.documentElement.setAttribute("data-theme", saved);
  updateThemeIcon();
}

export function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme");
  const isDark = current === "dark" || (!current && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const next = isDark ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem(THEME_KEY, next);
  updateThemeIcon();
}

export function updateThemeIcon() {
  const el = document.getElementById("themeToggle");
  if (!el) return;
  const theme = document.documentElement.getAttribute("data-theme");
  const isDark = theme === "dark" || (!theme && window.matchMedia("(prefers-color-scheme: dark)").matches);
  el.textContent = isDark ? "\u2600\uFE0F" : "\uD83C\uDF19";
}

export function isDarkMode() {
  const theme = document.documentElement.getAttribute("data-theme");
  return theme === "dark" || (!theme && window.matchMedia("(prefers-color-scheme: dark)").matches);
}

// ── Toast ──
export function showToast(msg) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("visible");
  setTimeout(() => el.classList.remove("visible"), 2500);
}

// ── Supabase ──
let supaClient = null;
export function initSupabase() {
  const keys = getApiKeys();
  if (!keys.supabaseUrl || !keys.supabaseAnon || typeof window.supabase === "undefined") return null;
  try {
    supaClient = window.supabase.createClient(keys.supabaseUrl, keys.supabaseAnon);
    return supaClient;
  } catch { return null; }
}
export function getSupaClient() { return supaClient; }

// ── Nav Bar ──
export function renderNav(activePage) {
  const pages = [
    { id: "evaluate", label: "Evaluate", href: "index.html" },
    { id: "dashboard", label: "Dashboard", href: "dashboard.html" },
    { id: "news", label: "News", href: "news.html" },
    { id: "chat", label: "AI Chat", href: "chat.html" },
    { id: "settings", label: "Settings", href: "settings.html" },
  ];
  const nav = document.createElement("nav");
  nav.className = "site-nav";
  nav.innerHTML = pages.map(p =>
    `<a href="${p.href}" class="nav-link${p.id === activePage ? " active" : ""}">${p.label}</a>`
  ).join("");
  return nav;
}

// ── Shared Page Shell ──
export function initPage(activePage) {
  initTheme();
  const themeBtn = document.getElementById("themeToggle");
  if (themeBtn) themeBtn.addEventListener("click", toggleTheme);

  // Insert nav after hero
  const hero = document.querySelector(".hero");
  if (hero) {
    hero.after(renderNav(activePage));
  }
}
