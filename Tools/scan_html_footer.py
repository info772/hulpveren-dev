from pathlib import Path
import sys

ROOT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(r"C:\dev\hulpveren-dev\wwwroot")

htmls = list(ROOT.rglob("*.html"))

has_body_close = 0
has_head_close = 0
has_appjs = 0
has_headerjs = 0
has_headerjs_any = 0

samples_no_body = []
samples_no_headerjs = []
samples_ok = []

for f in htmls:
    t = f.read_text(encoding="utf-8", errors="ignore")
    tl = t.lower()

    if "</body>" in tl:
        has_body_close += 1
    else:
        if len(samples_no_body) < 10:
            samples_no_body.append(str(f))

    if "</head>" in tl:
        has_head_close += 1

    if "/assets/js/app.js" in tl:
        has_appjs += 1

    if "/assets/js/header.js" in tl:
        has_headerjs_any += 1

    # striktere check: echte script-tag
    if 'src="/assets/js/header.js' in tl or "src='/assets/js/header.js" in tl:
        has_headerjs += 1
    else:
        if len(samples_no_headerjs) < 10:
            samples_no_headerjs.append(str(f))

    if "</body>" in tl and (('src="/assets/js/header.js' in tl) or ("src='/assets/js/header.js" in tl)):
        if len(samples_ok) < 10:
            samples_ok.append(str(f))

print("ROOT:", ROOT)
print("HTML files:", len(htmls))
print("Has </head>:", has_head_close)
print("Has </body>:", has_body_close)
print("Has /assets/js/app.js:", has_appjs)
print("Has /assets/js/header.js (any substring):", has_headerjs_any)
print("Has header.js as script src:", has_headerjs)
print()
print("Sample files WITHOUT </body> (up to 10):")
for s in samples_no_body: print(" -", s)
print()
print("Sample files WITHOUT header.js script src (up to 10):")
for s in samples_no_headerjs: print(" -", s)
print()
print("Sample OK files (has </body> + header.js src) (up to 10):")
for s in samples_ok: print(" -", s)
