(() => {
    "use strict";

    document.documentElement.classList.add("js-ready");

    const views = {
        dashboard: document.getElementById("dashboardView"),
        compressor: document.getElementById("compressorView"),
        converter: document.getElementById("converterView"),
        pdfMerge: document.getElementById("pdfMergeView"),
        pdfToImages: document.getElementById("pdfToImagesView")
    };

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

        window.scrollTo({ top: 0, behavior: "smooth" });

        if (viewName === "dashboard") {
            requestAnimationFrame(() => initScrollAnimations());
        }

        window.dispatchEvent(
            new CustomEvent("aurastudio:viewchange", {
                detail: { view: viewName }
            })
        );
    }

    function switchView(viewName, pushHistory = true) {
        if (!views[viewName]) return;
        setToolsMenu(false);
        renderView(viewName);

        if (!pushHistory) return;

        const currentState = history.state;
        if (!currentState || currentState.view !== viewName) {
            history.pushState(
                { view: viewName },
                "",
                viewName === "dashboard"
                    ? location.pathname + location.search
                    : `#${viewName}`
            );
        }
    }

    function getViewFromHash() {
        const hash = window.location.hash.replace("#", "");
        if (
            hash === "dashboard" ||
            hash === "compressor" ||
            hash === "converter" ||
            hash === "pdfMerge" ||
            hash === "pdfToImages"
        ) {
            return hash;
        }
        return "dashboard";
    }

    function backToDashboard() {
        // Always stay inside the app. Never history.back() here —
        // deep-links (#compressor etc.) may have no prior dashboard
        // entry, and history.back() would exit the site.
        setToolsMenu(false);
        if (getViewFromHash() === "dashboard") {
            renderView("dashboard");
            return;
        }
        renderView("dashboard");
        try {
            history.pushState(
                { view: "dashboard" },
                "",
                location.pathname + location.search
            );
        } catch (_) {
            try {
                history.replaceState(
                    { view: "dashboard" },
                    "",
                    location.pathname + location.search
                );
            } catch (__) {}
        }
    }

    // ---- Routing init ----
    const initialView = getViewFromHash();
    try {
        history.replaceState(
            { view: initialView },
            "",
            initialView === "dashboard"
                ? location.pathname + location.search
                : `#${initialView}`
        );
    } catch (_) {}
    renderView(initialView);

    window.addEventListener("popstate", event => {
        renderView(event.state?.view || getViewFromHash());
    });

    // ---- Preview toast ----
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

    // ---- Direct listeners (most reliable on mobile) ----
    document.querySelectorAll("[data-open-view]").forEach(button => {
        button.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
            const viewName = button.getAttribute("data-open-view");
            if (viewName) switchView(viewName);
        });
    });

    document.querySelectorAll("[data-back-dashboard]").forEach(button => {
        button.addEventListener("click", event => {
            event.preventDefault();
            backToDashboard();
        });
    });

    document.getElementById("logoBtn")?.addEventListener("click", event => {
        event.preventDefault();
        if (getViewFromHash() === "dashboard") {
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

    // FAQ accordion
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

    // ---- Soft scroll reveal (below-fold only, ~0.25s) ----
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

        // Above fold: show immediately, no pending state
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
        setToolsMenu
    };


    // Soft zoom lock for iOS Safari gesture events (viewport already sets user-scalable=no)
    (function lockPageZoom() {
        const stop = event => event.preventDefault();
        ["gesturestart", "gesturechange", "gestureend"].forEach(type => {
            document.addEventListener(type, stop, { passive: false });
        });
    })();

})();