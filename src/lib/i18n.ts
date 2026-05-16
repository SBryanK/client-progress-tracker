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

  // ── Bucket labels (4-bucket roster model, May 2026 redesign) ──────
  // PRIMARY  → top, deep-engagement clients (the default landing tab)
  // ASSIST   → clients you support / partner on
  // AKAMAI   → the Akamai → EdgeOne migration cohort
  // INACTIVE → paused / dormant
  "bucket.PRIMARY": { en: "Primary", zh: "重点客户" },
  "bucket.ASSIST": { en: "Assist", zh: "协助跟进" },
  "bucket.AKAMAI": { en: "Akamai", zh: "Akamai 迁移" },
  "bucket.INACTIVE": { en: "Inactive", zh: "已暂停" },
  // Legacy 3-bucket aliases — retained so old pages / saved links
  // (`bucket.ON_WORK`, `bucket.PARTICIPATING`, `bucket.IDLE`,
  // `bucket.ACTIVE`, `bucket.ON_GOING`) still render a sensible label
  // instead of the raw key while the migration finishes propagating.
  "bucket.ON_WORK": { en: "Primary", zh: "重点客户" },
  "bucket.PARTICIPATING": { en: "Assist", zh: "协助跟进" },
  "bucket.IDLE": { en: "Inactive", zh: "已暂停" },
  "bucket.ACTIVE": { en: "Assist", zh: "协助跟进" },
  "bucket.ON_GOING": { en: "Assist", zh: "协助跟进" },

  // ── Engagement stage labels (7-stage taxonomy) ──────────────────────
  "stage.ENGAGEMENT": { en: "Engagement", zh: "初步接洽" },
  "stage.PREPARE_POC": { en: "Prepare POC", zh: "POC 准备" },
  "stage.POC": { en: "POC", zh: "POC 进行中" },
  "stage.FINISH_POC": { en: "Finish POC", zh: "POC 完成" },
  "stage.PRODUCTION": { en: "Production", zh: "生产运行" },
  "stage.AFTERSALES_PROGRESS": { en: "Aftersales Progress", zh: "售后跟进" },
  "stage.DISCONTINUED": { en: "Discontinued", zh: "已终止" },

  // ── Topical group filter (kept for backwards-compat URL params;
  //    the Akamai cohort is now a first-class bucket) ────────────────
  "clients.group.akamai": { en: "Akamai", zh: "Akamai 迁移" },

  // ── Form labels ────────────────────────────────────────
  "form.bucket": { en: "Bucket", zh: "分类" },
  "form.bucket.hint": {
    en: "Primary = your top clients · Assist = support · Akamai = migration cohort · Inactive = paused",
    zh: "重点客户 = 主要负责 · 协助跟进 = 支持参与 · Akamai = 迁移项目 · 已暂停 = 暂时搁置",
  },

  // ── Client metadata labels ──────────────────────────────
  "client.revenue_est": { en: "Revenue est.", zh: "预计收入" },
  "client.first_engagement": { en: "First engagement", zh: "首次接洽" },
  "client.signed_on": { en: "Signed on", zh: "签约日期" },
  "client.open_in_crm": { en: "Open in CRM", zh: "在 CRM 中打开" },
  "client.akamai_badge": { en: "Akamai migration", zh: "Akamai 迁移" },

  // ── Stat-card sub-labels referenced from the home page (4-bucket) ───
  "stat.primary": { en: "Primary", zh: "重点客户" },
  "stat.primary.sub": {
    en: "Top clients · deep engagement",
    zh: "主要负责 · 全力推进",
  },
  "stat.assist": { en: "Assist", zh: "协助跟进" },
  "stat.assist.sub": {
    en: "Support · partner work",
    zh: "支持参与 · 合作推进",
  },
  "stat.akamai": { en: "Akamai", zh: "Akamai 迁移" },
  "stat.akamai.sub": {
    en: "Akamai → EdgeOne migration cohort",
    zh: "Akamai → EdgeOne 迁移客户",
  },
  "stat.inactive": { en: "Inactive", zh: "已暂停" },
  "stat.inactive.sub": { en: "Paused / dormant", zh: "暂停 / 休眠" },
  // Legacy keys preserved so older saved pages keep rendering.
  "stat.onwork": { en: "Primary", zh: "重点客户" },
  "stat.onwork.sub": {
    en: "Top clients · deep engagement",
    zh: "主要负责 · 全力推进",
  },
  "stat.participating": { en: "Assist", zh: "协助跟进" },
  "stat.participating.sub": {
    en: "Support · partner work",
    zh: "支持参与 · 合作推进",
  },

  // ── First-visit identity gate ─────────────────────────────
  "gate.eyebrow": { en: "Welcome", zh: "欢迎" },
  "gate.title": {
    en: "Welcome to Bryan's Daily Progress",
    zh: "欢迎来到 Bryan 的每周进展",
  },
  "gate.subtitle": {
    en: "How would you like to continue? We'll remember your choice for a year on this browser.",
    zh: "请选择身份继续。该选择会在本浏览器保留一年，随时可在顶部重置。",
  },
  "gate.owner_card_title": { en: "I'm Bryan", zh: "我是 Bryan" },
  "gate.owner_card_body": {
    en: "Consistency surpasses talent — hope you have a good day, Bryan.",
    zh: "坚持胜过天赋 — Bryan，今天也是好日子。",
  },
  "gate.visitor_card_title": { en: "I'm a visitor", zh: "我是访客" },
  "gate.visitor_card_body": {
    en: "Browse Bryan's journal, weekly logs and client roster — all read only.",
    zh: "浏览 Bryan 的客户名册、周报和日志 — 仅查看权限。",
  },
  "gate.visitor_cta": { en: "Continue as visitor →", zh: "以访客身份进入 →" },
  "gate.owner_cta": { en: "Sign in as Bryan →", zh: "以 Bryan 身份登录 →" },
  "gate.helper": {
    en: "Visitors can read everything; only Bryan can edit, log updates and import.",
    zh: "访客可查看全部内容；仅 Bryan 可编辑、记录周报与导入数据。",
  },
  "gate.reset": { en: "Reset identity", zh: "重置身份选择" },
  // ── Footer ────────────────────────────────────────────────────────
  "footer.role": {
    en: "EdgeOne Solutions Architect Intern",
    zh: "EdgeOne 解决方案架构师实习生",
  },

  // ── Share link expired / revoked view ─────────────────────────────
  "share.eyebrow": { en: "Shared report", zh: "共享报告" },
  "share.expired.title": {
    en: "This share link has expired",
    zh: "该共享链接已过期",
  },
  "share.revoked.title": {
    en: "This share link has been revoked",
    zh: "该共享链接已被撤销",
  },
  "share.expired.desc": {
    en: "The owner set an expiry on this read-only report and the date has passed.",
    zh: "该只读报告设置了过期时间，链接已失效。",
  },
  "share.revoked.desc": {
    en: "The owner has manually revoked access to this read-only report.",
    zh: "该只读报告已被所有者手动撤销访问。",
  },
  "share.expired.cta": {
    en: "If you still need a copy of the data, please ask the owner to regenerate the link.",
    zh: "如果仍需查看数据，请联系所有者重新生成链接。",
  },
  "share.go_home": { en: "Go to homepage", zh: "返回首页" },
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
