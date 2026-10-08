(function () {
  // Ensure dataLayer exists
  window.dataLayer = window.dataLayer || [];

  var WEBVIEW_PARAM = "nativewebview";

  /* ------------------------------------------------------------------
     Webview detection (unchanged logic)
     ------------------------------------------------------------------ */
  function getIsWebView() {
    // Prefer app-injected global, then URL param
    if (window.runningInWebview === true) return true;
    try {
      return new URLSearchParams(window.location.search).get(WEBVIEW_PARAM) === "true";
    } catch (e) {
      return false;
    }
  }

  function getSource() {
    return getIsWebView() ? "webview" : "browser";
  }

  function oncePerSession(key) {
    const k = "once_" + key;
    if (sessionStorage.getItem(k) === "1") return false;
    sessionStorage.setItem(k, "1");
    return true;
  }

  /* ------------------------------------------------------------------
     Keep the nativewebview=true label on every internal link.
     Without this the app has to stop each page load, add the label and
     load the page a second time.
     ------------------------------------------------------------------ */
  function withWebviewParam(url) {
    if (!getIsWebView()) return url;
    try {
      const u = new URL(url, window.location.href);
      if (u.origin !== window.location.origin) return url;
      if (u.searchParams.get(WEBVIEW_PARAM) === null) u.searchParams.set(WEBVIEW_PARAM, "true");
      return u.toString();
    } catch (e) {
      return url;
    }
  }

  function go(url) {
    window.location.href = withWebviewParam(url);
  }

  // Runs just before the browser follows a link, so it also covers
  // links that are drawn on the page later by JavaScript.
  document.addEventListener("click", function (e) {
    const a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
    if (!a) return;
    const raw = a.getAttribute("href");
    if (!raw || raw.charAt(0) === "#" || /^(mailto|tel|javascript):/i.test(raw)) return;
    a.href = withWebviewParam(a.href);
  }, true);

  /* ------------------------------------------------------------------
     Catalogue
     item_id, item_name, price and item_category are what tracking uses.
     The other fields are for display only.
     ------------------------------------------------------------------ */
  const CATALOG = [
    {
      item_id: "TSHIRT_001", item_name: "Classic Tee - Black", price: 29.99, item_category: "T-Shirts",
      colour: "#1c1e23", outline: "#000000", tint: "#e9e6de",
      description: "A heavyweight cotton tee in washed black. Relaxed through the body with a ribbed crew neck."
    },
    {
      item_id: "TSHIRT_002", item_name: "Classic Tee - White", price: 29.99, item_category: "T-Shirts",
      colour: "#ffffff", outline: "#b9bcc4", tint: "#dfe3e8",
      description: "The same heavyweight cotton tee in clean white. Pre-washed, so it keeps its shape."
    },
    {
      item_id: "TSHIRT_003", item_name: "Logo Tee - Navy", price: 34.99, item_category: "T-Shirts",
      colour: "#1f2f56", outline: "#141f3a", tint: "#e3e7f1", logo: true,
      description: "Deep navy with the Test Shop mark printed on the chest. Slightly longer cut."
    }
  ];

  const SIZES = ["S", "M", "L"];
  const DEFAULT_SIZE = "M";

  function getProduct(itemId) {
    return CATALOG.find(p => p.item_id === itemId);
  }

  function round2(n) {
    return Math.round(n * 100) / 100;
  }

  function formatMoney(n) {
    return round2(n).toFixed(2);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // Simple T-shirt drawing, so the shop needs no image files.
  function teeSvg(p) {
    const logo = p.logo
      ? '<circle cx="100" cy="92" r="15" fill="#ffffff"/><text x="100" y="97.5" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="700" fill="' + p.colour + '">TS</text>'
      : "";
    return '<svg class="tee" viewBox="0 0 200 200" role="img" aria-label="' + escapeHtml(p.item_name) + '">' +
      '<path d="M70 30 L38 44 L12 82 L40 104 L56 88 L56 176 L144 176 L144 88 L160 104 L188 82 L162 44 L130 30 Q100 58 70 30 Z" ' +
      'fill="' + p.colour + '" stroke="' + p.outline + '" stroke-width="2.5" stroke-linejoin="round"/>' +
      '<path d="M70 30 Q100 66 130 30" fill="none" stroke="' + p.outline + '" stroke-width="2.5" stroke-linecap="round" opacity="0.55"/>' +
      logo + "</svg>";
  }

  /* ------------------------------------------------------------------
     Cart (stored in localStorage, same format as before)
     ------------------------------------------------------------------ */
  function getCart() {
    try {
      return JSON.parse(localStorage.getItem("cart_v1") || "[]");
    } catch (e) {
      return [];
    }
  }

  function setCart(items) {
    localStorage.setItem("cart_v1", JSON.stringify(items));
    refreshCartCount();
  }

  function addToCart(item_id, variant, quantity) {
    const p = getProduct(item_id);
    if (!p) return;
    const cart = getCart();
    const key = item_id + "::" + (variant || "");
    const existing = cart.find(x => x.key === key);
    if (existing) existing.quantity += quantity;
    else cart.push({
      key,
      item_id: p.item_id,
      item_name: p.item_name,
      item_category: p.item_category,
      item_variant: variant || DEFAULT_SIZE,
      price: p.price,
      quantity: quantity
    });
    setCart(cart);
  }

  // Changes a line's quantity by +1 or -1. Returns the line as it was
  // before the change, or null if it was not found.
  function changeQuantity(key, delta) {
    const cart = getCart();
    const line = cart.find(x => x.key === key);
    if (!line) return null;
    const before = Object.assign({}, line);
    line.quantity += delta;
    setCart(cart.filter(x => x.quantity > 0));
    return before;
  }

  // Removes a whole line. Returns the removed line, or null.
  function removeFromCart(key) {
    const cart = getCart();
    const line = cart.find(x => x.key === key);
    if (!line) return null;
    setCart(cart.filter(x => x.key !== key));
    return line;
  }

  function clearCart() {
    localStorage.removeItem("cart_v1");
    refreshCartCount();
  }

  function cartTotals() {
    const cart = getCart();
    const value = round2(cart.reduce((sum, x) => sum + (x.price * x.quantity), 0));
    const quantity = cart.reduce((sum, x) => sum + x.quantity, 0);
    return { cart, value, quantity };
  }

  // One cart line in the shape GA4 expects.
  function toEcomItem(x, quantity) {
    return {
      item_id: x.item_id,
      item_name: x.item_name,
      item_category: x.item_category,
      item_variant: x.item_variant,
      price: x.price,
      quantity: quantity === undefined ? x.quantity : quantity
    };
  }

  /* ------------------------------------------------------------------
     Tracking
     ------------------------------------------------------------------ */
  // Push GA4 ecommerce event to dataLayer
  function pushEcomEvent(eventName, ecommerceObj, onDone) {
    // Clear the previous ecommerce object first, so products from one
    // event cannot leak into the next.
    window.dataLayer.push({ ecommerce: null });

    const payload = {
      event: eventName,
      dl_origin: "site",              // IMPORTANT: use this in GTM triggers to avoid loops
      source: getSource(),            // browser vs webview segmentation
      ecommerce: ecommerceObj
    };

    // When a page change follows the event, wait for GTM to finish
    // sending it (or one second at most) before moving on.
    if (typeof onDone === "function") {
      let done = false;
      const finish = function () {
        if (done) return;
        done = true;
        onDone();
      };
      payload.eventCallback = finish;
      payload.eventTimeout = 1000;
      setTimeout(finish, 1000);
    }

    window.dataLayer.push(payload);
  }

  /* ------------------------------------------------------------------
     Small interface helpers
     ------------------------------------------------------------------ */
  function refreshCartCount() {
    const qty = cartTotals().quantity;
    document.querySelectorAll("[data-cart-count]").forEach(function (el) {
      el.textContent = qty;
      el.hidden = qty === 0;
    });
  }

  let toastTimer = null;
  function toast(message, linkText, linkHref) {
    let el = document.getElementById("toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "toast";
      el.className = "toast";
      el.setAttribute("role", "status");
      el.setAttribute("aria-live", "polite");
      document.body.appendChild(el);
    }
    el.innerHTML = "<span>" + escapeHtml(message) + "</span>" +
      (linkText ? '<a href="' + escapeHtml(linkHref) + '">' + escapeHtml(linkText) + "</a>" : "");
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("show"); }, 3200);
  }

  document.addEventListener("DOMContentLoaded", function () {
    refreshCartCount();
    document.querySelectorAll("[data-source-badge]").forEach(function (el) {
      el.textContent = "source: " + getSource();
    });
  });

  // Public API for pages
  window.Shop = {
    CATALOG,
    SIZES,
    DEFAULT_SIZE,
    getProduct,
    getCart,
    setCart,
    addToCart,
    changeQuantity,
    removeFromCart,
    clearCart,
    cartTotals,
    toEcomItem,
    formatMoney,
    round2,
    escapeHtml,
    teeSvg,
    oncePerSession,
    getSource,
    withWebviewParam,
    go,
    toast,
    refreshCartCount,
    pushEcomEvent
  };
})();
