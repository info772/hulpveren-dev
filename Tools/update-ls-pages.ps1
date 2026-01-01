$ErrorActionPreference = "Stop"

function Normalize-Slug {
  param($text)
  if (-not $text) { return "" }
  $s = $text.ToLower()
  $replacements = @{
    "ä"="a"; "ö"="o"; "ü"="u"; "é"="e"; "è"="e"; "ê"="e"; "ë"="e"; "ï"="i"
    "á"="a"; "à"="a"; "â"="a"; "ç"="c"; "ñ"="n"; "ô"="o"; "ó"="o"; "ò"="o"
    "š"="s"; "ž"="z"; "ý"="y"; "ÿ"="y"; "í"="i"; "ì"="i"; "î"="i"; "ø"="o"
    "ú"="u"; "ù"="u"; "û"="u"
  }
  foreach ($k in $replacements.Keys) { $s = $s.Replace($k, $replacements[$k]) }
  $s = [regex]::Replace($s, "[^a-z0-9]+", "-")
  return $s.Trim("-")
}

function Get-YearPart {
  param($val)
  if (-not $val) { return $null }
  $m = [regex]::Match($val, "\d{4}")
  if ($m.Success) { return $m.Value }
  return $val
}

function Get-YearRange {
  param($from,$to)
  $y1 = Get-YearPart $from
  $y2 = Get-YearPart $to
  if ($y1 -and $y2) {
    if ($y1 -eq $y2) { return $y1 }
    return "$y1-$y2"
  }
  if ($y1) { return "$y1-" }
  if ($y2) { return "-$y2" }
  return "Onbekend"
}

function Get-YearNumber {
  param($val)
  $y = Get-YearPart $val
  if ($y) {
    try { return [int]$y } catch { return $null }
  }
  return $null
}

function Get-EngineText {
  param($fit)
  if (-not $fit) { return "" }
  $eng = ""
  if ($fit.engines) {
    if ($fit.engines -is [System.Array]) { $eng = ($fit.engines -join ", ") }
    else { $eng = [string]$fit.engines }
  }
  if (-not $eng -and $fit.engine_raw) { $eng = [string]$fit.engine_raw }
  if (-not $eng -and $fit.notes) {
    $eng = [string]$fit.notes
    $eng = $eng -replace "^Engine:\\s*", ""
  }
  return ($eng.Trim())
}

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

function Get-SetText {
  param($count,$pos)
  if ($count -le 2) { return "2 veren ($pos)" }
  return "4 veren (voor+achter)"
}

function Get-ImageSrc {
  param($images,$count)
  $fallback = "LS-4"
  if ($count -le 2) { $fallback = "LS-2" }

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

$ls = Get-Content "wwwroot\data\ls-kits.json" -Raw | ConvertFrom-Json
$map = @{}
foreach ($kit in $ls.kits) {
  $approval = "Op aanvraag"
  if ($kit.approval_nl -and $kit.approval_nl.Trim() -ne "") { $approval = $kit.approval_nl }
  elseif ($kit.approval -and $kit.approval.Trim() -ne "") { $approval = $kit.approval }
  $approval = Format-Approval $approval

  $front = $null; if ($kit.suspension_delta_mm -and $null -ne $kit.suspension_delta_mm.front_mm) { $front = $kit.suspension_delta_mm.front_mm }
  $rear = $null; if ($kit.suspension_delta_mm -and $null -ne $kit.suspension_delta_mm.rear_mm) { $rear = $kit.suspension_delta_mm.rear_mm }
  $price = $kit.pricing_nl.total_inc_vat_from_eur
  $pos = "both"; if ($kit.position) { $pos = $kit.position }

  foreach ($fit in $kit.fitments) {
    $makeSlug = Normalize-Slug $fit.make
    $modelSlug = Normalize-Slug $fit.model
    if (-not $makeSlug -or -not $modelSlug) { continue }
    $key = "$makeSlug|$modelSlug"
    if (-not $map.ContainsKey($key)) { $map[$key] = @() }
    $years = Get-YearRange $fit.year_from $fit.year_to
    $yearFromNum = Get-YearNumber $fit.year_from
    $yearToNum = Get-YearNumber $fit.year_to
    $drop = Get-DropText $front $rear
    $posText = "Voor- en achteras"; $setCount = 4
    if ($pos -eq "front") { $posText = "Vooras"; $setCount = 2 }
    elseif ($pos -eq "rear") { $posText = "Achteras"; $setCount = 2 }
    $setText = Get-SetText $setCount $posText
    $priceLabel = Get-PriceLabel $price
    $imgSrc = Get-ImageSrc $kit.images $setCount
    $engineText = Get-EngineText $fit

    $map[$key] += ,(@{
      sku = $kit.sku
      make = $fit.make
      model = $fit.model
      years = $years
      drop = $drop
      posText = $posText
      setText = $setText
      posKey = $pos
      approval = $approval
      price = $priceLabel
      img = $imgSrc
      front = $front
      rear = $rear
      yearFrom = $yearFromNum
      yearTo = $yearToNum
      setCount = $setCount
      engine = $engineText
    })
  }
}

$pages = Get-ChildItem "wwwroot\verlagingsveren" -Filter "index.html" -Recurse
foreach ($page in $pages) {
  $modelDir = Split-Path $page.FullName -Parent
  $makeDir = Split-Path $modelDir -Parent
  $modelSlug = Split-Path $modelDir -Leaf
  $makeSlug = Split-Path $makeDir -Leaf
  $key = "$makeSlug|$modelSlug"
  if (-not $map.ContainsKey($key)) { continue }

  $cards = @()
  foreach ($item in $map[$key]) {
    $engineDisplay = $item.engine
    if (-not $engineDisplay) { $engineDisplay = "Op aanvraag" }
    $cards += @"
        <article class="card product" data-year-from="$($item.yearFrom)" data-year-to="$($item.yearTo)" data-drop-front="$($item.front)" data-drop-rear="$($item.rear)" data-pos="$($item.posKey)" data-setcount="$($item.setCount)" data-engine="$($item.engine -replace '"','&quot;')">
          <div class="img">
            <img src="$($item.img)" alt="Verlagingsveren $($item.make) $($item.model)" loading="lazy" />
            <div class="badge">Inclusief montage</div>
          </div>
          <div class="body">
            <div class="sku">$($item.sku)</div>
            <div class="meta">
              <div class="k">Bouwjaren</div><div class="v">$($item.years)</div>
              <div class="k">Verlaging</div><div class="v">$($item.drop)</div>
              <div class="k">Positie</div><div class="v">$($item.posText)</div>
              <div class="k">Set</div><div class="v">$($item.setText)</div>
              <div class="k">Motor</div><div class="v">$engineDisplay</div>
              <div class="k">Goedkeuring</div><div class="v">$($item.approval)</div>
            </div>
            <div class="chips">
              <span class="chip support">Montage &amp; uitlijning</span>
              <span class="chip">$($item.price)</span>
            </div>
            <div class="cta-row">
              <a class="btn btn-ghost" href="/verlagingsveren/$($item.sku.ToLower())/">Bekijk set</a>
              <a class="btn" href="/contact?onderwerp=ls-$makeSlug-$modelSlug">Plan mijn set</a>
            </div>
          </div>
        </article>
"@
  }

  if ($cards.Count -eq 0) { continue }
  $cardsBlock = [string]::Join("`n", $cards)
  $html = Get-Content $page.FullName -Raw
  $filterBlock = @"
      <div class="filters ls-filters" style="display:flex;flex-wrap:wrap;gap:10px;margin:0 0 16px 0;">
        <div class="grp" style="display:flex;gap:6px;align-items:center;border:1px solid #e4e7ec;padding:8px 10px;border-radius:10px;">
          <span class="muted">Bouwjaar van</span>
          <input type="number" id="ls-year-from" placeholder="van" style="width:90px;padding:6px 8px;">
          <span class="muted">t/m</span>
          <input type="number" id="ls-year-to" placeholder="tot" style="width:90px;padding:6px 8px;">
        </div>
        <div class="grp" style="display:flex;gap:10px;align-items:center;border:1px solid #e4e7ec;padding:8px 10px;border-radius:10px;">
          <span class="muted">Bouwjaar</span>
          <input type="range" id="ls-year-slider" min="1990" max="2025" value="0" style="width:180px;">
          <span class="muted" id="ls-year-label">Alle</span>
        </div>
        <div class="grp" style="display:flex;gap:6px;align-items:center;border:1px solid #e4e7ec;padding:8px 10px;border-radius:10px;">
          <span class="muted">Min. verlaging</span>
          <input type="number" id="ls-drop-front" placeholder="voor (mm)" style="width:100px;padding:6px 8px;">
          <input type="number" id="ls-drop-rear" placeholder="achter (mm)" style="width:100px;padding:6px 8px;">
        </div>
        <div class="grp" style="display:flex;gap:6px;align-items:center;border:1px solid #e4e7ec;padding:8px 10px;border-radius:10px;">
          <span class="muted">Motor</span>
          <input type="text" id="ls-engine" placeholder="bijv. diesel, hybrid, 2.0" style="width:180px;padding:6px 8px;">
        </div>
        <div class="grp" style="display:flex;gap:6px;align-items:center;border:1px solid #e4e7ec;padding:8px 10px;border-radius:10px;flex-wrap:wrap;">
          <span class="muted">As</span>
          <label><input type="checkbox" class="ls-pos" value="front"> Voor</label>
          <label><input type="checkbox" class="ls-pos" value="rear"> Achter</label>
          <label><input type="checkbox" class="ls-pos" value="both"> Voor+achter</label>
        </div>
        <div class="grp" style="display:flex;gap:6px;align-items:center;border:1px solid #e4e7ec;padding:8px 10px;border-radius:10px;">
          <button id="ls-apply" class="btn" type="button" style="padding:8px 10px;">Filter</button>
          <button id="ls-reset" class="btn btn-ghost" type="button" style="padding:8px 10px;">Reset</button>
          <span class="muted">Resultaten: <span id="ls-count"></span></span>
        </div>
      </div>
"@

  $newGrid = "<div class=""filters-wrap"">$filterBlock</div><div class=""grid"" id=""ls-grid"">`n$cardsBlock`n      </div>`n      <script>(function(){
  const grid=document.getElementById('ls-grid');
  if(!grid) return;
  const cards=Array.prototype.slice.call(grid.querySelectorAll('.card.product'));
  const yearFrom=document.getElementById('ls-year-from');
  const yearTo=document.getElementById('ls-year-to');
  const yearSlider=document.getElementById('ls-year-slider');
  const yearLabel=document.getElementById('ls-year-label');
  const dropFront=document.getElementById('ls-drop-front');
  const dropRear=document.getElementById('ls-drop-rear');
  const engineInput=document.getElementById('ls-engine');
  const posBoxes=Array.prototype.slice.call(document.querySelectorAll('.ls-pos'));
  const countEl=document.getElementById('ls-count');
  function num(v){var n=parseInt(v,10);return isNaN(n)?null:n;}
  (function initYearSlider(){
    if(!yearSlider||!cards.length) return;
    var ys=[],ye=[];
    cards.forEach(function(c){
      var a=num(c.dataset.yearFrom); var b=num(c.dataset.yearTo);
      if(a!==null) ys.push(a);
      if(b!==null) ye.push(b);
    });
    var min=Math.min.apply(null, ys.length?ys:[1990]);
    var max=Math.max.apply(null, ye.length?ye:ys.length?ys:[new Date().getFullYear()]);
    if(!isFinite(min)||!isFinite(max)) { min=1990; max=new Date().getFullYear(); }
    yearSlider.min=min; yearSlider.max=max; yearSlider.value=0;
    if(yearLabel) { yearLabel.textContent='Alle'; }
    yearSlider.addEventListener('input', function(){
      var v=num(yearSlider.value);
      if(v===0){ if(yearLabel) { yearLabel.textContent='Alle'; } }
      else { if(yearLabel) { yearLabel.textContent=String(v); } }
    });
  })();

  function match(card){
    var yf=num(yearFrom&&yearFrom.value);
    var yt=num(yearTo&&yearTo.value);
    var ys=num(yearSlider&&yearSlider.value);
    if(ys===0) ys=null;
    var df=num(dropFront&&dropFront.value);
    var dr=num(dropRear&&dropRear.value);
    var eng=(engineInput&&engineInput.value||'').toLowerCase().trim();
    var cy1=num(card.dataset.yearFrom);
    var cy2=num(card.dataset.yearTo);
    var cf=num(card.dataset.dropFront);
    var cr=num(card.dataset.dropRear);
    var ce=(card.dataset.engine||'').toLowerCase();
    var posSel=posBoxes.filter(function(b){return b.checked;}).map(function(b){return b.value;});
    var cardPos=(card.dataset.pos||'').toLowerCase();
    if(yf!==null && cy2!==null && yf>cy2) return false;
    if(yt!==null && cy1!==null && yt<cy1) return false;
    if(ys!==null){
      if(cy1!==null && ys<cy1) return false;
      if(cy2!==null && ys>cy2) return false;
    }
    if(df!==null){ if(cf===null || cf<df) return false; }
    if(dr!==null){ if(cr===null || cr<dr) return false; }
    if(eng){ if(!ce || ce.indexOf(eng)===-1) return false; }
    if(posSel.length){ if(posSel.indexOf(cardPos)===-1) return false; }
    return true;
  }
  function apply(){
    var visible=0;
    cards.forEach(function(c){
      var ok=match(c);
      c.style.display=ok?'':'none';
      if(ok) visible++;
    });
    if(countEl) countEl.textContent=String(visible);
  }
  var applyBtn=document.getElementById('ls-apply');
  var resetBtn=document.getElementById('ls-reset');
  if(applyBtn) applyBtn.addEventListener('click', apply);
  if(resetBtn) resetBtn.addEventListener('click', function(){
    if(yearFrom) yearFrom.value='';
    if(yearTo) yearTo.value='';
    if(yearSlider){ yearSlider.value=0; if(yearLabel) yearLabel.textContent='Alle'; }
    if(dropFront) dropFront.value='';
    if(dropRear) dropRear.value='';
    if(engineInput) engineInput.value='';
    posBoxes.forEach(function(b){ b.checked=false; });
    apply();
  });
  apply();
})();</script>`n    </section>"
  $pattern = '(?s)<div class="filters-wrap">.*?<div class="grid" id="ls-grid">.*?</div>.*?</section>'
  $newHtml = [regex]::Replace($html, $pattern, $newGrid)
  Set-Content -Path $page.FullName -Value $newHtml -Encoding UTF8
}
