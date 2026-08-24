(() => {
    "use strict";

    document.documentElement.classList.add("js-ready");

    const views = {
        dashboard: document.getElementById("dashboardView"),
        compressor: document.getElementById("compressorView"),
        converter: document.getElementById("converterView"),
        pdfMerge: document.getElementById("pdfMergeView")
    };

    const menuToggle = document.getElementById("menuToggle");
    const toolsMenu = document.getElementById("toolsMenu");
    const menuClose = document.getElementById("menuClose");
    const menuBackdrop = document.getElementById("menuBackdrop");
    const menuCategories = Array.from(document.querySelectorAll(".menu-category"));

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
            initScrollAnimations();
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
                viewName === "dashboard" ? location.pathname + location.search : `#${viewName}`
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
        history.replaceState({ view: "dashboard" }, "", location.pathname + location.search);
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

    document.querySelectorAll("[data-open-view]").forEach(button => {
        button.addEventListener("click", () => {
            const viewName = button.dataset.openView;
            if (viewName) switchView(viewName);
        });
    });

    document.querySelectorAll("[data-back-dashboard]").forEach(button => {
        button.addEventListener("click", backToDashboard);
    });

    document.getElementById("logoBtn")?.addEventListener("click", () => {
        if (getViewFromHash() === "dashboard") {
            renderView("dashboard");
            setToolsMenu(false);
            return;
        }
        backToDashboard();
    });

    function openFirstMenuCategory() {
        if (!menuCategories.length) return;
        menuCategories.forEach((category, index) => {
            const trigger = category.querySelector(".menu-category-trigger");
            const shouldOpen = index === 0;
            category.classList.toggle("open", shouldOpen);
            trigger?.setAttribute("aria-expanded", String(shouldOpen));
        });
    }

    function setToolsMenu(open) {
        if (!menuToggle || !toolsMenu) return;

        toolsMenu.classList.toggle("open", open);
        menuToggle.classList.toggle("active", open);
        menuBackdrop?.classList.toggle("open", open);
        document.body.classList.toggle("menu-open", open);
        menuToggle.setAttribute("aria-expanded", String(open));
        toolsMenu.setAttribute("aria-hidden", String(!open));
        menuBackdrop?.setAttribute("aria-hidden", String(!open));

        if (open) openFirstMenuCategory();
    }

    function toggleToolsMenu(event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        if (!toolsMenu) return;
        setToolsMenu(!toolsMenu.classList.contains("open"));
    }

    if (menuToggle) {
        menuToggle.addEventListener("click", toggleToolsMenu);
    }
    if (menuClose) {
        menuClose.addEventListener("click", () => setToolsMenu(false));
    }
    if (menuBackdrop) {
        menuBackdrop.addEventListener("click", () => setToolsMenu(false));
    }

    document.querySelectorAll("[data-open-menu]").forEach(button => {
        button.addEventListener("click", () => setToolsMenu(true));
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") setToolsMenu(false);
    });

    menuCategories.forEach(category => {
        const trigger = category.querySelector(".menu-category-trigger");
        trigger?.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
            const willOpen = !category.classList.contains("open");
            menuCategories.forEach(otherCategory => {
                otherCategory.classList.remove("open");
                otherCategory
                    .querySelector(".menu-category-trigger")
                    ?.setAttribute("aria-expanded", "false");
            });
            if (willOpen) {
                category.classList.add("open");
                trigger.setAttribute("aria-expanded", "true");
            }
        });
    });

    toolsMenu?.querySelectorAll("[data-open-view]").forEach(button => {
        button.addEventListener("click", () => setToolsMenu(false));
    });

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

    document.querySelectorAll(".preview-feature").forEach(button => {
        button.addEventListener("click", () => showPreviewFeatureNotice());
    });

    // Reveal classes are CSS-only now (always visible). No JS hide/show.
    function initScrollAnimations() {
        // no-op: content stays visible for instant first paint
    }

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
