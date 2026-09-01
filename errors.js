let lastMessage="", lastTime=0;
function report(message,error){
  console.error(error || message);
  const now=Date.now();
  if(message===lastMessage && now-lastTime<2000) return;
  lastMessage=message;lastTime=now;
  if(document.visibilityState==="visible"){
    window.OrivaDialog?.show?.({
      title:"Something went wrong",
      message:"The page could not complete one action. You can continue, or reset the tool and try again."
    });
  }
}
export function initGlobalErrors(){
  addEventListener("error",e=>{
    if(e.target instanceof HTMLScriptElement || e.target instanceof HTMLLinkElement) return;
    report(e.message||"Unexpected error",e.error);
  });
  addEventListener("unhandledrejection",e=>report("Unhandled operation error",e.reason));
}
