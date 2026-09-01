export function initNetwork(){
  const note=document.createElement("div");
  note.className="offline-note";
  note.setAttribute("role","status");
  note.textContent="You appear to be offline. Some processing components may not load until your connection returns.";
  document.body.append(note);
  const update=()=>note.dataset.visible=String(!navigator.onLine);
  addEventListener("online",update);
  addEventListener("offline",update);
  update();
}
