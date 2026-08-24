(() => {
    "use strict";

    const root = document.getElementById("appDialog");
    if (!root) return;

    const titleEl = document.getElementById("appDialogTitle");
    const textEl = document.getElementById("appDialogText");
    const listEl = document.getElementById("appDialogList");
    const actionEl = document.getElementById("appDialogAction");
    const cancelEl = document.getElementById("appDialogCancel");
    const backdrop = document.getElementById("appDialogBackdrop");
    const iconEl = document.getElementById("appDialogIcon");
    const panel = root.querySelector(".app-dialog-panel");

    let lastFocus = null;
    let resolver = null;

    function close(result) {
        root.hidden = true;
        document.body.classList.remove("dialog-open");
        const resolve = resolver;
        resolver = null;
        if (lastFocus && typeof lastFocus.focus === "function") {
            try { lastFocus.focus(); } catch (_) {}
        }
        if (resolve) resolve(result);
    }

    function setItems(items) {
        listEl.innerHTML = "";
        if (!items || !items.length) {
            listEl.hidden = true;
            return;
        }
        listEl.hidden = false;
        items.forEach(item => {
            const li = document.createElement("li");
            li.textContent = String(item);
            listEl.appendChild(li);
        });
    }

    function focusableElements() {
        return Array.from(
            root.querySelectorAll(
                "button:not([hidden]):not([disabled]), [href], input:not([hidden]):not([disabled]), select:not([hidden]):not([disabled]), textarea:not([hidden]):not([disabled]), [tabindex]:not([tabindex='-1'])"
            )
        ).filter(el => {
            if (el.hidden) return false;
            if (el === backdrop) return false;
            const style = window.getComputedStyle(el);
            return style.display !== "none" && style.visibility !== "hidden";
        });
    }

    function open(options) {
        const opts = options || {};
        lastFocus = document.activeElement;
        titleEl.textContent = opts.title || "Notice";
        textEl.textContent = opts.message || "";
        textEl.hidden = !opts.message;
        root.dataset.variant = opts.variant || "error";
        iconEl.textContent =
            opts.variant === "success" ? "✓" :
            opts.variant === "warning" ? "!" :
            opts.variant === "confirm" ? "?" : "!";

        setItems(opts.items);
        actionEl.textContent = opts.confirmLabel || "OK";

        if (opts.cancelLabel) {
            cancelEl.hidden = false;
            cancelEl.textContent = opts.cancelLabel;
        } else {
            cancelEl.hidden = true;
        }

        root.hidden = false;
        document.body.classList.add("dialog-open");
        actionEl.focus();

        return new Promise(resolve => {
            resolver = resolve;
        });
    }

    actionEl.addEventListener("click", () => close(true));
    cancelEl.addEventListener("click", () => close(false));
    backdrop.addEventListener("click", () => close(false));

    document.addEventListener("keydown", event => {
        if (root.hidden) return;

        if (event.key === "Escape") {
            event.preventDefault();
            close(false);
            return;
        }

        if (event.key !== "Tab") return;

        const items = focusableElements();
        if (!items.length) {
            event.preventDefault();
            if (panel) panel.focus();
            return;
        }

        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement;

        if (event.shiftKey) {
            if (active === first || !root.contains(active)) {
                event.preventDefault();
                last.focus();
            }
        } else if (active === last || !root.contains(active)) {
            event.preventDefault();
            first.focus();
        }
    });

    if (panel && !panel.hasAttribute("tabindex")) {
        panel.setAttribute("tabindex", "-1");
    }

    window.AuraDialog = {
        open,
        error(title, message, items) {
            return open({ title, message, items, variant: "error" });
        },
        warning(title, message, items) {
            return open({ title, message, items, variant: "warning" });
        },
        success(title, message) {
            return open({ title, message, variant: "success" });
        },
        confirm(title, message) {
            return open({
                title,
                message,
                variant: "confirm",
                confirmLabel: "Yes, continue",
                cancelLabel: "Cancel"
            });
        }
    };
})();
