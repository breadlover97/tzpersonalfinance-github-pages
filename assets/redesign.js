const tabLinks = Array.from(document.querySelectorAll("[data-tab-link]"));
const tabRail = document.querySelector(".tab-inner");
const revealTargets = [
  ".hero-copy",
  ".hero-card",
  ".profile-proof-card",
  ".section-heading",
  ".service-grid > *",
  ".offering-card",
  ".method-heading",
  ".process-card",
  ".testimonial-card",
  ".profile-panel",
  ".about-card",
].join(",");
const backToTop = document.querySelector(".back-to-top");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function setText(selector, value) {
  if (!value) return;
  document.querySelectorAll(selector).forEach((node) => {
    node.textContent = value;
  });
}

function formatSyncDate(value) {
  if (!value) return "Daily from AIA";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Daily from AIA";
  return `Updated ${date.toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}`;
}

function activateTab(id) {
  tabLinks.forEach((link) => {
    const isActive = link.getAttribute("href") === `#${id}`;
    const wasActive = link.classList.contains("is-active");
    link.classList.toggle("is-active", isActive);
    if (isActive) {
      if (!wasActive) pulseTab(link);
      link.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  });
  updateTabIndicator();
}

function pulseTab(link) {
  link.classList.remove("is-activating");
  window.requestAnimationFrame(() => {
    link.classList.add("is-activating");
    window.setTimeout(() => link.classList.remove("is-activating"), 380);
  });
}

function updateTabIndicator() {
  if (!tabRail) return;
  const active = tabRail.querySelector(".tab-link.is-active");
  const indicator = tabRail.querySelector(".tab-indicator");
  if (!active || !indicator) return;
  const inset = 12;
  tabRail.style.setProperty("--tab-indicator-x", `${active.offsetLeft + inset}px`);
  tabRail.style.setProperty("--tab-indicator-width", `${Math.max(active.offsetWidth - inset * 2, 18)}px`);
  tabRail.style.setProperty("--tab-indicator-opacity", "1");
}

function setupSectionTabs() {
  if (!tabLinks.length) return;
  if (tabRail && !tabRail.querySelector(".tab-indicator")) {
    const indicator = document.createElement("span");
    indicator.className = "tab-indicator";
    indicator.setAttribute("aria-hidden", "true");
    tabRail.append(indicator);
  }
  const sections = tabLinks
    .map((link) => ({
      link,
      section: document.querySelector(link.getAttribute("href")),
    }))
    .filter((item) => item.section);
  let ticking = false;
  let hashLockUntil = 0;

  const updateFromScroll = () => {
    if (Date.now() < hashLockUntil) {
      ticking = false;
      return;
    }
    const marker = window.scrollY + Number.parseInt(getComputedStyle(document.documentElement).getPropertyValue("--header-height"), 10) + Number.parseInt(getComputedStyle(document.documentElement).getPropertyValue("--tabs-height"), 10) + 48;
    const active = sections.reduce((current, item) => {
      return item.section.offsetTop <= marker ? item : current;
    }, sections[0]);
    if (active?.section?.id) activateTab(active.section.id);
    ticking = false;
  };

  const requestUpdate = () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(updateFromScroll);
  };

  tabLinks.forEach((link) => {
    link.addEventListener("click", () => pulseTab(link));
  });

  const syncHashTab = () => {
    const id = window.location.hash.slice(1);
    if (id && tabLinks.some((link) => link.getAttribute("href") === `#${id}`)) {
      hashLockUntil = Date.now() + 520;
      activateTab(id);
      window.setTimeout(() => activateTab(id), 240);
    }
  };
  syncHashTab();
  if (window.location.hash) {
    window.setTimeout(requestUpdate, 560);
  } else {
    requestUpdate();
  }
  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", () => {
    requestUpdate();
    updateTabIndicator();
  });
  tabRail?.addEventListener("scroll", updateTabIndicator, { passive: true });
  window.addEventListener("hashchange", syncHashTab);
  updateTabIndicator();
}

function setupRevealMotion() {
  const targets = Array.from(document.querySelectorAll(revealTargets));
  targets.forEach((target, index) => {
    target.classList.add("reveal");
    target.style.setProperty("--reveal-delay", `${Math.min(index % 4, 3) * 55}ms`);
  });

  if (!("IntersectionObserver" in window)) {
    targets.forEach((target) => target.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        entry.target.classList.toggle("is-visible", entry.isIntersecting);
      });
    },
    { rootMargin: "-8% 0px -8% 0px", threshold: 0.01 },
  );

  targets.forEach((target) => observer.observe(target));
}

function setupOfferingDropdowns() {
  document.querySelectorAll(".offering-card").forEach((card) => {
    const trigger = card.querySelector(".offering-trigger");
    if (!trigger) return;
    trigger.addEventListener("click", () => {
      const isOpen = card.classList.toggle("is-open");
      trigger.setAttribute("aria-expanded", String(isOpen));
    });
  });
}

function setupBackToTop() {
  if (!backToTop) return;
  const update = () => {
    backToTop.classList.toggle("is-visible", window.scrollY > 520);
  };
  update();
  window.addEventListener("scroll", update, { passive: true });
}

function parseMetricValue(text) {
  const match = text.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const rawNumber = match[0];
  return {
    prefix: text.slice(0, match.index),
    number: Number(rawNumber),
    suffix: text.slice(match.index + rawNumber.length),
    decimals: rawNumber.includes(".") ? rawNumber.split(".")[1].length : 0,
    final: text,
  };
}

function formatMetricValue(metric, value) {
  const formatted = value.toLocaleString("en-SG", {
    minimumFractionDigits: metric.decimals,
    maximumFractionDigits: metric.decimals,
  });
  return `${metric.prefix}${formatted}${metric.suffix}`;
}

function animateMetricValue(node, metric) {
  if (node.dataset.counted === "true") return;
  node.dataset.counted = "true";

  if (prefersReducedMotion.matches) {
    node.textContent = metric.final;
    return;
  }

  const duration = 920;
  const start = performance.now();
  const easeOut = (progress) => 1 - Math.pow(1 - progress, 3);
  const tick = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    node.textContent = formatMetricValue(metric, metric.number * easeOut(progress));
    if (progress < 1) {
      window.requestAnimationFrame(tick);
    } else {
      node.textContent = metric.final;
    }
  };
  node.textContent = formatMetricValue(metric, 0);
  window.requestAnimationFrame(tick);
}

function setupStatCounters(root = document) {
  const values = Array.from(root.querySelectorAll(".stat-card strong"));
  if (!values.length) return;
  values.forEach((node) => {
    const finalText = node.dataset.countFinal || node.textContent.trim();
    const metric = parseMetricValue(finalText);
    node.dataset.countFinal = finalText;
    if (!metric) return;
    node.textContent = finalText;
  });

  if (!("IntersectionObserver" in window)) {
    values.forEach((node) => {
      const metric = parseMetricValue(node.dataset.countFinal || node.textContent.trim());
      if (metric) animateMetricValue(node, metric);
    });
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const metric = parseMetricValue(entry.target.dataset.countFinal || entry.target.textContent.trim());
        if (metric) animateMetricValue(entry.target, metric);
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.34 },
  );

  values.forEach((node) => observer.observe(node));
}

function setupProcessMotion() {
  const cards = Array.from(document.querySelectorAll(".process-card"));
  if (!cards.length) return;

  if (!("IntersectionObserver" in window) || prefersReducedMotion.matches) {
    cards[0].classList.add("is-current");
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        entry.target.classList.toggle("is-current", entry.isIntersecting && entry.intersectionRatio > 0.56);
      });
    },
    { rootMargin: "-18% 0px -22% 0px", threshold: [0.2, 0.56, 0.82] },
  );

  cards.forEach((card) => observer.observe(card));
}

function getStatType(label = "") {
  if (label.startsWith("Sum assured")) return "coverage";
  if (label.startsWith("Claims")) return "claims";
  return "relationship";
}

function getStatKicker(label = "") {
  if (label.startsWith("Sum assured")) return "Protection value";
  if (label.includes("policies")) return "Policies";
  if (label.startsWith("Claims")) return "Claims";
  return "Client base";
}

function renderProfileStats(stats = []) {
  const container = document.querySelector("[data-aia-stats]");
  if (!container || !stats.length) return;
  const sortOrder = [
    "Total clients",
    "Total policies",
    "Claims approved",
    "Claims value",
    "Sum assured (Death)",
    "Sum assured (Total permanent disability)",
    "Sum assured (Critical illness)",
  ];
  const orderedStats = [...stats].sort(
    (a, b) => sortOrder.indexOf(a.label) - sortOrder.indexOf(b.label),
  );
  const nodes = orderedStats.map((item) => {
    const stat = document.createElement("article");
    const kicker = document.createElement("em");
    const value = document.createElement("strong");
    const label = document.createElement("span");
    stat.className = `stat-card is-${getStatType(item.label)}`;
    kicker.textContent = getStatKicker(item.label);
    value.textContent = item.value;
    label.textContent = item.label;
    stat.append(kicker, value, label);
    return stat;
  });
  container.replaceChildren(...nodes);
  setupStatCounters(container);
}

function renderAchievements(achievements = []) {
  const container = document.querySelector("[data-aia-achievements]");
  if (!container || !achievements.length) return;
  const nodes = achievements.map((item) => {
    const article = document.createElement("article");
    const copy = document.createElement("div");
    const name = document.createElement("h3");
    const achieved = document.createElement("p");
    name.textContent = item.name;
    achieved.textContent = item.lastAchieved ?? "";
    copy.append(name, achieved);
    article.append(copy);
    if (item.frequency) {
      const frequency = document.createElement("span");
      frequency.textContent = item.frequency;
      article.append(frequency);
    }
    return article;
  });
  container.replaceChildren(...nodes);
}

async function hydrateAiaProfile() {
  try {
    const response = await fetch("data/aia-profile.json", { cache: "no-store" });
    if (!response.ok) return;
    const profile = await response.json();
    setText("[data-aia-name]", profile.name);
    setText("[data-aia-role]", profile.role);
    setText("[data-aia-synced]", formatSyncDate(profile.syncedAt));
    renderProfileStats(profile.stats);
    renderAchievements(profile.achievements);

    if (profile.email) {
      document.querySelectorAll("[data-aia-email]").forEach((node) => {
        node.textContent = profile.email;
        node.setAttribute("href", `mailto:${profile.email}`);
      });
      document.querySelectorAll("[data-aia-email-link]").forEach((node) => {
        node.setAttribute("href", `mailto:${profile.email}`);
      });
    }
  } catch {
    // The baked-in HTML copy remains visible if the profile sync cannot load.
  }
}

setupSectionTabs();
setupRevealMotion();
setupOfferingDropdowns();
setupBackToTop();
setupStatCounters();
setupProcessMotion();
hydrateAiaProfile();
