// Bilingual UI dictionary (English ↔ Simplified Chinese).
//
// This file is the single source of truth for every static string that
// should be translated. The keys use dot-namespaces so we can grow this
// without collisions ("nav.home", "clients.title", etc).
//
// Translations were written with care to match the *meaning* of the
// original English copy, not a word-for-word transliteration. Numbers,
// client names, and user-entered bullets are NOT translated here —
// those stay verbatim, because they're data, not UI chrome.
//
// If you add a new visible string to the app, add it here first, then
// reference it via `t("my.new.key", lang)`.

export type Lang = "en" | "zh";

export const LANGS: readonly Lang[] = ["en", "zh"] as const;

export const LANG_LABEL: Record<Lang, string> = {
  en: "EN",
  zh: "中文",
};

type Dict = Record<string, { en: string; zh: string }>;

export const DICT: Dict = {
  // ── Header / nav ──────────────────────────────────────────────────
  "nav.home": { en: "Home", zh: "首页" },
  "nav.clients": { en: "Clients", zh: "客户" },
  "nav.weekly": { en: "Weekly", zh: "周报" },
  "nav.reports": { en: "Reports", zh: "报表" },
  "nav.dashboard": { en: "Dashboard", zh: "仪表盘" },
  "nav.home.aria": { en: "Home", zh: "返回首页" },
  "nav.add_update": { en: "Add update", zh: "新增周报" },
  "nav.sign_in": { en: "Sign in", zh: "登录" },
  "nav.sign_out": { en: "Sign out", zh: "退出登录" },
  "nav.theme.light": { en: "Switch to light mode", zh: "切换到浅色模式" },
  "nav.theme.dark": { en: "Switch to dark mode", zh: "切换到深色模式" },
  "nav.language": { en: "Language", zh: "语言" },

  // ── Landing / home hero ───────────────────────────────────────────
  "home.hero.prefix": { en: "Weekly progress,", zh: "每周进展 ·" },
  "hero.eyebrow": { en: "Client Progress Tracker", zh: "客户进展追踪" },
  "hero.title.prefix": { en: "Weekly progress,", zh: "每周进展 ·" },
  "hero.subtitle": {
    en: "A calm, living log of every client I'm working with — what moved this week, what's idle, and what's on-going.",
    zh: "一份平静、持续更新的客户工作日志 —— 记录本周进展、闲置项目与长期跟进。",
  },
  "home.cta.log": { en: "Log weekly update", zh: "记录本周进展" },
  "home.cta.browse": { en: "Browse clients", zh: "浏览客户" },
  "home.cta.timeline": { en: "Open timeline →", zh: "查看时间线 →" },
  "home.cta.report": { en: "Download report →", zh: "下载报告 →" },

  // ── Stat cards ────────────────────────────────────────────────────
  "stat.total": { en: "Total clients", zh: "客户总数" },
  "stat.total.sub": { en: "Tracked across all statuses", zh: "涵盖所有状态" },
  "stat.active": { en: "Active", zh: "进行中" },
  "stat.active.sub": { en: "Currently moving", zh: "当前有进展" },
  "stat.ongoing": { en: "On-going", zh: "长期跟进" },
  "stat.ongoing.sub": {
    en: "Long-running / in-flight",
    zh: "持续服务 / 进行中",
  },
  "stat.idle": { en: "Idle", zh: "闲置" },
  "stat.idle.sub": { en: "Paused / low priority", zh: "暂停 / 低优先级" },

  // ── Recent updates section ────────────────────────────────────────
  "recent.title": { en: "Recent updates", zh: "最近更新" },
  "recent.eyebrow": { en: "Timeline", zh: "时间线" },
  "recent.sub": {
    en: "The most recent weekly logs across all clients.",
    zh: "所有客户最近的周报记录。",
  },
  "recent.open_timeline": { en: "Open timeline", zh: "打开时间线" },
  "recent.empty": { en: "No weekly updates yet.", zh: "暂无周报记录。" },

  // ── All-clients page ──────────────────────────────────────────────
  "clients.title": { en: "All clients", zh: "全部客户" },
  "clients.showing": { en: "Showing", zh: "当前筛选" },
  "clients.clear": { en: "clear", zh: "清除" },
  "clients.empty": { en: "No clients in this bucket yet.", zh: "该状态下暂无客户。" },
  "clients.add_link": { en: "Add a client →", zh: "添加客户 →" },
  "clients.filter_all": { en: "All", zh: "全部" },
  "clients.filter_aria": {
    en: "Filter by status bucket",
    zh: "按状态筛选",
  },
  "clients.last_update": { en: "Last update", zh: "最近更新于" },
  "clients.no_update": { en: "No weekly update yet", zh: "暂无周报" },
  "clients.open": { en: "Open →", zh: "查看 →" },

  // ── Status bucket labels ──────────────────────────────────────────
  "bucket.ACTIVE": { en: "Active", zh: "进行中" },
  "bucket.ON_WORK": { en: "On-work", zh: "深度跟进" },
  "bucket.ON_GOING": { en: "On-going", zh: "长期跟进" },
  "bucket.IDLE": { en: "Idle", zh: "闲置" },

  // ── Footer ────────────────────────────────────────────────────────
  "footer.role": {
    en: "EdgeOne Solutions Architect Intern",
    zh: "EdgeOne 解决方案架构师实习生",
  },
};

/**
 * Look up a translated string. Unknown keys return the key itself so
 * missing translations are obvious in the UI rather than rendering empty.
 */
export function t(key: keyof typeof DICT | string, lang: Lang): string {
  const entry = (DICT as Dict)[key as string];
  if (!entry) return key;
  return entry[lang] ?? entry.en;
}
