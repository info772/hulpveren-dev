import re
from pathlib import Path
import sys

ROOT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(r"C:\dev\hulpveren-dev\wwwroot")

TAG = '<script defer src="/assets/js/header.js?v=20251215_1"></script>'

APP_RE = re.compile(
    r'(<script\b[^>]*\bsrc=["\']/assets/js/app\.js[^"\']*["\'][^>]*>\s*</script>)',
    re.IGNORECASE | re.DOTALL
)
BODY_CLOSE_RE = re.compile(r"</body\s*>", re.IGNORECASE)

def has_headerjs_script(text: str) -> bool:
    tl = text.lower()
    return ('src="/assets/js/header.js' in tl) or ("src='/assets/js/header.js" in tl)

html_files = list(ROOT.rglob("*.html"))
changed = 0
skipped_has = 0
skipped_no_body = 0

for f in html_files:
    text = f.read_text(encoding="utf-8", errors="ignore")

    if has_headerjs_script(text):
        skipped_has += 1
        continue

    m_body = BODY_CLOSE_RE.search(text)
    if not m_body:
        skipped_no_body += 1
        continue

    m_app = APP_RE.search(text)
    if m_app:
        # inject vóór app.js
        new_text = text[:m_app.start()] + TAG + "\n" + text[m_app.start():]
    else:
        # inject vóór </body>
        new_text = text[:m_body.start()] + TAG + "\n" + text[m_body.start():]

    f.write_text(new_text, encoding="utf-8")
    changed += 1

print("ROOT:", ROOT)
print("HTML files scanned:", len(html_files))
print("Files changed (header.js injected):", changed)
print("Files skipped (already had header.js):", skipped_has)
print("Files skipped (no </body>):", skipped_no_body)

