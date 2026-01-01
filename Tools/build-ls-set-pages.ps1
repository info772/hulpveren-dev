$ErrorActionPreference = "Stop"

function Get-DropText {
  param($front,$rear)
  if ($null -ne $front -and $null -ne $rear) { return "Voor: $front mm &middot; Achter: $rear mm" }
  if ($null -ne $front) { return "Voor: $front mm" }
  if ($null -ne $rear) { return "Achter: $rear mm" }
  return "Op aanvraag"
}

function Format-Approval {
  param($txt)
  if (-not $txt) { return "Op aanvraag" }
  $t = $txt
  $t = $t -replace "TUV", "T&Uuml;V"
  $t = $t -replace "TÜV", "T&Uuml;V"
  $t = $t -replace "TüV", "T&Uuml;V"
  $t = $t -replace "Ü", "&Uuml;"
  $t = $t -replace "ü", "&uuml;"
  return $t
}

function Get-PriceLabel {
  param($p)
  if ($null -ne $p -and $p -ne "") {
    $num = [double]$p
    if ($num -gt 0) { return "&euro; " + [math]::Round($num,0) }
  }
  return "Prijs op aanvraag"
}

function Get-Years {
  param($from,$to)
  $year = {
    param($val)
    if (-not $val) { return $null }
    $m = [regex]::Match($val, "\d{4}")
    if ($m.Success) { return $m.Value }
    return $val
  }
  $y1 = & $year $from
  $y2 = & $year $to
  if ($y1 -and $y2) { return "$y1-$y2" }
  if ($y1) { return "$y1-" }
  if ($y2) { return "-$y2" }
  return ""
}

function Get-ImageSrc {
  param($images,$count,$pos)
  $fallback = "LS-4"
  if ($pos -eq "rear") { $fallback = "LS-Rear" }
  elseif ($count -le 2) { $fallback = "LS-2" }

  $n = $null
  if ($images -and $images.Length -gt 0) { $n = $images[0] }
  if (-not $n -or $n.Trim() -eq "") { $n = $fallback }

  $fileName = $n + ".jpg"
  $localPath = Join-Path -Path "wwwroot/assets/img/HV-kits" -ChildPath $fileName
  $use = $n
  if (-not (Test-Path $localPath)) { $use = $fallback }

  $use = $use.Replace(" ", "%20")
  return "/assets/img/HV-kits/$use.jpg"
}

$outRoot = "wwwroot/verlagingsveren"
$ls = Get-Content "wwwroot/data/ls-kits.json" -Raw | ConvertFrom-Json

foreach ($kit in $ls.kits) {
  $sku = ($kit.sku | Out-String).Trim()
  if (-not $sku) { continue }
  $skuLower = $sku.ToLower()

  $priceLabel = Get-PriceLabel $kit.pricing_nl.total_inc_vat_from_eur
  $approvalSource = $kit.approval_nl
  if (-not $approvalSource -or $approvalSource -eq "") { $approvalSource = $kit.approval }
  $approval = Format-Approval $approvalSource

  $front = $null; if ($kit.suspension_delta_mm -and $null -ne $kit.suspension_delta_mm.front_mm) { $front = $kit.suspension_delta_mm.front_mm }
  $rear = $null; if ($kit.suspension_delta_mm -and $null -ne $kit.suspension_delta_mm.rear_mm) { $rear = $kit.suspension_delta_mm.rear_mm }
  $dropText = Get-DropText $front $rear

  $pos = "both"; if ($kit.position) { $pos = $kit.position }
  $posText = "Voor- en achteras"; $setCount = 4
  if ($pos -eq "front") { $posText = "Vooras"; $setCount = 2 }
  elseif ($pos -eq "rear") { $posText = "Achteras"; $setCount = 2 }

  if ($setCount -le 2) { $setText = "2 veren ($posText)" } else { $setText = "4 veren (voor+achter)" }
  $imgSrc = Get-ImageSrc $kit.images $setCount $pos

  $fitments = $kit.fitments
  if (-not $fitments -or $fitments.Count -eq 0) { continue }

  $mainMake = $fitments[0].make
  $mainModel = $fitments[0].model
  $pageLabel = "$mainMake $mainModel"
  if ($fitments.Count -gt 1) { $pageLabel = "$mainMake $mainModel e.v." }

  $fitRows = foreach ($f in $fitments) {
    $years = Get-Years $f.year_from $f.year_to
    $notes = ""
    if ($f.remark) { $notes = $f.remark }
    elseif ($f.notes) { $notes = $f.notes }
    $notes = $notes.Trim()
    $line = "<li><strong>$($f.make) $($f.model)</strong> $years"
    if ($notes) { $line += " &middot; $notes" }
    $line += "</li>"
    $line
  }
  $fitList = ($fitRows -join "`n          ")

  $dir = Join-Path $outRoot $skuLower
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
  $path = Join-Path $dir "index.html"

  $title = "$pageLabel verlagen - $sku | MAD set met montage"
  $metaDesc = "$sku verlagingsveren - MAD set met montage"

  $html = @"
<!doctype html>
<html lang="nl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="index,follow" />

  <title>$title</title>
  <meta name="description" content="$metaDesc" />
  <link rel="canonical" href="https://www.hulpveren.shop/verlagingsveren/$skuLower/" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="$title" />
  <meta property="og:description" content="$metaDesc" />
  <meta property="og:url" content="https://www.hulpveren.shop/verlagingsveren/$skuLower/" />

  <link rel="icon" href="/favicon.ico" />
  <link rel="stylesheet" href="/assets/css/site.css?v=20251210" />
</head>
<body>
  <header class="site-header">
  <div class="nav-shell">
    <a class="brand" href="/" aria-label="Hulpveren.shop">
      <img class="brand-logo" src="/img/branding/Logo-wit.png" alt="Hulpveren.shop" loading="lazy" decoding="async" />
    </a>

    <button class="nav-toggle" type="button" data-nav-toggle aria-expanded="false" aria-label="Open navigatie">
      <span></span><span></span><span></span>
    </button>

    <nav class="nav" aria-label="Hoofdmenu">
      <ul class="nav-list">
        <li class="nav-item"><a class="nav-link" href="/">Home</a></li>
        <li class="nav-item nav-item-mega" data-family="hv">
          <button class="nav-link nav-toggle-cta" type="button" aria-expanded="false">MAD hulpveren</button>
          <div class="mega-panel" role="menu">
            <div class="mega-inner">
              <div class="mega-col">
                <h3>Alle merken</h3>
                <ul id="hv-mega-brands-hv" class="mega-list" aria-label="Merken hulpveren"></ul>
              </div>
            </div>
          </div>
        </li>
        <li class="nav-item nav-item-mega" data-family="nr">
          <button class="nav-link nav-toggle-cta" type="button" aria-expanded="false">MAD Luchtvering</button>
          <div class="mega-panel" role="menu">
            <div class="mega-inner">
              <div class="mega-col">
                <h3>Alle merken</h3>
                <ul id="hv-mega-brands-nr" class="mega-list" aria-label="Merken luchtvering"></ul>
              </div>
            </div>
          </div>
        </li>
        <li class="nav-item nav-item-mega" data-family="ls">
          <button class="nav-link nav-toggle-cta" type="button" aria-expanded="false">MAD Verlagingsveren</button>
          <div class="mega-panel" role="menu">
            <div class="mega-inner">
              <div class="mega-col">
                <h3>Alle merken</h3>
                <ul id="hv-mega-brands-ls" class="mega-list" aria-label="Merken verlagingsveren"></ul>
              </div>
            </div>
          </div>
        </li>
        <li class="nav-item"><a class="nav-link" href="/montage">Montage</a></li>
        <li class="nav-item"><a class="nav-link" href="/onze-ervaring">Onze ervaring</a></li>
        <li class="nav-item"><a class="nav-link" href="/blog">Blog</a></li>
        <li class="nav-item"><a class="nav-link" href="/over-ons">Over ons</a></li>
        <li class="nav-item"><a class="nav-link" href="/contact">Contact</a></li>
      </ul>
    </nav>
  </div>
</header>

  <main>
    <section class="hero">
      <div class="wrap">
        <div>
          <span class="eyebrow">MAD verlagingsveren</span>
          <h1>$pageLabel verlagen</h1>
          <p class="lead">Set $sku met montage en uitlijning inbegrepen. Verlaging: $dropText.</p>
          <div class="hero-actions">
            <a class="btn" href="/contact?onderwerp=$skuLower">Plan mijn set</a>
            <a class="btn btn-ghost" href="tel:+3116856568">Bel ons</a>
          </div>
        </div>
      </div>
    </section>

    <section class="wrap">
      <div class="crumbs">
        <a href="/">Home</a> / <a href="/verlagingsveren">Verlagingsveren</a> / $sku
      </div>

      <div class="product-hero card">
        <div class="img">
          <img src="$imgSrc" alt="$sku verlagingsveren" loading="lazy" />
          <div class="badge">Inclusief montage</div>
        </div>
        <div class="body">
          <div class="sku">$sku</div>
          <div class="meta rows">
            <div class="k">Verlaging</div><div class="v">$dropText</div>
            <div class="k">Positie</div><div class="v">$posText</div>
            <div class="k">Set</div><div class="v">$setText</div>
            <div class="k">Goedkeuring</div><div class="v">$approval</div>
            <div class="k">Prijs</div><div class="v">$priceLabel <small>(incl. montage &amp; btw)</small></div>
          </div>
          <div class="chips" style="margin-top:10px">
            <span class="chip support">Montage &amp; uitlijning</span>
            <span class="chip">$priceLabel</span>
          </div>
          <div class="cta-row" style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap;">
            <a class="btn" href="/contact?onderwerp=$skuLower">Offerte / afspraak</a>
            <a class="btn btn-ghost" href="https://wa.me/31651320219" target="_blank" rel="noopener noreferrer">WhatsApp</a>
          </div>
        </div>
      </div>
    </section>

    <section class="wrap">
      <h2>Past op</h2>
      <ul class="taglist" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px;list-style:none;padding:0;margin:0;">
          $fitList
      </ul>
    </section>

    <section class="wrap">
      <h2>Wat je gaat merken</h2>
      <p>Lagere rijhoogte en strakker weggedrag zonder onnodig comfortverlies. De auto stuurt directer in, helt minder in bochten en oogt sportiever. Ideaal als je caravan of dakkoffer meehebt maar toch een vaste, voorspelbare vering wilt.</p>
    </section>

    <section class="wrap">
      <h2>Montage &amp; uitlijning</h2>
      <p>We monteren de veren op de aangewezen as(sen), vervangen borg- en rubberdelen waar nodig en lijnen de auto daarna uit. Na de proefrit controleren we rijhoogte en eventuele speling zodat je veilig de weg op gaat.</p>
    </section>

    <section class="wrap">
      <h2>Over deze kit</h2>
      <p>Deze MAD verlagingsveren zijn progressief gewikkeld en afgestemd op het voertuiggewicht. Keuringsstatus: $approval. Prijs is inclusief montage, uitlijning en btw. Heb je specifieke wensen of accessoires (trekhaak, LPG, zware velgen)? Geef het door bij je aanvraag.</p>
    </section>
  </main>

  <footer class="site-footer">
  <div class="footer-shell">
    <section class="footer-block">
      <p class="eyebrow">Hulpveren.shop</p>
      <h2>Veilig rijden met de juiste set</h2>
      <p>Wij bouwen dagelijks MAD hulpveren, luchtvering en verlagingsveren in. Altijd inclusief montage, uitlijning en eerlijk advies.</p>
      <div class="footer-cta">
        <a class="btn" href="/hulpveren">Bekijk hulpveren</a>
        <a class="btn btn-ghost" href="/montage">Plan montage</a>
      </div>
      <ul class="footer-list">
        <li>Gecertificeerde monteurs</li>
        <li>Persoonlijk advies per kenteken</li>
        <li>Snelle beschikbaarheid uit voorraad</li>
      </ul>
    </section>

    <section class="footer-block">
      <p class="eyebrow">Kies je merk</p>
      <div id="hv-footer-brands" class="taglist" aria-live="polite"></div>
      <a class="footer-link" href="/hulpveren">Alle merken</a>
    </section>

    <section class="footer-block">
      <p class="eyebrow">Populaire modellen</p>
      <p id="hv-footer-models-label" class="footer-muted">We tonen modellen die passen bij de huidige pagina.</p>
      <div id="hv-footer-models" class="taglist" aria-labelledby="hv-footer-models-label"></div>
    </section>

    <section class="footer-block">
      <p class="eyebrow">Contact</p>
      <ul class="footer-list">
        <li><strong>Auto Parts Roosendaal</strong></li>
        <li>Westelijke Havendijk 17c</li>
        <li>4703 RA Roosendaal</li>
        <li>Bel: <a href="tel:+31165856568">0165 856568</a></li>
        <li>WhatsApp: <a href="https://wa.me/31651320219" target="_blank" rel="noopener noreferrer">Direct advies</a></li>
        <li>Mail: <a href="mailto:info@auto-parts-roosendaal.nl">info@auto-parts-roosendaal.nl</a></li>
        <li>Ma-Vr 10:00-18:00</li>
        <li>Za 10:00-12:00</li>
      </ul>
    </section>
  </div>

  <div class="footer-bottom">
    <p> <span id="hv-footer-year"></span> Hulpveren.shop  MAD specialist sinds 2008</p>
    <div class="footer-links">
      <a href="/privacy">Privacy</a>
      <a href="/algemene-voorwaarden">Algemene voorwaarden</a>
      <a href="/contact">Contact</a>
    </div>
  </div>
</footer>

<script defer src="/assets/js/header.js?v=20251215_1"></script>
<script defer src="/assets/js/app.js?v=20251213a"></script>
</body>
</html>
"@

  Set-Content -Path $path -Value $html -Encoding UTF8
}
