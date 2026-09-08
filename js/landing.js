"use strict";

(function wireLanding() {
  const gate = document.getElementById("authGate");
  if (!gate) return;
  const menu = document.getElementById("landing-menu");
  const toggle = gate.querySelector(".landing-menu-toggle");
  const setMenu = open => {
    menu.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "ปิดเมนู" : "เปิดเมนู");
  };
  toggle.addEventListener("click", () => setMenu(toggle.getAttribute("aria-expanded") !== "true"));
  menu.addEventListener("click", event => {
    if (event.target.closest("a, button")) setMenu(false);
  });
  gate.addEventListener("keydown", event => {
    if (event.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
      setMenu(false);
      toggle.focus();
    }
  });
  const policies = new Set(["privacy", "terms"]);
  const openDialog = id => {
    const dialog = document.getElementById(id);
    if (!dialog || dialog.open) return;
    gate.querySelectorAll(".landing-dialog[open]").forEach(other => other.close());
    dialog.showModal();
  };
  gate.querySelectorAll("[data-landing-dialog]").forEach(button => {
    button.addEventListener("click", () => openDialog(button.dataset.landingDialog));
  });
  gate.querySelectorAll('a[href="#privacy"], a[href="#terms"]').forEach(link => {
    link.addEventListener("click", () => openDialog(link.hash.slice(1)));
  });
  const openPolicyFromHash = () => {
    const id = location.hash.slice(1);
    if (policies.has(id)) openDialog(id);
    else gate.querySelectorAll(".landing-dialog[open]").forEach(dialog => {
      if (policies.has(dialog.id)) dialog.close();
    });
  };
  gate.querySelectorAll(".landing-dialog").forEach(dialog => {
    dialog.addEventListener("click", event => {
      if (event.target !== dialog) return;
      const box = dialog.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
    });
    dialog.addEventListener("close", () => {
      if (location.hash === "#" + dialog.id) history.replaceState(null, "", location.pathname + location.search);
    });
  });
  window.addEventListener("hashchange", openPolicyFromHash);
  openPolicyFromHash();
})();
