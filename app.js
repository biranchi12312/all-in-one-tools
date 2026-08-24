(() => {
    "use strict";

    document.documentElement.classList.add("js-ready");

    const views = {
        dashboard: document.getElementById("dashboardView"),
        compressor: document.getElementById("compressorView"),
        converter: document.getElementById("converterView"),
        pdfMerge: document.getElementById("pdfMergeView")
    };

    function getMenuEls() {
        return {
            toggle: document.getElementById("menuToggle"),
            menu: document.getElementById("toolsMenu"),
            close: document.getElementById("menuClose"),
            backdrop: document.getElementById("menuBackdrop"),
            categories: Array.from(document.querySelectorAll(".menu-category"))
        };
    }

    function openFirstMenuCategory() {
        const { categories } = getMenuEls();
        if (!categories.length) return;
        categories.forEach((category, index) => {
            const trigger = category.querySelector(".menu-category-trigger");
            const shouldOpen = index === 0;
            category.classList.toggle("open", shouldOpen);
            trigger?.setAttribute("aria-expanded", String(shouldOpen));
        });
    }

    function setToolsMenu(open) {
        if (typeof window.__auraSetMenu === "function") {
            window.__auraSetMenu(!!open);
            return;
        }
        const { toggle, menu, backdrop } = getMenuEls();
        if (!toggle || !menu) return;

        menu.classList.toggle("open", !!open);
        toggle.classList.toggle("active", !!open);
        backdrop?.classList.toggle("open", !!open);
        document.body.classList.toggle("menu-open", !!open);
        toggle.setAttribute("aria-expanded", String(!!open));
        menu.setAttribute("aria-hidden", String(!open));
        backdrop?.setAttribute("aria-hidden", String(!open));

        if (open) openFirstMenuCategory();
    }

    function toggleToolsMenu(event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        const { menu } = getMenuEls();
        if (!menu) return;
        setToolsMenu(!menu.classList.contains("open"));
    }

    function renderView(viewName) {
        Object.values(views).forEach(view => {
            if (view) view.classList.remove("active");
        });

        if (views[viewName]) {
            views[viewName].classList.add("active");
        }

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
            hash === "pdfMerge"
        ) {
            return hash;
        }
        return "dashboard";
    }

    function backToDashboard() {
        const currentView = getViewFromHash();
        if (currentView === "dashboard") {
            renderView("dashboard");
            return;
        }

        if (history.state?.view && history.state.view !== "dashboard") {
            history.back();
            return;
        }

        renderView("dashboard");
        history.replaceState(
            { view: "dashboard" },
            "",
            location.pathname + location.search
        );
    }

    const initialView = getViewFromHash();
    history.replaceState(
        { view: initialView },
        "",
        initialView === "dashboard"
            ? location.pathname + location.search
            : `#${initialView}`
    );
    renderView(initialView);

    window.addEventListener("popstate", event => {
        const viewName = event.state?.view || getViewFromHash();
        renderView(viewName);
    });

    // ---- Event delegation: reliable menu + navigation (works even if DOM moves) ----
    document.addEventListener(
        "click",
        event => {
            const target = event.target;
            if (!(target instanceof Element)) return;

            // Menu open/close/categories handled by inline bootstrap (__auraToggleMenu)
            // Keep setToolsMenu in sync for view switches

            // Open a view
            const openBtn = target.closest("[data-open-view]");
            if (openBtn) {
                const viewName = openBtn.getAttribute("data-open-view");
                if (viewName) {
                    event.preventDefault();
                    switchView(viewName);
                }
                return;
            }

            // Back to dashboard
            if (target.closest("[data-back-dashboard]")) {
                event.preventDefault();
                backToDashboard();
                return;
            }

            // Logo
            if (target.closest("#logoBtn")) {
                event.preventDefault();
                if (getViewFromHash() === "dashboard") {
                    renderView("dashboard");
                    setToolsMenu(false);
                } else {
                    backToDashboard();
                }
                return;
            }

            // Open menu shortcut buttons
            if (target.closest("[data-open-menu]")) {
                event.preventDefault();
                setToolsMenu(true);
                return;
            }

            // Preview-only features
            if (target.closest(".preview-feature")) {
                event.preventDefault();
                showPreviewFeatureNotice();
            }
        },
        false
    );

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") setToolsMenu(false);
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

    // ---- Scroll reveal (premium feel, only off-screen) ----
    let revealObserver = null;

    function prefersReducedMotion() {
        return (
            window.matchMedia &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches
        );
    }

    function forceRevealVisible() {
        document.querySelectorAll(".reveal").forEach(element => {
            element.classList.remove("is-pending");
            element.classList.add("visible");
        });
    }

    function initScrollAnimations() {
        if (revealObserver) {
            revealObserver.disconnect();
            revealObserver = null;
        }

        const revealElements = Array.from(document.querySelectorAll(".reveal"));
        if (!revealElements.length) return;

        // Above-the-fold: mark visible now so first paint is never blank
        revealElements.forEach(element => {
            element.classList.remove("is-pending");
            const rect = element.getBoundingClientRect();
            const inView = rect.top < window.innerHeight * 0.98 && rect.bottom > 0;
            if (inView) element.classList.add("visible");
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
                threshold: 0.12,
                rootMargin: "0px 0px -5% 0px"
            }
        );

        // Below-the-fold: pending → animate in on scroll
        revealElements.forEach(element => {
            if (element.classList.contains("visible")) return;
            element.classList.add("is-pending");
            // Force reflow so transition runs when .visible is added later
            void element.offsetWidth;
            revealObserver.observe(element);
        });
    }

    initScrollAnimations();

    // ---- FAQ ----
    document.querySelectorAll(".faq-question").forEach(button => {
        button.addEventListener("click", () => {
            const item = button.closest(".faq-item");
            const answer = button.nextElementSibling;
            if (!item || !answer) return;
            const isOpen = item.classList.contains("open");

            document.querySelectorAll(".faq-item").forEach(otherItem => {
                if (otherItem !== item) {
                    otherItem.classList.remove("open");
                    const otherAnswer = otherItem.querySelector(".faq-answer");
                    if (otherAnswer) otherAnswer.style.maxHeight = null;
                }
            });

            if (isOpen) {
                item.classList.remove("open");
                answer.style.maxHeight = null;
            } else {
                item.classList.add("open");
                answer.style.maxHeight = `${answer.scrollHeight}px`;
            }
        });
    });

    window.AuraStudio = {
        switchView,
        renderView,
        getViewFromHash,
        backToDashboard,
        setToolsMenu
    };
})();
