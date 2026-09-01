(() => {
    "use strict";

    const STATES = Object.freeze({
        IDLE: "idle",
        PROCESSING: "processing",
        SUCCESS: "success",
        ERROR: "error",
        CANCELLED: "cancelled"
    });

    let currentOperation = null;
    let operationCounter = 0;
    const listeners = new Set();

    function createOperationId() {
        operationCounter += 1;
        return `aura-operation-${Date.now()}-${operationCounter}`;
    }

    function cloneState() {
        if (!currentOperation) {
            return { active: false, id: null, toolId: null, state: STATES.IDLE, startedAt: null, finishedAt: null, canCancel: false, metadata: {}, error: null };
        }
        return {
            active: currentOperation.state === STATES.PROCESSING,
            id: currentOperation.id,
            toolId: currentOperation.toolId,
            state: currentOperation.state,
            startedAt: currentOperation.startedAt,
            finishedAt: currentOperation.finishedAt,
            canCancel: currentOperation.canCancel,
            metadata: { ...currentOperation.metadata },
            error: currentOperation.error || null
        };
    }

    function syncLegacyFlag() {
        window.__auraProcessing = Boolean(currentOperation) && currentOperation.state === STATES.PROCESSING;
    }

    function emit() {
        const snapshot = cloneState();
        listeners.forEach(listener => {
            try { listener(snapshot); }
            catch (error) { console.error("[Oriva Studio ProcessingManager] Listener error:", error); }
        });
    }

    function start(toolId, options = {}) {
        if (!toolId || typeof toolId !== "string") {
            throw new Error("[Oriva Studio ProcessingManager] A valid toolId is required.");
        }
        if (currentOperation && currentOperation.state === STATES.PROCESSING) {
            return { ok: false, reason: "already-processing", operationId: currentOperation.id, operation: cloneState() };
        }
        currentOperation = {
            id: createOperationId(), toolId, state: STATES.PROCESSING,
            startedAt: Date.now(), finishedAt: null,
            canCancel: Boolean(options.canCancel),
            metadata: options.metadata && typeof options.metadata === "object" ? { ...options.metadata } : {},
            error: null
        };
        syncLegacyFlag(); emit();
        return { ok: true, operationId: currentOperation.id, operation: cloneState() };
    }

    function resolveOperation(operationId) {
        if (!currentOperation) return null;
        if (operationId && currentOperation.id !== operationId) return null;
        return currentOperation;
    }

    function finish(operationId) {
        const operation = resolveOperation(operationId);
        if (!operation) return false;
        operation.state = STATES.SUCCESS; operation.finishedAt = Date.now(); operation.error = null;
        syncLegacyFlag(); emit(); return true;
    }

    function fail(operationId, error = null) {
        const operation = resolveOperation(operationId);
        if (!operation) return false;
        operation.state = STATES.ERROR; operation.finishedAt = Date.now();
        operation.error = error ? (error instanceof Error ? error.message : String(error)) : "Processing failed.";
        syncLegacyFlag(); emit(); return true;
    }

    function cancel(operationId) {
        const operation = resolveOperation(operationId);
        if (!operation || !operation.canCancel) return false;
        operation.state = STATES.CANCELLED; operation.finishedAt = Date.now();
        syncLegacyFlag(); emit(); return true;
    }

    function reset(operationId = null) {
        if (!currentOperation) { syncLegacyFlag(); return false; }
        if (operationId && currentOperation.id !== operationId) return false;
        currentOperation = null; syncLegacyFlag(); emit(); return true;
    }

    function isActive() {
        return Boolean(currentOperation) && currentOperation.state === STATES.PROCESSING;
    }

    function getState() { return cloneState(); }

    function subscribe(listener) {
        if (typeof listener !== "function") {
            throw new Error("[Oriva Studio ProcessingManager] Listener must be a function.");
        }
        listeners.add(listener);
        return () => listeners.delete(listener);
    }

    window.AuraProcessingManager = Object.freeze({
        STATES, start, finish, fail, cancel, reset,
        isActive, isProcessing: isActive, getState, subscribe
    });

    syncLegacyFlag();
})();
