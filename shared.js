import { canonicalize } from "./engine.js";

// ── Shared Constants ──
export const STORAGE_KEY = "lexscope_atlas_imports_v1";
export const PROFILES_KEY = "lexscope_profiles_v1";
export const THEME_KEY = "lexscope_theme";
export const API_KEYS_KEY = "lexscope_api_keys_v1";
export const RESULTS_KEY = "lexscope_last_results";
export const PROFILE_KEY = "lexscope_last_profile";
export const TODAY = new Date().toISOString().slice(0, 10);

// ── HTML Escaping ──
export function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function safeUrl(value) {
  if (value === null || value === undefined) return "";
  const raw = String(value).trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw, "http://lexscope.local");
    if (parsed.origin === "http://lexscope.local") return raw;
    return ["http:", "https:"].includes(parsed.protocol) ? raw : "";
  } catch {
    return "";
  }
}

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
    { id: "evaluate", label: "Home", href: "index.html" },
    { id: "dashboard", label: "History", href: "dashboard.html" },
    { id: "compare", label: "Compare", href: "compare.html" },
    { id: "checklist", label: "Resources", href: "checklist.html" },
    { id: "news", label: "News", href: "news.html" },
    { id: "chat", label: "AI Chat", href: "chat.html" },
    { id: "settings", label: "Settings", href: "settings.html" },
  ];
  const nav = document.createElement("nav");
  nav.className = "site-nav";
  nav.setAttribute("aria-label", "Primary");
  const navLinks = pages.map((p) =>
    `<a href="${p.href}" class="nav-link${p.id === activePage ? " active" : ""}">${p.label}</a>`
  ).join("");
  nav.innerHTML = `
    <button
      type="button"
      class="nav-toggle"
      aria-label="Open navigation menu"
      aria-expanded="false"
      aria-controls="siteNavLinks"
    >
      <span class="nav-toggle-bar"></span>
      <span class="nav-toggle-bar"></span>
      <span class="nav-toggle-bar"></span>
    </button>
    <div id="siteNavLinks" class="site-nav-links">
      ${navLinks}
    </div>
  `;
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
    const nav = renderNav(activePage);
    hero.after(nav);

    const navToggle = nav.querySelector(".nav-toggle");
    const navLinks = nav.querySelector(".site-nav-links");
    const closeMenu = () => {
      nav.classList.remove("is-open");
      if (navToggle) navToggle.setAttribute("aria-expanded", "false");
    };
    if (navToggle && navLinks) {
      navToggle.addEventListener("click", () => {
        const isOpen = nav.classList.toggle("is-open");
        navToggle.setAttribute("aria-expanded", String(isOpen));
      });
      navLinks.querySelectorAll("a").forEach((link) => {
        link.addEventListener("click", closeMenu);
      });
      document.addEventListener("click", (event) => {
        if (!nav.classList.contains("is-open")) return;
        if (!nav.contains(event.target)) closeMenu();
      });
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closeMenu();
      });
      window.addEventListener("resize", () => {
        if (window.innerWidth > 900) closeMenu();
      });
    }
  }
}

// ── Load Catalog (shared across pages) ──
export async function loadCatalog() {
  const response = await fetch("./data/regulations.seed.json");
  if (!response.ok) throw new Error("Unable to load seed data");
  const seed = await response.json();
  let auto = [];
  try {
    const autoResponse = await fetch("./data/regulations.auto.json");
    if (autoResponse.ok) {
      const autoPayload = await autoResponse.json();
      auto = Array.isArray(autoPayload) ? autoPayload : (autoPayload.regulations || []);
    }
  } catch (_err) {
    auto = [];
  }
  const local = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  const merged = canonicalize([...seed, ...auto, ...local]);
  const dedup = new Map();
  for (const item of merged) {
    dedup.set(item.code, item);
  }
  return Array.from(dedup.values());
}

// ── Multi-Provider AI ──
export async function callAI(prompt) {
  const keys = getApiKeys();
  const provider = keys.aiProvider || "gemini";

  if (provider === "gemini") {
    if (!keys.gemini) throw new Error("NO_KEY");
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${keys.gemini}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }]
        })
      }
    );
    const data = await resp.json();
    if (data.error) throw new Error(data.error.message || "Gemini API error");
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  }

  if (provider === "openai") {
    if (!keys.openai) throw new Error("NO_KEY");
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${keys.openai}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }]
      })
    });
    const data = await resp.json();
    if (data.error) throw new Error(data.error.message || "OpenAI API error");
    return data?.choices?.[0]?.message?.content || "";
  }

  if (provider === "groq") {
    if (!keys.groq) throw new Error("NO_KEY");
    const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${keys.groq}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }]
      })
    });
    const data = await resp.json();
    if (data.error) throw new Error(data.error.message || "Groq API error");
    return data?.choices?.[0]?.message?.content || "";
  }

  throw new Error("NO_KEY");
}

export async function callAIChat(messages) {
  const keys = getApiKeys();
  const provider = keys.aiProvider || "gemini";

  if (provider === "gemini") {
    if (!keys.gemini) throw new Error("NO_KEY");
    const contents = messages.map(m => ({
      role: m.role === "assistant" ? "model" : m.role,
      parts: [{ text: m.content }]
    }));
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${keys.gemini}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents })
      }
    );
    const data = await resp.json();
    if (data.error) throw new Error(data.error.message || "Gemini API error");
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  }

  if (provider === "openai") {
    if (!keys.openai) throw new Error("NO_KEY");
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${keys.openai}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: messages.map(m => ({ role: m.role, content: m.content }))
      })
    });
    const data = await resp.json();
    if (data.error) throw new Error(data.error.message || "OpenAI API error");
    return data?.choices?.[0]?.message?.content || "";
  }

  if (provider === "groq") {
    if (!keys.groq) throw new Error("NO_KEY");
    const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${keys.groq}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: messages.map(m => ({ role: m.role, content: m.content }))
      })
    });
    const data = await resp.json();
    if (data.error) throw new Error(data.error.message || "Groq API error");
    return data?.choices?.[0]?.message?.content || "";
  }

  throw new Error("NO_KEY");
}
