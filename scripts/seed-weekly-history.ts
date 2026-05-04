/*
 * Historical weekly-update backfill.
 *
 * Ingests Bryan's hand-written progress log (spanning September 2024 →
 * early April 2025) into the `WeeklyUpdate` table.
 *
 * Idempotent: uses `upsert` on the `(clientId, weekStart)` composite
 * unique so re-running leaves the DB in the same state.
 *
 * Missing clients are created on-the-fly with a sensible default status.
 * Every weekStart is snapped to a UTC Monday to match the rest of the
 * app's week-math.
 *
 *   pnpm tsx scripts/seed-weekly-history.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** UTC Monday for the given ISO date string (YYYY-MM-DD). */
function mondayUTC(iso: string): Date {
  const d = new Date(iso + "T00:00:00Z");
  const dow = (d.getUTCDay() + 6) % 7; // 0 = Mon
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dow),
  );
}

/** "Apr 7 – Apr 11" pretty-label for a UTC Monday. */
function prettyLabel(monday: Date): string {
  const end = new Date(monday.getTime() + 4 * 86400000);
  const fmt = (d: Date) =>
    `${d.toLocaleString("en-US", { month: "short", timeZone: "UTC" })} ${d.getUTCDate()}`;
  return `${fmt(monday)} – ${fmt(end)}`;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

type Entry = {
  /** Any calendar date in the target week — will be snapped to Monday. */
  week: string;
  /** Client display name (or existing slug). We'll resolve to id. */
  client: string;
  /** Default status bucket if we need to create the client. */
  defaultStatus?: string;
  /** Bullet lines — joined with newlines into the `bullets` field. */
  bullets: string[];
};

// ─────────────────────────────────────────────────────────────────────
// The log itself. Every entry is a (week, client, bullets) triple.
// Where multiple dates were mentioned inside a bullet I kept the (dd)
// prefix so the day-level granularity is preserved in the timeline.
// ─────────────────────────────────────────────────────────────────────
const ENTRIES: Entry[] = [
  // ═══ September 2024 ═════════════════════════════════════════════════
  {
    week: "2024-09-09",
    client: "Morgan Stanley",
    defaultStatus: "POTENTIAL",
    bullets: [
      "Invited on Friday (Sep 12); currently preparing the access needed (Akamai accounts, etc).",
      "Received Morgan Stanley's rule config for Akamai — will translate it to Tencent EdgeOne rule-engine format.",
    ],
  },
  {
    week: "2024-09-09",
    client: "Galeri24",
    bullets: [
      "Assisted customer traffic switching to EO on Saturday Sep 6 (with Dexmond).",
      "Assisted customer Q&A meeting section with Dexmond on Tuesday Sep 9.",
      "Note: customer is mostly not comfortable speaking in English.",
    ],
  },
  {
    week: "2024-09-09",
    client: "Sevima",
    bullets: [
      "Customer asked in an earlier meeting if they can get help applying a configuration template across hundreds of TLDs.",
      "Studied how to utilise the API and successfully tested a self-made script against my personal site. Waiting for the customer's formal request.",
    ],
  },
  {
    week: "2024-09-09",
    client: "Sayur Box",
    bullets: [
      "Invited to client meeting on Tuesday Sep 9 (with Dexmond) to assist with console tutorial and rules experiment.",
      "Assisted customer Q&A meeting with Dexmond (notes in the group; will be filed to List of Works).",
      "Assisted Dexmond and Bryan in translating AWS security rules to Tencent EdgeOne format.",
      "Note: customer has not reached back after the planned internal meeting.",
    ],
  },
  {
    week: "2024-09-09",
    client: "DBS",
    bullets: [
      "Currently standby in the group, waiting for assigned tasks.",
      "Learning how to export / import config rules between EdgeOne domains.",
      "Customer has prepared to move IP and has created a testing account.",
      "Customer running penetration-testing simulation on its onboarded domain.",
    ],
  },

  {
    week: "2024-09-23",
    client: "Sayur Box",
    bullets: [
      "Progress: officially went live with EdgeOne on their production CDN provider (Dexmond as lead, Bryan as support) — Sep 24.",
    ],
  },

  {
    week: "2024-09-30",
    client: "Sevima",
    bullets: [
      "Supported customer's question about WAF QPS and bandwidth limitation and the overuse plan (together with Max Meiden).",
    ],
  },
  {
    week: "2024-09-30",
    client: "DANA",
    bullets: [
      "Documented key discussion points and provided further insights related to DANA bot-management progress to the client during dinner.",
    ],
  },

  // ═══ October 2024 ═══════════════════════════════════════════════════
  {
    week: "2024-10-07",
    client: "BNI",
    bullets: [
      "(Oct 6) Joined PoC meeting with Natalia Yunus as BD.",
      "Assisted discussion about origin-pull IP configuration in origin server (SIEM).",
    ],
  },
  {
    week: "2024-10-07",
    client: "IHG",
    bullets: [
      "Created a GraphQL introduction presentation (PPT + docs).",
      "Performed GraphQL testing within an internal domain.",
    ],
  },
  {
    week: "2024-10-07",
    client: "Galeri24",
    bullets: [
      "(Oct 8) Joined meeting with Dexmond; discussed reason of low internal security score when using EdgeOne.",
      "Root cause: the client is using a lower TLS version and testing at layer 4, so all the outdated TLS and cipher-suite components are mis-flagged as vulnerable.",
    ],
  },

  {
    week: "2024-10-14",
    client: "BNI",
    bullets: [
      "Initiated IP-whitelisting guidance in Bahasa Indonesia and published it on iWiki.",
    ],
  },
  {
    week: "2024-10-14",
    client: "DANA",
    bullets: [
      "Created PPT blueprint for the Oct 22–24 workshop.",
      "Recorded an English-dubbed version of Eric's Banking App demo to be presented during the DANA workshop in Bandung.",
    ],
  },

  {
    week: "2024-10-21",
    client: "DANA",
    bullets: [
      "Participated in the DANA workshop in Bandung. Objective: introduce Tencent security solutions to the DANA team and train them on usage.",
      "Presented to 10+ DANA representatives about EdgeOne and ran a hands-on session on the EdgeOne console.",
    ],
  },

  {
    week: "2024-10-28",
    client: "BNI",
    bullets: [
      "(Oct 28) Joined PoC meeting with Eric and Max; acted as support.",
      "(Oct 27) Assisted discussion about domain onboarding to Tencent EdgeOne on WhatsApp; helped validate domain migration and account activation in Tencent EdgeOne.",
    ],
  },
  {
    week: "2024-10-28",
    client: "AlloBank",
    bullets: [
      "(Oct 28) Joined meeting with Dexmond; assisted in explaining the steps and detail required to push logs into the SIEM server.",
    ],
  },

  // ═══ November 2024 ══════════════════════════════════════════════════
  {
    week: "2024-11-04",
    client: "Galeri24",
    bullets: [
      "(Nov 10) Supported in validating October's Security Report — explained the key details of the moderate score and suggested improvements in the EdgeOne console.",
    ],
  },
  {
    week: "2024-11-04",
    client: "AlloBank",
    bullets: [
      "(Nov 5) Assisted domain migration with Dexmond; helped monitor traffic coming through the EdgeOne server.",
      "(Nov 7) Assisted domain migration with Dexmond; helped monitor traffic coming through the EdgeOne server.",
      "Acted as the point of reference for the Tencent Cloud team in monitoring real-time performance of the migrated domain (only available for Indonesian citizens).",
      "Assisted in defining and solving a high-latency / 522 status-code issue on the domain after migration to EdgeOne. Problem already solved.",
    ],
  },

  {
    week: "2024-11-18",
    client: "Pertamedika",
    bullets: [
      "(Nov 17) Visited partner office (Eksad) to introduce EdgeOne as an all-in-one platform; discussed the customer's (Pertamedika) list of requirements and quoted price.",
      "Answered partner's questions about log service, bot-management capabilities (especially client attestation), and SSO integration in the EO console.",
    ],
  },
  {
    week: "2024-11-18",
    client: "Leyun",
    bullets: [
      "(Nov 18) Answered customer question about a problem uploading batch DNS records — solved by suggesting to edit the SOA and NS record.",
      "Provided examples of no-cache rules from Tencent EO documentation and assisted the customer in creating rules based on file extension.",
      "Clarified that the file-cache list in the EO documentation implies a default cache time (e.g. 2 h) without additional custom-rule creation.",
    ],
  },
  {
    week: "2024-11-18",
    client: "BNI",
    bullets: [
      "(Nov 19) Joined meeting to discuss domain-verification root cause, load balancing, and traffic splitting; also covered geolocation traffic restriction. Eric covered all web-security modules.",
      "Shared the meeting minutes.",
    ],
  },
  {
    week: "2024-11-18",
    client: "DANA",
    bullets: [
      "(Nov 20) Joined the support team for the 4 am traffic-migration event (1% traffic) with continuous follow-up over the next 2 days.",
    ],
  },
  {
    week: "2024-11-18",
    client: "Alian",
    defaultStatus: "INACTIVE",
    bullets: [
      "(Nov 19) Joined meeting to discuss the root problem; talked through the root cause of the domain issue.",
    ],
  },

  {
    week: "2024-11-25",
    client: "Galeri24",
    bullets: [
      "(Nov 25) Discussed current low score in the Security card; proposed a solution and explained that the testing method is incorrect, providing the correct prompt to be executed.",
    ],
  },
  {
    week: "2024-11-25",
    client: "Pertamedika",
    bullets: [
      "(Nov 27) Visited partner office (Eksad) to introduce EdgeOne as an all-in-one platform.",
      "Assisted in discussion on customer concerns and interest around web security — in particular DDoS and bot management.",
      "Assisted in the main discussion during the sharing session: load balancing between origin servers, capability of only assigning users from particular regions, and log-service retention duration + connectivity to their SIEM product.",
      "Supported client Q&A in the WhatsApp group.",
      "Created meeting minutes afterwards.",
    ],
  },
  {
    week: "2024-11-25",
    client: "Sayur Box",
    bullets: [
      "(Nov 27) Assisted in identifying a problem where the client was unable to access sayurbox.co.id using IPv6. Solved by assuming the problem is between client and edge server — found out customer had not enabled the IPv6 function in the console.",
    ],
  },
  {
    week: "2024-11-25",
    client: "Leyun",
    bullets: [
      "(Nov 27) Assisted in explaining to customer (LeYun's Vincent) about an error in EdgeOne domain management because NS has not been moved to Tencent; proposed migrating all records first, then NS later.",
      "(Nov 28) Helped LeYun explain why all the batched-import requests got suspended when migrating to Tencent at 8 am — solved by proposing a workflow that completes site-acceleration domain onboarding first (enabling the CNAME record) while suspending other record types.",
    ],
  },

  // ═══ December 2024 ══════════════════════════════════════════════════
  {
    week: "2024-12-02",
    client: "Leyun",
    bullets: [
      "(Dec 1, Dec 4) Assisted in explaining confusion about traffic-usage number differences between the console and billing — explained delayed synchronisation and the international-usage ratio scheme.",
      "Assisted in explaining the billing scheme for extra-package purchases and the possibility of applying for discounts; also covered plan-upgrade behaviour in EdgeOne (whether the previous plan quota is lost or not).",
      "Guided add-ons purchase; answered questions about add-ons, VAU tier, and potential overusage problems; explained prioritisation in quota consumption.",
    ],
  },
  {
    week: "2024-12-02",
    client: "Alian",
    defaultStatus: "INACTIVE",
    bullets: [
      "(Dec 5) Presented EdgeOne to new partner Alian. Questions raised:",
      "1. How EdgeOne compares (performance, security, cost) to competing CDN/WAF providers.",
      "2. How to separate and manage different environments (production vs staging/UAT).",
      "3. How EdgeOne fits into a multi-CDN or hybrid architecture if the customer keeps existing providers in parallel.",
      "4. How pricing under the VAU model maps to their traffic pattern (request volume, regions, feature usage) and how to design for a predictable budget.",
    ],
  },

  {
    week: "2024-12-23",
    client: "Leyun",
    bullets: [
      "(Dec 23) Introduced other Tencent Cloud security products as the client is interested in learning more — primarily about CWPP.",
      "Brought the discussion to the customer group chat to discuss with BD (Jacob).",
    ],
  },
  // Dec 15-19 and Dec 29-Jan 2 were N.A — skipped intentionally.

  // ═══ January 2025 ═══════════════════════════════════════════════════
  {
    week: "2025-01-13",
    client: "Pertamedika",
    bullets: [
      "(Jan 13) Joined client onsite meeting to discuss EdgeOne feature of VPN tunneling using client private IP between edge server and origin. Update: EdgeOne does not have this feature and is not planning to develop it soon.",
    ],
  },
  {
    week: "2025-01-13",
    client: "HSBC",
    bullets: [
      "(Jan 14–15) Assisted in validating rule-engine configuration parameter values between the deployed configuration in the console and in Terraform.",
      "Assisted in validating version-management response when deleting a domain under version-management enabled.",
    ],
  },

  {
    week: "2025-01-27",
    client: "Pertamedika",
    bullets: [
      "(Jan 28) Assisted Eksad (partner for Pertamedika) to create / find competitive advantages of EdgeOne — strong DDoS protection and ultra-low latency.",
    ],
  },
  {
    week: "2025-01-27",
    client: "DBS",
    bullets: [
      "(Jan 28) Assisted Eric in discussion for DBS; checked EO IPs in the CIDR block usable by the customer. Root cause: Tencent only purchased some IPs in the range, and some of those are idle / not yet used by Tencent.",
    ],
  },
  {
    week: "2025-01-27",
    client: "HSBC",
    bullets: [
      "(Jan 30) Assisted Yinloong in creating Terraform version management to automatically deploy version management for L7 and Edge Function workmode.",
      "Worked during the weekend; by Monday the automation was tested. Test was not fully successful yet due to a bug and a misunderstanding in deployment.",
      "Helped Yinloong learn GitHub Python code and Terraform code to eventually integrate the version-management automation in the main file.",
    ],
  },
  {
    week: "2025-01-27",
    client: "Indosat",
    bullets: [
      "(Jan 29) Facilitated meeting with IndoSat at client office. Joined Bruce (Zongying Li) to introduce EdgeOne capabilities and the opportunity to be used by IndoSat's SuperApp, MyIM3, and BIMA+. Meeting: 11 am – 12:15 pm. Next step is to share SoP.",
    ],
  },

  // ═══ February 2025 ══════════════════════════════════════════════════
  {
    week: "2025-02-03",
    client: "Kaltura",
    bullets: [
      "(Feb 2) Assigned task to work on JavaScript G2O for Kaltura with Danieldwang.",
      "(Feb 3) Joined discussion; did preliminary research about Kaltura and Akamai G2O feature — it is different from Origin Protection of EdgeOne.",
      "G2O (signature header) is generally stronger because an attacker needs the secret to mimic a valid request.",
      "EdgeOne Origin Protection (IP allowlist) is safe for many cases, but its basis is 'trust edge IP'. If a vulnerability in the network path, a misconfig, or a supply-chain issue makes traffic appear to come from the allowlisted IP, this control doesn't have a built-in crypto layer.",
    ],
  },
  {
    week: "2025-02-03",
    client: "HSBC",
    bullets: [
      "(Feb 3) Met Yinloong and guided integration of the Terraform code for the HSBC project. Assigned task to verify and create a JSON output-file comparison with Terraform for all rule-engine features in EdgeOne. Read the GitHub source code about the HSBC project.",
      "(Feb 4) Guided by Yinloong to connect GitHub internal (git.woa.com) to terminal and use an SSH key; created a docs review about how to set it up.",
      "(Feb 5) Assisted HSBC domain cutover with Cyau (Christopher); created a document guidance in Docs.",
      "(Feb 6) Assisted HSBC domain cutover.",
    ],
  },
  {
    week: "2025-02-03",
    client: "GCS (Grandtech Cloud Solutions)",
    defaultStatus: "INACTIVE",
    bullets: [
      "(Feb 4) Internal GCS meeting with Sam (Sales) and Max — casual talk and relationship-building between Tencent Indonesia and GCS Indonesia. GCS is a major AWS reseller interested in exploring Tencent Cloud.",
      "(Feb 6) Facilitated meeting preparation with GCS at 10 am; however, the meeting was cancelled one-sided and Sam (Sales) was disappointed and shared his thoughts in the group. We will arrange another meeting with GCS representatives in the future.",
    ],
  },
  {
    week: "2025-02-03",
    client: "Indosat",
    bullets: [
      "(Feb 5) Facilitated IndoSat meeting 3 pm – 4 pm; continued with a meeting with Dex to discuss the requirement of 1 dedicated IP. Agreed that GCP might use a load balancer to enable this feature; Ahmad will confirm with the IndoSat representative (classmates at school).",
    ],
  },
  {
    week: "2025-02-03",
    client: "BNI",
    bullets: [
      "(Feb 4) Meeting with Eric and Zhao Chang to validate Client Attestation results and progress on Android and iOS devices. iOS was initially not working, but the test later succeeded; Eric shared the findings with DANA's team and we were ready for 1% traffic on Friday, Feb 6.",
      "(Feb 6) Assisted BNI in migrating 1% traffic (dynamic) from Akamai to EdgeOne; validated the Client Attestation module functionalities.",
    ],
  },

  {
    week: "2025-02-10",
    client: "Telkomsel",
    bullets: [
      "(Feb 9) Joined client onsite meeting to build relationship with Telkomsel B2B department and discuss feature requirements. Introduced EdgeOne and Tencent Cloud verbally to the customer. Arranged a future meeting with Mr. Sam next Wednesday.",
      "(Feb 11) Met with Telkomsel; Mr. Sam presented EdgeOne and Tencent Cloud CDN background; Bryan shared dashboard features and available metrics, how to read the data, and site-acceleration features.",
    ],
  },
  {
    week: "2025-02-10",
    client: "HSBC",
    bullets: [
      "(Feb 10) Worked on Terraform and a shell script to enable hostname testing with path instead of plain hostname. The latest shell-script version from Yinloong had not been pushed to GitHub yet.",
    ],
  },
  {
    week: "2025-02-10",
    client: "Indosat",
    bullets: [
      "(Feb 9) Discussed RASCI matrix with Ahmad and Bruce Li before sending the draft to the client; shared with client on Feb 10.",
      "(Feb 11) Discussed five concern points from IndoSat SuperApps team:",
      "1. End-to-end content latency — user opens app, content asset delivered to user.",
      "2. Compression.",
      "3. Scalability — able to serve huge traffic.",
      "4. Able to zero-rate from IOH network.",
      "5. Cost-reduction projection.",
    ],
  },
  {
    week: "2025-02-10",
    client: "BNI",
    bullets: [
      "(Feb 11) Joined client onsite meeting to discuss EdgeOne features of MTR and Origin Latency data in the dashboard again. Update: EdgeOne does not have this feature and is not planning to develop it soon.",
      "(Feb 12) Facilitated meeting and discussion with BNI partner (Metrocom); shared EdgeOne background introduction, features of acceleration and security. Metrocom is interested in billing management, which is beyond SA scope.",
    ],
  },

  // Feb 18-24 is the Indonesian holiday week — intentionally empty.

  {
    week: "2025-02-17",
    client: "Pertamedika",
    bullets: [
      "(Feb 19) Answered questions about the origin-protection feature in EdgeOne. Client restated they are interested in having a VPN connection between origin and CDN (similar to Cloudflare Connectors). After discussion with Eric (Yan Meng Hui) and C2000, Tencent currently doesn't have that feature.",
    ],
  },
  {
    week: "2025-02-17",
    client: "HSBC",
    bullets: [
      "(Feb 19) Assisted in validating the feasibility of using Squid Proxy and deploying a VM using the Multipass library. Created documentation on how to install and configure Squid Proxy; shared with Yinloong (https://doc.weixin.qq.com/doc/w3_AWUAjwbSAIwSGAOSWjfUNRq6sUWKE?scode=AJEAIQdfAAoIpIRbe8AWUAjwbSAIw).",
    ],
  },
  {
    week: "2025-02-17",
    client: "BNI",
    bullets: [
      "(Feb 19) Established communication with the Queue-it team to ask about the availability of queue-flushing and to schedule a product demonstration in English and Chinese (after discussion with Mr. Sam, this needs to be communicated with the upper-rank management team first).",
      "(Feb 20) Supported BNI CNAME migration from 8:00–9:30 pm (digicm.bni.co.id).",
      "(Feb 21) Assisted in explaining origin-pull latency data and MTR (Main Trace Route) in the EdgeOne dashboard. EdgeOne can provide origin-pull latency data — limited to TTFB and HTTP handshake time. MTR is to be discussed.",
      "(Feb 22) Assisted in explaining origin-protection features to whitelist all EO IPs on the BNI server. Client also asked about GAAP; conducted research about GAAP and its difference from EdgeOne for discussion in another meeting.",
    ],
  },
  {
    week: "2025-02-17",
    client: "Bitkub",
    bullets: [
      "(Feb 21) Joined an EdgeOne meeting with BitKub; presented EdgeOne capabilities and feature definitions. With Eric, supported the PoC and answered questions, including comparisons / advantages vs Cloudflare.",
    ],
  },
  {
    week: "2025-02-17",
    client: "AlloBank",
    bullets: [
      "(Feb 20) Assisted AlloBank with a technical question: whether one domain can have two open ports. Together with Eric, provided the client with documentation on L4 Proxy setup.",
    ],
  },
  {
    week: "2025-02-17",
    client: "GCS (Grandtech Cloud Solutions)",
    defaultStatus: "INACTIVE",
    bullets: [
      "(Feb 21) Invited by ZhengWeiWu to attend the first client meeting in Senayan City to build customer relationship. GCS is a significant AWS reseller in Asia. Meeting was cancelled last minute due to client unavailability.",
    ],
  },
  {
    week: "2025-02-17",
    client: "Galeri24",
    bullets: [
      "(Feb 20) Assisted validating the client's SSO domain. Client complained they got a 525 error when trying to access the domain; however, Tencent EO side was able to access it via browser as well as curl test.",
    ],
  },

  // ═══ March 2025 ═════════════════════════════════════════════════════
  {
    week: "2025-03-03",
    client: "Galeri24",
    bullets: [
      "Provided ongoing technical assistance and coordination support during client engagements and internal alignment sessions.",
    ],
  },
  {
    week: "2025-03-03",
    client: "BNI",
    bullets: [
      "Led performance, delivery, and security analysis for EdgeOne PoC, including preparation of detailed traffic and capability reports (Jan–Feb).",
      "Coordinated stakeholder alignment (BD, SA, client) and supported technical discussions on CDN architecture, DNS strategy, and feature requirements.",
      "Initiated and tracked feature requests via TAPD and Andon, ensuring visibility of client requirements.",
    ],
  },
  {
    week: "2025-03-03",
    client: "HSBC",
    bullets: [
      "Supported multi-session domain cutover execution, including pre-cutover validation and real-time troubleshooting during migration windows.",
    ],
  },
  {
    week: "2025-03-03",
    client: "Indosat",
    bullets: [
      "Assisted HTTPS configuration setup and participated in technical discussion sessions to ensure secure delivery readiness.",
    ],
  },
  {
    week: "2025-03-03",
    client: "CBN Cloud (IndoMacro)",
    defaultStatus: "POTENTIAL",
    bullets: [
      "Conducted technical presentation and consultation on CDN failover strategy using multi-NS architecture.",
      "Analysed traffic profile (~600 TB/month) and proposed a backup CDN approach.",
    ],
  },
  {
    week: "2025-03-03",
    client: "Prada",
    bullets: [
      "Supported Akamai-to-EdgeOne migration testing, including environment setup, JSON configuration validation, and early-stage debugging.",
    ],
  },

  {
    week: "2025-03-10",
    client: "BNI",
    bullets: [
      "Led TLS version and cipher-suite compliance validation and configuration, including client-facing technical session and internal enablement.",
      "Developed Bill of Quantities (BoQ) aligned with managed CDN and cloud-security requirements.",
      "Continued coordination with stakeholders to align on delivery roadmap and feature expectations.",
    ],
  },
  {
    week: "2025-03-10",
    client: "Prada",
    bullets: [
      "Investigated and debugged 403 errors during domain-migration testing; identified potential root cause related to origin-side IP whitelisting and Edge Function behaviour.",
      "Produced internal documentation for testing workflows and configuration handling.",
    ],
  },
  {
    week: "2025-03-10",
    client: "Astra (SERA)",
    defaultStatus: "POTENTIAL",
    bullets: [
      "Led technical discussion on API Protection capabilities, including solution positioning and alignment with client use case.",
    ],
  },
  {
    week: "2025-03-10",
    client: "HSBC",
    bullets: [
      "Continued support for domain cutover and post-migration validation.",
    ],
  },

  {
    week: "2025-03-31",
    client: "Galeri24",
    bullets: [
      "Provided ongoing technical assistance and coordination support during client engagements and internal alignment sessions.",
    ],
  },
  {
    week: "2025-03-31",
    client: "BNI",
    bullets: [
      "Led performance, delivery, and security analysis for EdgeOne PoC, including preparation of detailed traffic and capability reports (Jan–Feb).",
      "Coordinated stakeholder alignment (BD, SA, client) and supported technical discussions on CDN architecture, DNS strategy, and feature requirements.",
      "Initiated and tracked feature requests via TAPD and Andon, ensuring visibility of client requirements.",
    ],
  },
  {
    week: "2025-03-31",
    client: "HSBC",
    bullets: [
      "Supported multi-session domain cutover execution, including pre-cutover validation and real-time troubleshooting during migration windows.",
    ],
  },
  {
    week: "2025-03-31",
    client: "Indosat",
    bullets: [
      "Assisted HTTPS configuration setup and participated in technical discussion sessions to ensure secure delivery readiness.",
    ],
  },
  {
    week: "2025-03-31",
    client: "CBN Cloud (IndoMacro)",
    defaultStatus: "POTENTIAL",
    bullets: [
      "Conducted technical presentation and consultation on CDN failover strategy using multi-NS architecture.",
      "Analysed traffic profile (~600 TB/month) and proposed a backup CDN approach.",
    ],
  },
  {
    week: "2025-03-31",
    client: "Prada",
    bullets: [
      "Supported Akamai-to-EdgeOne migration testing, including environment setup, JSON configuration validation, and early-stage debugging.",
      "Meeting with customer to be scheduled soon.",
    ],
  },
];

async function resolveClientId(
  name: string,
  defaultStatus: string | undefined,
  ownerId: string,
): Promise<string> {
  const slug = slugify(name);
  // Try slug first, then fall back to case-insensitive name match.
  let c = await prisma.client.findFirst({ where: { slug } });
  if (!c) {
    const byName = await prisma.client.findMany({
      where: { name: { contains: name.split(" ")[0]! } },
    });
    c = byName.find((x) => x.name.toLowerCase() === name.toLowerCase()) ?? null;
  }
  if (c) return c.id;

  // Not found — create with a sensible default.
  const created = await prisma.client.create({
    data: {
      name,
      slug,
      status: defaultStatus ?? "POTENTIAL",
      priority: "MEDIUM",
      ownerId,
      summary: null,
    },
  });
  console.log(`[seed] created new client: ${created.name} (${created.slug})`);
  return created.id;
}

async function main() {
  // Grab the primary owner — required to author a WeeklyUpdate.
  const owner = await prisma.user.findFirst({
    where: { role: "OWNER" },
    orderBy: { createdAt: "asc" },
  });
  if (!owner) {
    console.error(
      "[seed] No OWNER user in the DB. Run `npm run db:seed` first.",
    );
    process.exit(1);
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  // Group entries by (week, client) so if the same log appears twice we
  // merge rather than fight the unique index.
  const grouped = new Map<string, Entry>();
  for (const e of ENTRIES) {
    const key = `${mondayUTC(e.week).toISOString()}::${slugify(e.client)}`;
    const prev = grouped.get(key);
    if (prev) {
      prev.bullets = Array.from(new Set([...prev.bullets, ...e.bullets]));
    } else {
      grouped.set(key, { ...e, bullets: [...e.bullets] });
    }
  }

  for (const entry of grouped.values()) {
    const weekStart = mondayUTC(entry.week);
    const clientId = await resolveClientId(
      entry.client,
      entry.defaultStatus,
      owner.id,
    );
    const label = prettyLabel(weekStart);
    const bullets = entry.bullets
      .map((l) => (l.startsWith("•") ? l : `• ${l}`))
      .join("\n");

    const existing = await prisma.weeklyUpdate.findUnique({
      where: { clientId_weekStart: { clientId, weekStart } },
    });

    if (existing) {
      // Merge: union of bullet lines to avoid overwriting a real user edit.
      const before = new Set(
        existing.bullets.split("\n").map((l) => l.trim()).filter(Boolean),
      );
      const after = new Set([
        ...before,
        ...bullets.split("\n").map((l) => l.trim()).filter(Boolean),
      ]);
      const merged = Array.from(after).join("\n");
      if (merged === existing.bullets) {
        skipped++;
        continue;
      }
      await prisma.weeklyUpdate.update({
        where: { id: existing.id },
        data: { bullets: merged, weekLabel: label },
      });
      updated++;
      console.log(
        `[seed] MERGED ${entry.client} @ ${label} (${weekStart.toISOString().slice(0, 10)})`,
      );
    } else {
      await prisma.weeklyUpdate.create({
        data: {
          clientId,
          authorId: owner.id,
          weekStart,
          weekLabel: label,
          bullets,
          status: null,
        },
      });
      inserted++;
      console.log(
        `[seed] +new   ${entry.client} @ ${label} (${weekStart.toISOString().slice(0, 10)})`,
      );
    }
  }

  console.log(
    `\n[seed] done: +${inserted} new, ~${updated} merged, ${skipped} unchanged`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
