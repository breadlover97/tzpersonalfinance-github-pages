const navToggle = document.querySelector("[data-nav-toggle]");
const navMenu = document.querySelector("[data-nav-menu]");

function closeMenu() {
  if (!navToggle || !navMenu) return;
  document.body.classList.remove("nav-open");
  navMenu.classList.remove("is-open");
  navToggle.setAttribute("aria-expanded", "false");
}

if (navToggle && navMenu) {
  navToggle.addEventListener("click", () => {
    const isOpen = navMenu.classList.toggle("is-open");
    document.body.classList.toggle("nav-open", isOpen);
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });

  navMenu.addEventListener("click", (event) => {
    if (event.target instanceof HTMLAnchorElement) {
      closeMenu();
    }
  });
}

window.addEventListener("resize", () => {
  if (window.innerWidth > 980) closeMenu();
});

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

async function hydrateAiaProfile() {
  try {
    const response = await fetch("data/aia-profile.json", { cache: "no-store" });
    if (!response.ok) return;
    const profile = await response.json();
    setText("[data-aia-name]", profile.name);
    setText("[data-aia-role]", profile.role);
    setText("[data-aia-rep]", profile.masRepNo);
    setText("[data-aia-badges]", profile.badges?.join(", "));
    setText("[data-aia-about]", profile.about);
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

hydrateAiaProfile();
