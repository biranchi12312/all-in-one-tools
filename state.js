const transitions = {
  idle: ["validating", "ready"],
  validating: ["ready", "error", "idle"],
  ready: ["validating", "processing", "idle", "error"],
  processing: ["result", "error", "ready"],
  result: ["ready", "idle"],
  error: ["ready", "idle"]
};

export function createToolState(onChange) {
  let state = "idle";
  return {
    get value(){ return state; },
    set(next){
      if (state === next) return true;
      if (!transitions[state]?.includes(next)) return false;
      state = next;
      onChange?.(state);
      return true;
    }
  };
}
