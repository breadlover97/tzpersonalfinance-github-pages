const tabLinks = Array.from(document.querySelectorAll("[data-tab-link]"));
const revealTargets = [
  ".hero-copy",
  ".hero-card",
  ".trust-band > *",
  ".section-heading",
  ".intro-copy",
  ".service-grid > *",
  ".offering-card",
  ".method-heading",
  ".method-list > *",
  ".testimonial-grid > *",
  ".profile-panel",
  ".about-card",
].join(",");

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
}

function pulseTab(link) {
  link.classList.remove("is-activating");
  window.requestAnimationFrame(() => {
    link.classList.add("is-activating");
    window.setTimeout(() => link.classList.remove("is-activating"), 380);
  });
}

function setupSectionTabs() {
  if (!tabLinks.length || !("IntersectionObserver" in window)) return;
  const sections = tabLinks
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);

  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible?.target?.id) activateTab(visible.target.id);
    },
    {
      rootMargin: "-35% 0px -52% 0px",
      threshold: [0.08, 0.2, 0.45],
    },
  );

  sections.forEach((section) => observer.observe(section));

  tabLinks.forEach((link) => {
    link.addEventListener("click", () => pulseTab(link));
  });
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
    { rootMargin: "0px 0px -12% 0px", threshold: 0.14 },
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

async function hydrateAiaProfile() {
  try {
    const response = await fetch("data/aia-profile.json", { cache: "no-store" });
    if (!response.ok) return;
    const profile = await response.json();
    setText("[data-aia-name]", profile.name);
    setText("[data-aia-role]", profile.role);
    setText("[data-aia-badges]", profile.badges?.join(", "));
    setText("[data-aia-synced]", formatSyncDate(profile.syncedAt));

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
hydrateAiaProfile();
