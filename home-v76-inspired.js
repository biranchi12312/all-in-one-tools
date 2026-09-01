const menuButton = document.querySelector("[data-home-menu-button]");
const menu = document.querySelector("[data-home-menu]");
const menuLinks = document.querySelectorAll("[data-home-menu] a");

function setMenu(open){
  if(!menuButton || !menu) return;
  menu.dataset.open = String(open);
  menuButton.setAttribute("aria-expanded", String(open));
  document.body.style.overflow = open ? "hidden" : "";
}

menuButton?.addEventListener("click", () => setMenu(menu.dataset.open !== "true"));
menuLinks.forEach(link => link.addEventListener("click", () => setMenu(false)));

document.querySelector("[data-open-tools-menu]")?.addEventListener("click", () => {
  setMenu(true);
  menu?.querySelector("a")?.focus();
});

const revealNodes = [...document.querySelectorAll(".home-page .reveal")];
if("IntersectionObserver" in window){
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if(entry.isIntersecting){
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  }, {rootMargin:"0px 0px -8%"});
  revealNodes.forEach(node => observer.observe(node));
}else{
  revealNodes.forEach(node => node.classList.add("is-visible"));
}
