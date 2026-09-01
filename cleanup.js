export function createCleanupRegistry() {
  const cleanups = new Set();
  return {
    add(fn){ if (typeof fn === "function") cleanups.add(fn); return fn; },
    run(){ for (const fn of cleanups) { try { fn(); } catch {} } cleanups.clear(); }
  };
}
