(function () {
  function initMegaMenus(root) {
    var items = Array.prototype.slice.call(
      root.querySelectorAll('.hv-nav-item-mega')
    );
    if (!items.length) return;

    var activeItems = [];

    function setupItem(item) {
      var toggle = item.querySelector('.hv-nav-toggle');
      var panel  = item.querySelector('.hv-mega-panel');
      if (!toggle || !panel) return;

      function open() {
        // sluit andere open items
        activeItems.forEach(function (entry) {
          if (entry.item !== item) entry.close();
        });
        item.classList.add('is-open');
        toggle.setAttribute('aria-expanded', 'true');
      }

      function close() {
        item.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      }

      var pointerFine = window.matchMedia('(hover:hover)').matches;

      // Hover voor desktop
      if (pointerFine) {
        item.addEventListener('mouseenter', open);
        item.addEventListener('mouseleave', close);
      }

      // Klik voor mobiel / tablet
      toggle.addEventListener('click', function (evt) {
        evt.preventDefault();
        if (item.classList.contains('is-open')) {
          close();
        } else {
          open();
        }
      });

      // Keyboard focus in/uit
      item.addEventListener('focusin', function () {
        open();
      });

      item.addEventListener('focusout', function (e) {
        if (!item.contains(e.relatedTarget)) {
          close();
        }
      });

      activeItems.push({ item: item, close: close });
    }

    items.forEach(setupItem);

    // Klik buiten menu → alles dicht
    document.addEventListener('click', function (evt) {
      activeItems.forEach(function (entry) {
        if (!entry.item.contains(evt.target)) {
          entry.close();
        }
      });
    });

    // Esc → alles dicht
    document.addEventListener('keydown', function (evt) {
      if (evt.key === 'Escape' || evt.key === 'Esc') {
        activeItems.forEach(function (entry) {
          entry.close();
        });
      }
    });
  }

  function loadHeader() {
    var container = document.getElementById('site-header');
    if (!container) return;

    fetch('/partials/header.html', { cache: 'no-cache' })
      .then(function (response) {
        if (!response.ok) {
          throw new Error('HTTP ' + response.status);
        }
        return response.text();
      })
      .then(function (html) {
        container.innerHTML = html;
        initMegaMenus(container);
      })
      .catch(function (err) {
        console.error('[Header] Laden mislukt:', err);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadHeader);
  } else {
    loadHeader();
  }
})();
