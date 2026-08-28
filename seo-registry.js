(function () {
  "use strict";

  const SITE_URL = "https://aurastudiofiles.vercel.app";
  const DEFAULT = Object.freeze({
    id: "dashboard",
    path: "/",
    title: "AuraStudio — Free Image & PDF Tools",
    description: "Compress and convert images, merge PDFs and manage everyday files with AuraStudio. Complete supported tasks in a clean, focused workspace.",
    robots: "index,follow"
  });

  const PUBLIC = Object.freeze({
    tools: { path: "/tools/", title: "All Tools | AuraStudio", description: "Browse every AuraStudio image and PDF tool from one place.", robots: "index,follow" },
    help: { path: "/help/", title: "Help Center | AuraStudio", description: "Find quick guidance for AuraStudio tools and common workflows.", robots: "index,follow" },
    about: { path: "/about/", title: "About AuraStudio | Image & PDF Tools", description: "Learn about AuraStudio and its focused workspace for everyday image and PDF tasks.", robots: "index,follow" },
    contact: { path: "/contact/", title: "Contact AuraStudio", description: "Find guidance for feedback, bug reports and general AuraStudio questions.", robots: "index,follow" },
    privacy: { path: "/privacy/", title: "Privacy | AuraStudio", description: "Read how AuraStudio handles files, service information and third-party resources.", robots: "index,follow" },
    terms: { path: "/terms/", title: "Terms | AuraStudio", description: "Read the rules and limitations that apply when using AuraStudio tools and services.", robots: "index,follow" }
  });

  function absolute(path) {
    return SITE_URL + (path === "/" ? "/" : path.replace(/\/$/, "") + "/");
  }

  function get(routeId) {
    if (routeId === "dashboard") return DEFAULT;
    if (PUBLIC[routeId]) return Object.assign({ id: routeId }, PUBLIC[routeId]);
    const registry = window.AuraToolRegistry;
    const tool = registry && typeof registry.getByRoute === "function" ? registry.getByRoute(routeId) : null;
    if (tool && tool.seoPath && tool.seo) {
      return {
        id: routeId,
        path: tool.seoPath,
        title: tool.seo.title,
        description: tool.seo.description,
        robots: "index,follow"
      };
    }
    return { id: "notFound", path: null, title: "Page Not Found | AuraStudio", description: "The page you requested is not available.", robots: "noindex,follow" };
  }

  function ensureMeta(name) {
    let node = document.head.querySelector(`meta[name="${name}"]`);
    if (!node) { node = document.createElement("meta"); node.name = name; document.head.appendChild(node); }
    return node;
  }

  function ensureProperty(property) {
    let node = document.head.querySelector(`meta[property="${property}"]`);
    if (!node) { node = document.createElement("meta"); node.setAttribute("property", property); document.head.appendChild(node); }
    return node;
  }

  function ensureCanonical() {
    let node = document.head.querySelector('link[rel="canonical"]');
    if (!node) { node = document.createElement("link"); node.rel = "canonical"; document.head.appendChild(node); }
    return node;
  }

  function apply(routeId) {
    const meta = get(routeId);
    const url = meta.path ? absolute(meta.path) : SITE_URL + window.location.pathname;
    document.title = meta.title;
    ensureMeta("description").content = meta.description;
    ensureMeta("robots").content = meta.robots;
    ensureCanonical().href = url;
    ensureProperty("og:title").content = meta.title;
    ensureProperty("og:description").content = meta.description;
    ensureProperty("og:url").content = url;
    ensureProperty("og:type").content = "website";
    return meta;
  }

  function getPath(routeId) { return get(routeId).path; }

  window.AuraSEO = Object.freeze({ SITE_URL, get, getPath, apply, absolute });
})();
