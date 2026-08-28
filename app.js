(() => {
    "use strict";

    document.documentElement.classList.add("js-ready");

    const views = {
        dashboard: document.getElementById("dashboardView"),
        compressor: document.getElementById("compressorView"),
        resize: document.getElementById("resizeView"),
        cropRotate: document.getElementById("cropRotateView"),
        converter: document.getElementById("converterView"),
        pdfMerge: document.getElementById("pdfMergeView"),
        pdfToImages: document.getElementById("pdfToImagesView"),
        imagesToPdf: document.getElementById("imagesToPdfView"),
        pdfSplit: document.getElementById("pdfSplitView")
    };

    const mainHost = document.querySelector("main.container");
    if (!window.AuraPublicViews || typeof window.AuraPublicViews.mount !== "function") {
        throw new Error("[AuraStudio] Public Views foundation failed to load.");
    }
    Object.assign(views, window.AuraPublicViews.mount(mainHost));

    function showProcessingWarning() {
        const ui = window.AuraDialog;
        if (ui) {
            ui.warning(
                "Please wait",
                "A file is still processing. Finish or wait for it to complete before leaving this tool."
            );
        }
    }

    function setToolsMenu(open) {
        if (typeof window.__auraSetMenu === "function") {
            window.__auraSetMenu(!!open);
            return;
        }
        const toggle = document.getElementById("menuToggle");
        const menu = document.getElementById("toolsMenu");
        const backdrop = document.getElementById("menuBackdrop");
        if (!toggle || !menu) return;
        menu.classList.toggle("open", !!open);
        toggle.classList.toggle("active", !!open);
        backdrop?.classList.toggle("open", !!open);
        document.body.classList.toggle("menu-open", !!open);
        toggle.setAttribute("aria-expanded", String(!!open));
        menu.setAttribute("aria-hidden", String(!open));
    }

    function renderView(viewName) {
        Object.keys(views).forEach(key => {
            const view = views[key];
            if (!view) return;
            view.classList.toggle("active", key === viewName);
        });

        document.querySelector(".navbar")?.classList.toggle(
            "is-dashboard",
            viewName === "dashboard"
        );

        // Keep a lightweight route context on <body> so shared UI layers can
        // style public/tool states without duplicating route-specific markup.
        document.body.dataset.activeView = viewName;

        window.scrollTo(0, 0);

        if (viewName === "dashboard") {
            requestAnimationFrame(() => initScrollAnimations());
        }

        window.dispatchEvent(
            new CustomEvent("aurastudio:viewchange", {
                detail: { view: viewName }
            })
        );
    }

    if (!window.AuraRouter || typeof window.AuraRouter.createRouter !== "function") {
        throw new Error("[AuraStudio] Router foundation failed to load.");
    }

    const router = window.AuraRouter.createRouter({
        defaultRoute: "dashboard",
        getView: viewName => views[viewName],
        renderRoute: viewName => renderView(viewName),
        onBlocked: showProcessingWarning,
        onUnknown: () => {
            router.navigate("notFound", {
                history: "replace",
                source: "unknown-route"
            });
        }
    });

    // Register the stable dashboard separately, then derive all tool routes
    // from the central metadata registry. This keeps route/view metadata in one place.
    router.register({
        id: "dashboard",
        type: "public",
        path: "/",
        viewId: views.dashboard ? views.dashboard.id : null,
        lifecycle: {}
    });

    window.AuraPublicViews.getDefinitions().forEach(view => {
        router.register({
            id: view.id,
            type: view.id === "notFound" ? "recovery" : "public",
            path: view.path || null,
            viewId: views[view.id] ? views[view.id].id : null,
            lifecycle: {}
        });
    });

    const toolRegistry = window.AuraToolRegistry;

    if (!toolRegistry || typeof toolRegistry.getAll !== "function") {
        throw new Error("[AuraStudio] Tool Registry failed to load.");
    }

    toolRegistry.getAll().forEach(tool => {
        if (!views[tool.route]) {
            console.warn(`[AuraStudio] Registered tool view not found: ${tool.route}`);
            return;
        }

        router.register({
            id: tool.route,
            type: "tool",
            viewId: tool.viewId,
            metadata: tool,
            path: tool.seoPath || null,
            legacyHashes: [tool.route],
            lifecycle: {}
        });
    });

    function switchView(viewName, pushHistory = true) {
        setToolsMenu(false);
        return router.navigate(viewName, {
            history: pushHistory ? "push" : "none",
            source: "ui"
        });
    }

    function getViewFromHash() {
        return router.getRouteFromLocation() || "dashboard";
    }

    function backToDashboard() {
        setToolsMenu(false);
        return router.navigate("dashboard", {
            history: "push",
            source: "back-control"
        });
    }

    // Initialize routing before wiring click interception.
    router.init();

    // Navigation uses real clean-path anchors as the primary mechanism.
    // This avoids a second click-routing layer competing with deep-link routing.
    window.__auraNavigateToView = function (viewName) {
        return switchView(viewName);
    };

    const previewFeatureToast = document.getElementById("previewFeatureToast");
    let previewFeatureToastTimer;

    function showPreviewFeatureNotice() {
        if (!previewFeatureToast) return;
        clearTimeout(previewFeatureToastTimer);
        previewFeatureToast.hidden = false;
        previewFeatureToast.classList.remove("is-visible");
        requestAnimationFrame(() => {
            previewFeatureToast.classList.add("is-visible");
        });
        previewFeatureToastTimer = setTimeout(() => {
            previewFeatureToast.classList.remove("is-visible");
            setTimeout(() => {
                if (!previewFeatureToast.classList.contains("is-visible")) {
                    previewFeatureToast.hidden = true;
                }
            }, 220);
        }, 2600);
    }

    // Intercept only AuraStudio's own route anchors. This keeps clean hrefs
    // crawlable and usable without JavaScript, while preventing a plain local
    // static server from trying to fetch /tools/... as physical folders.
    document.addEventListener("click", event => {
        if (event.defaultPrevented || event.button !== 0) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

        const target = event.target instanceof Element ? event.target : null;
        const anchor = target && target.closest("a[data-open-view]");
        if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;

        const viewName = anchor.dataset.openView;
        if (!viewName || !router.isKnownRoute(viewName)) return;

        // Only intercept same-origin route links. External links retain normal
        // browser behaviour even if a future template accidentally adds data-open-view.
        let url;
        try {
            url = new URL(anchor.href, window.location.href);
        } catch (_) {
            return;
        }
        if (url.origin !== window.location.origin) return;

        event.preventDefault();
        switchView(viewName, true);
    });

    document.querySelectorAll("[data-back-dashboard]").forEach(button => {
        button.addEventListener("click", event => {
            event.preventDefault();
            backToDashboard();
        });
    });

    document.getElementById("logoBtn")?.addEventListener("click", event => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        if (router.getCurrentRoute() === "dashboard") {
            renderView("dashboard");
            setToolsMenu(false);
            return;
        }
        backToDashboard();
    });

    document.querySelectorAll("[data-open-menu]").forEach(button => {
        button.addEventListener("click", event => {
            event.preventDefault();
            setToolsMenu(true);
        });
    });

    document.querySelectorAll(".preview-feature").forEach(button => {
        button.addEventListener("click", event => {
            event.preventDefault();
            showPreviewFeatureNotice();
        });
    });

    document.querySelectorAll(".faq-question").forEach(button => {
        if (!button.hasAttribute("aria-expanded")) {
            button.setAttribute("aria-expanded", "false");
        }
        button.addEventListener("click", event => {
            event.preventDefault();
            const item = button.closest(".faq-item");
            const answer = button.nextElementSibling;
            if (!item || !answer) return;

            const isOpen = item.classList.contains("open");

            document.querySelectorAll(".faq-item").forEach(otherItem => {
                if (otherItem === item) return;
                otherItem.classList.remove("open");
                const otherBtn = otherItem.querySelector(".faq-question");
                if (otherBtn) otherBtn.setAttribute("aria-expanded", "false");
                const otherAnswer = otherItem.querySelector(".faq-answer");
                if (otherAnswer) otherAnswer.style.maxHeight = null;
            });

            if (isOpen) {
                item.classList.remove("open");
                button.setAttribute("aria-expanded", "false");
                answer.style.maxHeight = null;
            } else {
                item.classList.add("open");
                button.setAttribute("aria-expanded", "true");
                answer.style.maxHeight = `${answer.scrollHeight}px`;
            }
        });
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") setToolsMenu(false);
    });

    let revealObserver = null;

    function prefersReducedMotion() {
        return (
            window.matchMedia &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches
        );
    }

    function forceRevealVisible() {
        document.querySelectorAll(".reveal").forEach(el => {
            el.classList.remove("is-pending");
            el.classList.add("visible");
        });
    }

    function initScrollAnimations() {
        if (revealObserver) {
            revealObserver.disconnect();
            revealObserver = null;
        }

        const revealElements = Array.from(document.querySelectorAll(".reveal"));
        if (!revealElements.length) return;

        revealElements.forEach(el => {
            el.classList.remove("is-pending");
            const rect = el.getBoundingClientRect();
            if (rect.top < window.innerHeight * 0.95 && rect.bottom > 0) {
                el.classList.add("visible");
            }
        });

        if (prefersReducedMotion() || !("IntersectionObserver" in window)) {
            forceRevealVisible();
            return;
        }

        revealObserver = new IntersectionObserver(
            entries => {
                entries.forEach(entry => {
                    if (!entry.isIntersecting) return;
                    entry.target.classList.add("visible");
                    entry.target.classList.remove("is-pending");
                    revealObserver.unobserve(entry.target);
                });
            },
            {
                threshold: 0.08,
                rootMargin: "0px 0px -4% 0px"
            }
        );

        revealElements.forEach(el => {
            if (el.classList.contains("visible")) return;
            el.classList.add("is-pending");
            void el.offsetWidth;
            revealObserver.observe(el);
        });
    }

    initScrollAnimations();

    window.AuraStudio = {
        switchView,
        renderView,
        getViewFromHash,
        backToDashboard,
        setToolsMenu,
        router
    };

})();
