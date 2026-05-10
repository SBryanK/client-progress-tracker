// One-shot seeder: insert / upsert weekly updates for the week of
// May 4 – May 9, 2026 across every client mentioned in the user's notes.
//
// Run with:  node scripts/seed-week-may-4-9.mjs
//
// Idempotent: each row is keyed on (clientId, weekStart) so re-running
// only updates the bullets text instead of creating duplicates.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Monday of the target week — schema stores weekStart as a UTC midnight Date.
const weekStart = new Date("2026-05-04T00:00:00.000Z");
const weekLabel = "May 4 – May 9";

const entries = [
  {
    slug: "telkomsel",
    bullets: [
      "Maxstream domain onboarding call and resolved voucher application issue (root cause: voucher stuck in root account)",
      "POC discussion and EO console introduction",
      "Optimised POC domain for TVRI channel and discussed Telkomsel regulatory requirements",
      "Backend tuning and ZhiYan configuration template building",
      "Added 1 domain for 3 TV channels and 1 VOD domain",
    ],
  },
  {
    slug: "mnc-games",
    bullets: [
      "Pre-meeting alignment session with MNC Group / MNC Games (consolidated with PT Esports Star Indonesia)",
      "Initial discussion with IDstar & MNC Games",
      "Follow-up review on security logging requirements from MNC Games",
    ],
  },
  {
    slug: "dana",
    bullets: [
      "Joined silent-drop performance report meeting",
      "Confirmed need to develop a security feature similar to Akamai Account Protector — specifically device tampering identification (with RCE to be added in EO console)",
    ],
  },
  {
    slug: "bank-mandiri",
    bullets: [
      "Assisted RFI filling",
      "Joined Technology Update session on Tencent WAF & CDN",
      "Created PPT for EO financial case study",
    ],
  },
  {
    slug: "pt-visionet-lippo-group",
    bullets: [
      "Followed up with Jesselyn on voucher application and account creation",
    ],
  },
  {
    slug: "como-tv",
    bullets: [
      "🆕 Introduction session by Orion Yan",
      "Joined security discussion with DB and customer",
    ],
  },
  {
    slug: "indosat",
    bullets: [
      "Continued progress follow-up",
    ],
  },
  {
    slug: "internal",
    bullets: [
      "Built Daily Progress App and Weekly Client Progression App (completed)",
      "Researched ZhiYan documentation and live-stream optimisation configuration",
      "Helped colleagues set up Codebuddy, WorkBuddy, and OpenClaw",
      "Read internal iWiki on pricing and new console features",
    ],
  },
  {
    slug: "industry-engagement",
    bullets: [
      "Attended Dobrakfest Tencent x Telkomsel event — met Pak Nugi, Danantara representatives, Pak Soowan from Singtel, and Sinaga",
      "Discussed CSS and EdgeOne with Pau",
    ],
  },
];

async function main() {
  // Pick any OWNER as the author of the records.
  const author = await prisma.user.findFirst({
    where: { role: "OWNER" },
    select: { id: true, email: true },
  });
  if (!author) {
    throw new Error("No OWNER user found — cannot author weekly updates.");
  }
  console.log(`✏️  Authoring as ${author.email}`);

  for (const e of entries) {
    const client = await prisma.client.findUnique({
      where: { slug: e.slug },
      select: { id: true, name: true, status: true },
    });
    if (!client) {
      console.warn(`   ⚠️  skipping unknown client slug "${e.slug}"`);
      continue;
    }

    const bullets = e.bullets.map((b) => `• ${b}`).join("\n");

    await prisma.weeklyUpdate.upsert({
      where: {
        clientId_weekStart: { clientId: client.id, weekStart },
      },
      update: {
        weekLabel,
        bullets,
        status: client.status,
      },
      create: {
        clientId: client.id,
        authorId: author.id,
        weekStart,
        weekLabel,
        bullets,
        status: client.status,
      },
    });
    console.log(`   ✓ ${client.name} (${e.bullets.length} bullets)`);
  }
}

main()
  .catch((err) => {
    console.error("Seeder failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
