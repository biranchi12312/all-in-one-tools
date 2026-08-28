(function () {
  "use strict";

  function normalizePath(pathname) {
    let path = pathname || "/";
    if (!path.startsWith("/")) path = "/" + path;
    if (path !== "/" && !path.endsWith("/")) path += "/";
    return path.replace(/\/+/g, "/");
  }

  function createRouter(options) {
    const routes = new Map();
    const getView = options.getView;
    const renderRoute = options.renderRoute;
    const onBlocked = options.onBlocked || function () {};
    const onUnknown = options.onUnknown || function () {};
    const canLeave = options.canLeave || function () { return true; };
    const defaultRoute = options.defaultRoute || "dashboard";
    let currentRoute = defaultRoute;

    function register(route) {
      if (!route || !route.id) throw new Error("[AuraRouter] Route id is required.");
      const normalized = Object.assign({ type: "public", lifecycle: {}, path: null, legacyHashes: [] }, route);
      if (normalized.path) normalized.path = normalizePath(normalized.path);
      routes.set(normalized.id, normalized);
      return api;
    }

    function resolve(routeId) { return routes.get(routeId) || null; }

    function resolvePath(pathname) {
      const path = normalizePath(pathname);

      // Local dev servers commonly open the SPA shell as /index.html.
      // Treat the application shell itself as the dashboard instead of
      // classifying it as an unknown SEO route.
      if (path === "/index.html/") return defaultRoute;

      for (const route of routes.values()) {
        if (route.path && route.path === path) return route.id;
      }
      return null;
    }

    function resolveLegacyHash(hash) {
      const raw = String(hash || "").replace(/^#/, "");
      if (!raw) return null;
      if (resolve(raw)) return raw;
      for (const route of routes.values()) {
        if ((route.legacyHashes || []).includes(raw)) return route.id;
      }
      return null;
    }

    function getRouteFromLocation() {
      const byPath = resolvePath(window.location.pathname);
      if (byPath) return byPath;
      const byHash = resolveLegacyHash(window.location.hash);
      if (byHash) return byHash;
      const normalizedPath = normalizePath(window.location.pathname);
      return (normalizedPath === "/" || normalizedPath === "/index.html/") ? defaultRoute : null;
    }

    function getUrl(routeId) {
      const route = resolve(routeId);
      if (!route) return window.location.pathname + window.location.search;
      return route.path || (routeId === defaultRoute ? "/" : window.location.pathname);
    }

    function processingActive() {
      const managerActive = !!(window.AuraProcessingManager && window.AuraProcessingManager.isActive && window.AuraProcessingManager.isActive());
      return managerActive || window.__auraProcessing === true;
    }

    function runHook(routeId, hookName, context) {
      const route = resolve(routeId);
      const hook = route && route.lifecycle && route.lifecycle[hookName];
      if (typeof hook !== "function") return true;
      return hook(context) !== false;
    }

    function renderAndApply(routeId, target, context) {
      renderRoute(routeId, target);
      currentRoute = routeId;
      if (window.AuraSEO && typeof window.AuraSEO.apply === "function") window.AuraSEO.apply(routeId);
      runHook(routeId, "enter", context || { from: null, to: routeId });
    }

    function navigate(routeId, options) {
      const opts = Object.assign({ history: "push", source: "ui" }, options || {});
      const target = resolve(routeId);
      if (!target) { onUnknown(routeId, opts); return false; }

      if (routeId === currentRoute) {
        if (opts.history === "replace") history.replaceState({ view: routeId }, "", getUrl(routeId));
        return true;
      }

      if (processingActive() || !canLeave(currentRoute, routeId, opts)) {
        onBlocked({ from: currentRoute, to: routeId, source: opts.source });
        return false;
      }
      if (!runHook(currentRoute, "beforeLeave", { from: currentRoute, to: routeId })) return false;
      if (!runHook(routeId, "beforeEnter", { from: currentRoute, to: routeId })) return false;

      runHook(currentRoute, "leave", { from: currentRoute, to: routeId });
      renderAndApply(routeId, target, { from: currentRoute, to: routeId });

      if (opts.history === "push") history.pushState({ view: routeId }, "", getUrl(routeId));
      else if (opts.history === "replace") history.replaceState({ view: routeId }, "", getUrl(routeId));
      return true;
    }

    function init() {
      const initial = getRouteFromLocation();
      const legacyHash = window.location.hash;
      if (!initial) {
        onUnknown(normalizePath(window.location.pathname), { source: "initial" });
        if (resolve("notFound")) {
          currentRoute = "notFound";
          renderAndApply("notFound", resolve("notFound"));
        } else navigate(defaultRoute, { history: "replace", source: "initial" });
      } else {
        currentRoute = initial;
        renderAndApply(initial, resolve(initial));
        const canonicalUrl = getUrl(initial);
        history.replaceState({ view: initial }, "", canonicalUrl);
        if (legacyHash) history.replaceState({ view: initial }, "", canonicalUrl);
      }

      window.addEventListener("popstate", function (event) {
        const target = event.state && event.state.view ? event.state.view : getRouteFromLocation();
        if (!target || !resolve(target)) { onUnknown(normalizePath(window.location.pathname), { source: "popstate" }); return; }
        if (!navigate(target, { history: "none", source: "popstate" })) history.replaceState({ view: currentRoute }, "", getUrl(currentRoute));
      });

      window.addEventListener("hashchange", function () {
        const target = resolveLegacyHash(window.location.hash);
        if (!target) return;
        navigate(target, { history: "replace", source: "legacy-hash" });
      });
    }

    const api = { register, resolve, navigate, init, getCurrentRoute: () => currentRoute, getRouteFromLocation, getUrl, resolvePath, isKnownRoute: id => !!resolve(id) };
    return api;
  }

  window.AuraRouter = Object.freeze({ createRouter });
})();
