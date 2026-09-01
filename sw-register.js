/**
 * Centralized Service Worker registration.
 *
 * The registration URL is derived from this module's own URL instead of the
 * current document URL. That keeps the same root-level worker path on root
 * pages and nested routes such as /guides/, /image-tools/ and /pdf-tools/.
 */
const ROOT_URL = new URL("../../../", import.meta.url);
const WORKER_URL = new URL("sw.js?v=62.3-resize-quality-fix", ROOT_URL);
const WORKER_SCOPE = ROOT_URL.pathname;

function canRegisterServiceWorker() {
  return "serviceWorker" in navigator &&
    (location.protocol === "https:" || location.hostname === "localhost");
}

async function removeLegacyNestedRegistrations() {
  const registrations = await navigator.serviceWorker.getRegistrations();
  const canonicalWorker = WORKER_URL.href;

  await Promise.all(registrations.map(async registration => {
    const scriptURL = registration.active?.scriptURL ||
      registration.waiting?.scriptURL ||
      registration.installing?.scriptURL || "";

    // Only clean up registrations created by older nested-path attempts.
    const isLegacyNestedWorker = /\/(guides|image-tools|pdf-tools)\/sw\.js(?:\?|$)/.test(scriptURL);
    if (isLegacyNestedWorker && scriptURL !== canonicalWorker) {
      await registration.unregister();
    }
  }));
}

async function registerServiceWorker() {
  if (!canRegisterServiceWorker()) return;

  try {
    await removeLegacyNestedRegistrations();
    const registration = await navigator.serviceWorker.register(WORKER_URL.href, {
      scope: WORKER_SCOPE,
      updateViaCache: "none"
    });

    // Ask an existing worker to check immediately so a deployment cannot leave
    // HTML, CSS and module files on different cached revisions.
    await registration.update();
  } catch (error) {
    // Do not make a Service Worker failure break the page itself.
    console.warn("Service worker registration skipped:", error);
  }
}

if (document.readyState === "loading") {
  window.addEventListener("load", registerServiceWorker, { once: true });
} else {
  registerServiceWorker();
}
