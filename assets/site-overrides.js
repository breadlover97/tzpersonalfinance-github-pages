(function () {
  function unlockPageScroll() {
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", unlockPageScroll, { once: true });
  } else {
    unlockPageScroll();
  }

  window.addEventListener("load", unlockPageScroll, { once: true });
  window.setTimeout(unlockPageScroll, 500);
  window.setTimeout(unlockPageScroll, 1500);
})();
