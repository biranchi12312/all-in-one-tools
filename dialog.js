let dialogQueue = Promise.resolve();

function ensureDialog(){
  let dialog=document.getElementById("oriva-modal");
  if(dialog) return dialog;
  dialog=document.createElement("dialog");
  dialog.id="oriva-modal";
  dialog.className="oriva-modal";
  dialog.innerHTML=`<div class="oriva-modal-card" role="document">
    <span class="oriva-modal-icon" data-dialog-icon aria-hidden="true">!</span>
    <h2 data-dialog-title></h2><p data-dialog-message></p>
    <ul class="oriva-modal-list" data-dialog-list hidden></ul>
    <div class="oriva-modal-actions">
      <button class="btn secondary" type="button" data-dialog-cancel hidden>Cancel</button>
      <button class="btn primary" type="button" data-dialog-confirm>OK</button>
    </div>
  </div>`;
  document.body.append(dialog);
  return dialog;
}

function runDialog(options={}){
  const {title="Notice",message="",confirmText="OK",confirmLabel,cancelText=null,cancelLabel,items=[],variant="error"}=options;
  const dialog=ensureDialog();
  const titleNode=dialog.querySelector("[data-dialog-title]");
  const messageNode=dialog.querySelector("[data-dialog-message]");
  const list=dialog.querySelector("[data-dialog-list]");
  const icon=dialog.querySelector("[data-dialog-icon]");
  const confirm=dialog.querySelector("[data-dialog-confirm]");
  const cancel=dialog.querySelector("[data-dialog-cancel]");
  titleNode.textContent=title;
  messageNode.textContent=message;
  messageNode.hidden=!message;
  list.replaceChildren();
  (Array.isArray(items)?items:[]).forEach(item=>{const li=document.createElement("li");li.textContent=String(item);list.append(li);});
  list.hidden=!list.childElementCount;
  dialog.dataset.variant=variant;
  icon.textContent=variant==="success"?"✓":variant==="warning"?"!":variant==="confirm"?"?":"!";
  confirm.textContent=confirmLabel||confirmText||"OK";
  const cancelValue=cancelLabel||cancelText;
  cancel.hidden=!cancelValue;
  if(cancelValue) cancel.textContent=cancelValue;

  return new Promise(resolve=>{
    let settled=false;
    const finish=value=>{
      if(settled) return;
      settled=true;
      confirm.onclick=null; cancel.onclick=null; dialog.oncancel=null;
      dialog.removeEventListener("click",backdropHandler);
      if(dialog.open) dialog.close();
      resolve(value);
    };
    const backdropHandler=event=>{ if(event.target===dialog) finish(false); };
    confirm.onclick=()=>finish(true);
    cancel.onclick=()=>finish(false);
    dialog.oncancel=event=>{event.preventDefault();finish(false);};
    dialog.addEventListener("click",backdropHandler);
    if(typeof dialog.showModal==="function"){
      try{ dialog.showModal(); }catch(error){
        dialog.removeEventListener("click",backdropHandler);
        confirm.onclick=null; cancel.onclick=null; dialog.oncancel=null;
        resolve(false); return;
      }
    }else{
      window.alert(`${title}\n\n${message}`); resolve(true); return;
    }
    queueMicrotask(()=>{try{confirm.focus();}catch(_){}});
  });
}

function openDialog(options={}){
  const task=dialogQueue.then(()=>runDialog(options),()=>runDialog(options));
  dialogQueue=task.catch(()=>false);
  return task;
}

window.OrivaDialog={
  show:options=>openDialog(options),
  confirm:options=>openDialog({...options,variant:"confirm"}),
  error:options=>openDialog({...options,variant:"error"}),
  warning:options=>openDialog({...options,variant:"warning"}),
  success:options=>openDialog({...options,variant:"success"})
};
export {openDialog};
