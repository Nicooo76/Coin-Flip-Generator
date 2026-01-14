/* Besucher-FAQ JS – Accordion + Suche (ohne Abhängigkeiten) */
(function(){
  const root = document.getElementById("visitorFAQ");
  if(!root) return;

  const search = document.getElementById("visitorFaqSearch");
  const empty  = document.getElementById("visitorFaqEmpty");
  const countPill = document.getElementById("visitorFaqCountPill");
  const btnCollapse = document.getElementById("visitorFaqCollapseAll");

  const items = Array.from(root.querySelectorAll(".faqItem"));

  function setOpen(item, open){
    item.dataset.open = open ? "true" : "false";
    const btn = item.querySelector(".faqBtn");
    const a   = item.querySelector(".faqA");
    if(btn) btn.setAttribute("aria-expanded", open ? "true" : "false");
    if(a)   a.setAttribute("aria-hidden", open ? "false" : "true");
  }

  function closeAll(){
    items.forEach(i => setOpen(i, false));
  }

  function toggleItem(item){
    const isOpen = item.dataset.open === "true";
    setOpen(item, !isOpen);
  }

  // Bind click/keyboard
  items.forEach(item => {
    const btn = item.querySelector(".faqBtn");
    if(!btn) return;

    btn.addEventListener("click", () => toggleItem(item));
    btn.addEventListener("keydown", (e) => {
      if(e.key === "Enter" || e.key === " "){
        e.preventDefault();
        toggleItem(item);
      }
    });
  });

  // Filter
  function applyFilter(q){
    const query = (q || "").trim().toLowerCase();
    let shown = 0;

    items.forEach(item => {
      const tags = (item.getAttribute("data-tags") || "").toLowerCase();
      const text = (item.textContent || "").toLowerCase();

      const match = !query || text.includes(query) || tags.includes(query);
      item.style.display = match ? "" : "none";
      if(match) shown++;
      else setOpen(item, false);
    });

    empty.style.display = shown ? "none" : "";
    countPill.textContent = shown + (shown === 1 ? " Frage" : " Fragen");
  }

  if(search){
    search.addEventListener("input", (e) => applyFilter(e.target.value));
  }

  if(btnCollapse){
    btnCollapse.addEventListener("click", () => {
      closeAll();
      applyFilter(search ? search.value : "");
    });
  }

  // Initial
  countPill.textContent = items.length + " Fragen";
})();

