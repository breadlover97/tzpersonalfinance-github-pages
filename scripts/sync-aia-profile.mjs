import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const sourceUrl = "https://www.aia.com.sg/en/agent-profile?cd=011&q=xc30d040903027e3aa989713403fb74d23d01ea5ded1381c48278f7943a4037b4d7827c48d038cf7a2e228e761c1370c6a0d27c20cdddf482da065c3886e3b2bc9e1ad74a409c158d772cff60ab97&utm_source=ig&utm_medium=social&utm_content=link_in_bio";
const fallbackAbout = "I focus on helping individuals and families make confident, informed decisions across insurance solutions, investment planning, retirement readiness and estate distribution strategies.";

function extractBetween(text, start, end) {
  const startIndex = text.indexOf(start);
  if (startIndex === -1) return "";
  const sliced = text.slice(startIndex + start.length);
  const endIndex = sliced.indexOf(end);
  return (endIndex === -1 ? sliced : sliced.slice(0, endIndex)).trim();
}

function normaliseWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}

function extractStat(text, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`([^ ](?:.*?)) ${escaped}(?= \\d| SGD | Achievements|$)`, "i");
  return normaliseWhitespace(text.match(pattern)?.[1] ?? "");
}

function extractAchievement(text, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`${escaped} (Last achieved in \\d{4})(?: (\\d+-time achiever))?`, "i");
  const match = text.match(pattern);
  if (!match) return null;
  return {
    name,
    lastAchieved: match[1],
    ...(match[2] ? { frequency: match[2] } : {}),
  };
}

async function openProfilePage() {
  const attempts = [
    { label: "default", args: [], waitUntil: "domcontentloaded", gotoTimeout: 45000 },
    { label: "http1-fallback", args: ["--disable-http2"], waitUntil: "commit", gotoTimeout: 20000 },
  ];
  let lastError;

  for (const attempt of attempts) {
    const browser = await chromium.launch({ headless: true, args: attempt.args });
    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      locale: "en-SG",
    });
    await page.setExtraHTTPHeaders({ "accept-language": "en-SG,en;q=0.9" });

    try {
      try {
        await page.goto(sourceUrl, { waitUntil: attempt.waitUntil, timeout: attempt.gotoTimeout });
      } catch (error) {
        lastError = error;
        console.warn(`AIA profile navigation warning on ${attempt.label}: ${error.message}`);
      }
      await page.getByText("Tai Zhi", { exact: true }).waitFor({ state: "visible", timeout: 30000 });
      return { browser, page };
    } catch (error) {
      lastError = error;
      console.warn(`AIA profile load failed on ${attempt.label}: ${error.message}`);
      await browser.close();
    }
  }

  throw lastError;
}

let browser;
let page;

try {
  ({ browser, page } = await openProfilePage());
} catch (error) {
  console.warn(`Unable to load AIA profile; leaving existing data unchanged. ${error.message}`);
  process.exit(0);
}

try {
  const visibleText = await page.locator("body").innerText({ timeout: 10000 });
  const cleanedText = normaliseWhitespace(visibleText);

  const email = cleanedText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? "taizhi.ngim@aiafa.com.sg";
  const masRepNo = cleanedText.match(/NTZ\d+/i)?.[0]?.toUpperCase() ?? "NTZ300093279";
  const fscCode = cleanedText.match(/FSC code\s+(\d+)/i)?.[1] ?? "24206";
  const phone = cleanedText.match(/phone\s+"?(\d{8})"?/i)?.[1] ?? "97721028";
  const organisation = cleanedText.match(/Financial Consultant\s+(.+?)\s+Rep No\./i)?.[1] ?? "PEARLYN-AWM KOH POO KWEE ORG";
  const aboutRaw = extractBetween(cleanedText, "About me", "MDRT");
  const role = cleanedText.includes("Financial Consultant") ? "Financial Consultant" : "AIAFA Financial Services Consultant";
  const badges = cleanedText.includes("MDRT") ? ["MDRT"] : [];
  const statLabels = [
    "Total clients",
    "Total policies",
    "Sum assured (Death)",
    "Sum assured (Total permanent disability)",
    "Sum assured (Critical illness)",
    "Claims approved",
    "Claims value",
  ];
  const stats = statLabels
    .map((label) => ({ value: extractStat(cleanedText, label), label }))
    .filter((item) => item.value);
  const achievements = [
    "MDRT",
    "PRESTIGE TITANIUM",
    "CAREER AGENT BENEFIT",
    "CENTURION",
    "CONVENTION",
  ]
    .map((name) => extractAchievement(cleanedText, name))
    .filter(Boolean);

  const profile = {
    sourceUrl,
    syncedAt: new Date().toISOString(),
    name: "Tai Zhi",
    role,
    organisation,
    masRepNo,
    fscCode,
    email,
    phone,
    badges,
    stats,
    achievements,
    about: normaliseWhitespace(aboutRaw || fallbackAbout).replace(/ Schedule your consultation with me now!?$/i, ""),
  };

  await mkdir("data", { recursive: true });
  await writeFile("data/aia-profile.json", `${JSON.stringify(profile, null, 2)}\n`);
} finally {
  await browser.close();
}
