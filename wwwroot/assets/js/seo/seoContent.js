console.log("seoContent.js geladen");

// SEO content helper for Hulpveren.shop
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.HVSeo = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  const MAD_MAP = {
    "0": { springApplication: "assist", mount: "next_to_original" },
    "1": { springApplication: "full_replacement", mount: "lift_replacement" },
    "3": { springApplication: "assist", mount: "on_shock_absorber" },
    "5": { springApplication: "assist", mount: "in_original_spring" },
    "7": { springApplication: "assist", mount: "in_original_spring" },
    "8": { springApplication: "replacement", mount: "main_replacement" },
  };

  function getMadSuffixDigit(code) {
    const m = String(code || "").match(/(\d)(?!.*\d)/);
    return m ? m[1] : null;
  }

  function getKitDerived(kit) {
    if (kit && kit.derived) return kit.derived;
    const sku = String(kit?.sku || kit?.setCode || "");
    const digit = getMadSuffixDigit(sku);
    const map = digit ? MAD_MAP[digit] : null;
    const fromSuffix = map ? map.springApplication : null;
    const includesFSD = /^sd-/i.test(sku);
    return {
      springApplication: fromSuffix,
      solutionLevel: includesFSD ? "special_duty" : "standard",
      includesFSD: includesFSD || false,
      madSuffix: digit || "",
    };
  }

  function getAxleConfig(kit, fitment, context) {
    const cand =
      kit?.position ||
      kit?.axle ||
      kit?.axleConfig ||
      fitment?.position ||
      fitment?.axle ||
      (context && context.axleConfig) ||
      "";
    const val = String(cand || "").toLowerCase();
    if (["front", "rear", "both"].includes(val)) return val;
    return "rear";
  }

  function introText(springApplication) {
    if (springApplication === "replacement" || springApplication === "full_replacement") {
      return "Onze vervangingsveren vervangen de originele veren, herstellen de rijhoogte en vormen een structurele oplossing bij doorgezakte veren.";
    }
    return "Onze hulpveren ondersteunen de bestaande vering, geven extra draagvermogen bij belading, aanhanger of camperombouw en laten de originele veren zitten.";
  }

  function axleText(axle) {
    if (axle === "front") return "Toepassing op de vooras voor extra stabiliteit en draagvermogen.";
    if (axle === "both") return "Toepassing op voor- en achteras voor een gebalanceerde upgrade.";
    return "Toepassing op de achteras voor betere ondersteuning bij belading of trekhaakgebruik.";
  }

  function sdBlock(info) {
    if (info.solutionLevel !== "special_duty") return "";
    const lines = [
      "Special Duty set voor zwaardere belasting en hogere stabiliteit.",
    ];
    if (info.includesFSD) {
      lines.push("Frequency Selective Damping (FSD): past de demping automatisch aan op rijfrequentie voor comfort én controle.");
    }
    return `<div class="seo-sd"><strong>Special Duty</strong><ul>${lines
      .map((l) => `<li>${l}</li>`)
      .join("")}</ul></div>`;
  }

  function bulletList(info) {
    const bullets =
      info.springApplication === "replacement" || info.springApplication === "full_replacement"
        ? [
            "Vervangt de originele veren en herstelt rijhoogte en veercomfort.",
            "Structurele oplossing bij doorgezakte of vermoeide veren.",
            "Geschikt bij zware of continue belading.",
          ]
        : [
            "Ondersteunt de bestaande vering zonder demontage van de originele veren.",
            "Extra draagvermogen bij belading, aanhanger of camperombouw.",
            "Verbeterde stabiliteit zonder verlies van comfort.",
          ];
    if (info.solutionLevel === "special_duty") {
      bullets.push("Special Duty voor intensief gebruik of hogere last.");
    }
    return `<ul class="seo-bullets">${bullets
      .map((b) => `<li>${b}</li>`)
      .join("")}</ul>`;
  }

  function classifyPair(pair, context) {
    const derived = getKitDerived(pair.k || pair);
    const axle = getAxleConfig(pair.k || pair, pair.f, context);
    return {
      sku: pair.k?.sku || pair.sku || "",
      springApplication: derived.springApplication || "assist",
      solutionLevel: derived.solutionLevel || "standard",
      includesFSD: !!derived.includesFSD,
      axle,
      kit: pair.k || pair,
    };
  }

  function renderSet(info, ctx) {
    const intro = introText(info.springApplication);
    const sd = sdBlock(info);
    const bullets = bulletList(info);
    const axle = axleText(info.axle || (ctx && ctx.axleConfig));
    return `
      <section class="seo-block">
        <h2>${ctx?.title || "Waarom deze set?"}</h2>
        <p class="seo-intro">${intro}</p>
        <p class="seo-axle">${axle}</p>
        ${sd}
        ${bullets}
      </section>
    `;
  }

  function renderModel(infos, ctx) {
    if (!infos.length) return "";
    const byType = infos.reduce((acc, info) => {
      const key = info.springApplication || "assist";
      acc[key] = acc[key] || [];
      acc[key].push(info);
      return acc;
    }, {});
    const blocks = [];
    const makeModel = [ctx?.makeLabel, ctx?.modelLabel].filter(Boolean).join(" ");
    if (Object.keys(byType).length === 1) {
      const key = Object.keys(byType)[0];
      const info = byType[key][0];
      blocks.push(`<section class="seo-block"><h2>${makeModel} sets</h2><p class="seo-intro">${introText(key)}</p>${bulletList(info)}</section>`);
    } else {
      Object.entries(byType).forEach(([key, list]) => {
        const label = key === "replacement" || key === "full_replacement" ? "Vervangingsveren" : "Hulpveren";
        blocks.push(
          `<section class="seo-block">
            <h3>${label} voor ${makeModel}</h3>
            <p class="seo-intro">${introText(key)}</p>
            <div class="seo-kits">${list
              .map(
                (info) =>
                  `<div class="seo-chip">${info.sku} · ${axleText(info.axle)}${info.solutionLevel === "special_duty" ? " · SD" : ""}</div>`
              )
              .join("")}</div>
          </section>`
        );
      });
    }
    return `<div class="seo-content">${blocks.join("")}</div>`;
  }

  function renderBrand(ctx) {
    const label = ctx?.makeLabel || "dit merk";
    const intro = introText("assist");
    return `<section class="seo-block"><h2>${label} hulpveren</h2><p class="seo-intro">${intro}</p></section>`;
  }

  return {
    MAD_MAP,
    getMadSuffixDigit,
    getKitDerived,
    getAxleConfig,
    renderSet,
    renderModel,
    renderBrand,
  };
});
