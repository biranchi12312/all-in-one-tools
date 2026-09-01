export function observeLazy(selector, callback, options={}){
  const nodes=[...document.querySelectorAll(selector)];
  if(!("IntersectionObserver" in window)){
    nodes.forEach(node=>callback(node));
    return;
  }
  const observer=new IntersectionObserver(entries=>{
    for(const entry of entries){
      if(!entry.isIntersecting) continue;
      observer.unobserve(entry.target);
      callback(entry.target);
    }
  },{rootMargin:"300px 0px",...options});
  nodes.forEach(node=>observer.observe(node));
}
