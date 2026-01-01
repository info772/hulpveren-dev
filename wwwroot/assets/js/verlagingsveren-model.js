(function () {
  var root = document.getElementById('ls-page');
  if (!root) return;

  var make      = root.getAttribute('data-make');
  var model     = root.getAttribute('data-model');
  var makeSlug  = root.getAttribute('data-make-slug');
  var modelSlug = root.getAttribute('data-model-slug');

  var container = document.getElementById('ls-kits');
  if (!container) return;

  // Lees de door PowerShell gemaakte data in
  fetch('/data/ls-model-pages.json')
    .then(function (r) { return r.json(); })
    .then(function (pages) {
      // Zoek de entry voor deze <make>/<model>
      var entry = pages.find(function (p) {
        return p.MAKE_SLUG === makeSlug && p.MODEL_SLUG === modelSlug;
      });

      if (!entry || !entry.SETS || !entry.SETS.length) {
        container.innerHTML = '<p>We hebben nog geen verlagingsset in de database voor deze uitvoering. Neem contact met ons op voor de mogelijkheden.</p>';
        return;
      }

      var kits = entry.SETS;

      container.innerHTML = kits.map(function (kit) {
        // Aansluiten op DROP_FRONT / DROP_REAR uit je PowerShell
        var frontText = (kit.DROP_FRONT && kit.DROP_FRONT !== 'Geen verlaging')
          ? 'Voor: ' + kit.DROP_FRONT
          : '';
        var rearText = (kit.DROP_REAR && kit.DROP_REAR !== 'Geen verlaging')
          ? 'Achter: ' + kit.DROP_REAR
          : '';

        var dropText;
        if (frontText && rearText) {
          dropText = frontText + ' | ' + rearText;
        } else if (frontText || rearText) {
          dropText = frontText || rearText;
        } else {
          dropText = 'Verlaging volgens specificatie';
        }

        // Als je later nog remarks/prijs toevoegt kun je dat hier uitbreiden
        var remarks = (kit.remarks || []).map(function (r) {
          return '<span class="ls-chip">' + r + '</span>';
        }).join(' ');

        return (
          '<article class="ls-kit-card">' +
            '<h2>' + make + ' ' + model + ' – ' + (kit.name || ('Verlagingsset ' + kit.SKU)) + '</h2>' +
            '<p class="ls-drop">' + dropText + '</p>' +
            (remarks ? '<p class="ls-remarks">' + remarks + '</p>' : '') +
            (kit.price_display
              ? '<p class="ls-price">Vanaf ' + kit.price_display + '</p>'
              : '<p class="ls-price">Prijs op aanvraag incl. montage en uitlijnen</p>') +
            '<div class="ls-cta-row">' +
              '<a class="ls-btn ls-btn-primary" href="tel:+3116856568">Bel voor montage</a>' +
              '<a class="ls-btn ls-btn-secondary" href="https://wa.me/31651320219" target="_blank" rel="noopener">WhatsApp offerte</a>' +
            '</div>' +
          '</article>'
        );
      }).join('');
    })
    .catch(function (err) {
      console.error('Fout bij laden ls-model-pages.json', err);
      container.innerHTML = '<p>De verlagingssets konden niet geladen worden. Probeer het later opnieuw of neem contact met ons op.</p>';
    });
})();

