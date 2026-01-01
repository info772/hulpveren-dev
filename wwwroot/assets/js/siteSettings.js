// /assets/js/siteSettings.js
(() => {
  "use strict";

  const CACHE_KEY = "hv.settings.v1";
  const CACHE_TTL_MS = 10 * 60 * 1000;

  const readCache = () => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };

  const writeCache = (value) => {
    try {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ value, storedAt: Date.now() })
      );
    } catch {
      return;
    }
  };

  const normalizePhoneTel = (value) => {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const digits = raw.replace(/[^0-9+]/g, "");
    if (digits.startsWith("+")) return digits;
    if (digits.startsWith("0")) {
      return `+31${digits.slice(1)}`;
    }
    return digits;
  };

  const normalizeWhatsappUrl = (value) => {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (/^https?:\/\//i.test(raw)) return raw;
    const digits = raw.replace(/[^0-9]/g, "");
    if (!digits) return "";
    return `https://wa.me/${digits}`;
  };

  const setText = (el, value, allowHtml) => {
    if (!el) return;
    if (allowHtml) {
      el.innerHTML = value || "";
    } else {
      el.textContent = value || "";
    }
  };

  const applySettingsToDom = (payload) => {
    const settings = payload?.settings || payload || {};
    window.HV_SETTINGS = settings;

    const footer = settings.footer || {};
    const companyName =
      settings.companyName || footer.companyName || settings.contact?.companyName || "";
    const phone = footer.phone || settings.phone || "";
    const phoneTel = footer.phoneTel || normalizePhoneTel(phone);
    const whatsapp = footer.whatsapp || settings.whatsapp || "";
    const whatsappUrl = footer.whatsappUrl || normalizeWhatsappUrl(whatsapp);
    const address = footer.address || settings.address || "";
    const openingHours = footer.openingHours || settings.openingHours || "";

    document.querySelectorAll("[data-setting]").forEach((el) => {
      const key = el.getAttribute("data-setting");
      if (!key) return;
      const allowHtml = el.getAttribute("data-setting-html") === "1";
      if (key === "companyName") return setText(el, companyName, allowHtml);
      if (key === "phone") return setText(el, phone, allowHtml);
      if (key === "whatsapp") return setText(el, whatsapp, allowHtml);
      if (key === "address") return setText(el, address, allowHtml);
      if (key === "openingHours") return setText(el, openingHours, allowHtml);
    });

    const socials =
      settings.socials ||
      settings.footer?.socials ||
      settings.contact?.socials ||
      {};
    const socialMap = {
      socialFacebook: socials.facebook || socials.fb || settings.facebook || "",
      socialInstagram: socials.instagram || settings.instagram || "",
      socialYouTube: socials.youtube || socials.youtubeUrl || settings.youtube || "",
      socialLinkedIn: socials.linkedin || settings.linkedin || "",
      socialTikTok: socials.tiktok || settings.tiktok || "",
    };

    document.querySelectorAll("[data-setting-link]").forEach((el) => {
      const key = el.getAttribute("data-setting-link");
      if (!key) return;
      if (key === "phoneTel") {
        if (phoneTel) {
          el.setAttribute("href", `tel:${phoneTel}`);
        }
        return;
      }
      if (key === "whatsappUrl") {
        if (whatsappUrl) {
          el.setAttribute("href", whatsappUrl);
        }
        return;
      }
      if (key in socialMap) {
        const value = socialMap[key];
        if (value) {
          el.setAttribute("href", value);
          el.style.display = "";
          el.removeAttribute("data-setting-hidden");
        } else {
          el.style.display = "none";
          el.setAttribute("data-setting-hidden", "1");
        }
      }
    });

    document.querySelectorAll("[data-social-links]").forEach((wrap) => {
      const links = Array.from(wrap.querySelectorAll("a[data-setting-link]"));
      const visible = links.some((link) => link.getAttribute("data-setting-hidden") !== "1");
      if (!visible) {
        wrap.style.display = "none";
      }
    });

    if (phoneTel) {
      document.querySelectorAll('a[href^="tel:"]').forEach((el) => {
        el.setAttribute("href", `tel:${phoneTel}`);
        if (!el.hasAttribute("data-setting")) el.textContent = phone || el.textContent;
      });
    }
    if (whatsappUrl) {
      document.querySelectorAll('a[href*="wa.me"]').forEach((el) => {
        el.setAttribute("href", whatsappUrl);
      });
    }

    const titleSuffix = settings.seo?.titleSuffix || "";
    if (titleSuffix && !document.title.includes(titleSuffix)) {
      document.title = `${document.title} ${titleSuffix}`.trim();
    }

    const features = settings.features || {};
    const blogEnabled =
      features.blogEnabled !== false &&
      features.showBlog !== false &&
      features.blog !== false;
    if (!blogEnabled) {
      document.querySelectorAll('a[href^="/blog"]').forEach((el) => {
        el.style.display = "none";
        el.setAttribute("data-feature-hidden", "blog");
      });
      document.querySelectorAll("[data-feature='blog']").forEach((el) => {
        el.style.display = "none";
      });
    }

    if (features.showMap === false || features.mapEnabled === false) {
      document.querySelectorAll("[data-feature='map']").forEach((el) => {
        el.style.display = "none";
      });
    }

    window.dispatchEvent(new CustomEvent("settings:loaded", { detail: settings }));
  };

  const reapplyWhenPartialsLoad = (payload) => {
    const targets = [
      document.getElementById("site-footer"),
      document.getElementById("site-header"),
    ].filter(Boolean);

    if (!targets.length || typeof MutationObserver === "undefined") {
      setTimeout(() => applySettingsToDom(payload), 1200);
      return;
    }

    let applied = false;
    const observer = new MutationObserver(() => {
      if (document.querySelector("[data-setting], [data-setting-link]")) {
        applied = true;
        observer.disconnect();
        applySettingsToDom(payload);
      }
    });

    targets.forEach((target) => {
      observer.observe(target, { childList: true, subtree: true });
    });

    setTimeout(() => {
      if (!applied) {
        observer.disconnect();
        applySettingsToDom(payload);
      }
    }, 1500);
  };

  const loadSettings = async (options = {}) => {
    const ttl = options.cacheTtlMs ?? CACHE_TTL_MS;
    const cached = readCache();
    if (cached && cached.value && Date.now() - cached.storedAt < ttl) {
      return cached.value;
    }
    if (!window.HVApiClient || typeof window.HVApiClient.getSettings !== "function") {
      return cached ? cached.value : null;
    }
    try {
      const data = await window.HVApiClient.getSettings();
      if (data) {
        writeCache(data);
      }
      return data;
    } catch (err) {
      return cached ? cached.value : null;
    }
  };

  const init = async () => {
    const data = await loadSettings();
    if (data) {
      applySettingsToDom(data);
      reapplyWhenPartialsLoad(data);
    }
    else window.dispatchEvent(new CustomEvent("settings:loaded", { detail: null }));
  };

  window.HVSiteSettings = {
    loadSettings,
    applySettingsToDom,
    init,
  };
})();
