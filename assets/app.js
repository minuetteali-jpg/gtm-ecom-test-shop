(function () {
  // Ensure dataLayer exists
  window.dataLayer = window.dataLayer || [];

  function getIsWebView() {
    // Prefer app-injected global, then URL param
    if (window.runningInWebview === true) return true;
    try {
      return new URLSearchParams(window.location.search).get("nativewebview") === "true";
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

  // Hardcoded products (3 T-shirts)
  const CATALOG = [
    { item_id: "TSHIRT_001", item_name: "Classic Tee - Black", price: 29.99, item_category: "T-Shirts" },
    { item_id: "TSHIRT_002", item_name: "Classic Tee - White", price: 29.99, item_category: "T-Shirts" },
    { item_id: "TSHIRT_003", item_name: "Logo Tee - Navy",  price: 34.99, item_category: "T-Shirts" }
  ];

  function getProduct(itemId) {
    return CATALOG.find(p => p.item_id === itemId);
  }

  function formatMoney(n) {
    return (Math.round(n * 100) / 100).toFixed(2);
  }

  // Cart stored in localStorage
  function getCart() {
    try {
      return JSON.parse(localStorage.getItem("cart_v1") || "[]");
    } catch (e) {
      return [];
    }
  }

  function setCart(items) {
    localStorage.setItem("cart_v1", JSON.stringify(items));
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
      item_variant: variant || "M",
      price: p.price,
      quantity: quantity
    });
    setCart(cart);
  }

  function clearCart() {
    localStorage.removeItem("cart_v1");
  }

  function cartTotals() {
    const cart = getCart();
    const value = cart.reduce((sum, x) => sum + (x.price * x.quantity), 0);
    const quantity = cart.reduce((sum, x) => sum + x.quantity, 0);
    return { cart, value, quantity };
  }

  // Push GA4 ecommerce event to dataLayer
  function pushEcomEvent(eventName, ecommerceObj) {
    window.dataLayer.push({
      event: eventName,
      dl_origin: "site",              // IMPORTANT: use this in GTM triggers to avoid loops
      source: getSource(),            // browser vs webview segmentation
      ecommerce: ecommerceObj
    });
  }

  // Public API for pages
  window.Shop = {
    CATALOG,
    getProduct,
    getCart,
    setCart,
    addToCart,
    clearCart,
    cartTotals,
    formatMoney,
    oncePerSession,
    getSource,
    pushEcomEvent
  };
})();
