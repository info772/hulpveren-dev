(function() {
  var HV_IMG_BASE = "/assets/img/HV-kits/";

  var FALLBACK_FILES = [
    "HV-0.jpg",
    "HV-1.jpg",
    "HV-3-7.jpg",
    "HV-5.jpg",
    "HV-8.jpg"
  ];

  function pickFallback(img, index) {
    var explicit = img.getAttribute("data-fallback");
    if (explicit) {
      var candidate = explicit + ".jpg";
      if (FALLBACK_FILES.indexOf(candidate) !== -1) {
        return HV_IMG_BASE + candidate;
      }
    }
    var file = FALLBACK_FILES[index % FALLBACK_FILES.length];
    return HV_IMG_BASE + file;
  }

  function initHvKitImages() {
    var imgs = document.querySelectorAll("img.kit-img[data-sku]");

    imgs.forEach(function(img, i) {
      var sku = img.getAttribute("data-sku");
      if (!sku) return;

      var primarySrc = HV_IMG_BASE + sku + ".jpg";
      var switched = false;

      function onErrorOnce() {
        if (switched) {
          img.removeEventListener("error", onErrorOnce);
          return;
        }
        switched = true;
        img.src = pickFallback(img, i);
      }

      img.addEventListener("error", onErrorOnce);
      img.src = primarySrc;
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initHvKitImages);
  } else {
    initHvKitImages();
  }
})();
