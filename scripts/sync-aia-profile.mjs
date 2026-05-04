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

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

try {
  await page.goto(sourceUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.getByText("Tai Zhi", { exact: true }).waitFor({ state: "visible", timeout: 45000 });
  const visibleText = await page.locator("body").innerText({ timeout: 10000 });
  const cleanedText = normaliseWhitespace(visibleText);

  const email = cleanedText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? "taizhi.ngim@aiafa.com.sg";
  const masRepNo = cleanedText.match(/NTZ\d+/i)?.[0]?.toUpperCase() ?? "NTZ300093279";
  const aboutRaw = extractBetween(cleanedText, "About me", "MDRT");
  const role = cleanedText.includes("Financial Consultant") ? "Financial Consultant" : "AIAFA Financial Services Consultant";
  const badges = cleanedText.includes("MDRT") ? ["MDRT"] : [];

  const profile = {
    sourceUrl,
    syncedAt: new Date().toISOString(),
    name: "Tai Zhi",
    role,
    masRepNo,
    email,
    badges,
    about: normaliseWhitespace(aboutRaw || fallbackAbout).replace(/ Schedule your consultation with me now!?$/i, ""),
  };

  await mkdir("data", { recursive: true });
  await writeFile("data/aia-profile.json", `${JSON.stringify(profile, null, 2)}\n`);
} finally {
  await browser.close();
}
