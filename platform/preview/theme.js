/* Tessera — alternância de tema (Claro/Escuro).
   Roda de forma síncrona, antes da primeira pintura, pra não piscar o tema errado. */
(function () {
  var KEY = "tessera-theme";

  function apply(theme) {
    document.documentElement.setAttribute("data-theme", theme);
  }

  function stored() {
    try {
      return localStorage.getItem(KEY);
    } catch (e) {
      return null;
    }
  }

  var initial = stored() ||
    (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
  apply(initial);

  window.toggleTheme = function () {
    var current = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
    var next = current === "light" ? "dark" : "light";
    apply(next);
    try {
      localStorage.setItem(KEY, next);
    } catch (e) {}
  };
})();
