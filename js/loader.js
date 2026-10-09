(function () {
  var loader = document.getElementById("loader");
  if (!loader) return;
  var root = document.documentElement;
  root.classList.add("is-loading");
  var start = Date.now();
  var MIN = 1900;
  var done = false;
  function finish() {
    if (done) return;
    done = true;
    loader.classList.add("is-done");
    setTimeout(function () {
      root.classList.remove("is-loading");
      loader.parentNode && loader.parentNode.removeChild(loader);
    }, 950);
  }
  function ready() {
    setTimeout(finish, Math.max(0, MIN - (Date.now() - start)));
  }
  if (document.readyState === "complete") ready();
  else window.addEventListener("load", ready);
  setTimeout(finish, 6000);
})();
