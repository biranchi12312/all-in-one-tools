export function initNavigation(){
  const bar=document.createElement("div");
  bar.className="loading-bar";
  document.body.append(bar);

  document.addEventListener("click", event=>{
    const a=event.target.closest("a[href]");
    if(!a || event.defaultPrevented || a.target==="_blank" || a.hasAttribute("download")) return;
    const href=a.getAttribute("href");
    if(!href || href.startsWith("#") || /^(mailto:|tel:|javascript:)/i.test(href)) return;
    try{
      const url=new URL(a.href,location.href);
      if(url.origin!==location.origin) return;
      bar.dataset.active="true";
    }catch{}
  }, {capture:true});

  window.addEventListener("pageshow", ()=>{
    bar.dataset.active="false";
    bar.dataset.done="true";
    setTimeout(()=>{bar.dataset.done="false";bar.style.width="";},240);
  });
}
