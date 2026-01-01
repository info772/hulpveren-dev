import re
from pathlib import Path
import sys

# Gebruik argument als root, anders default naar jouw IIS wwwroot
ROOT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(r"C:\hosting\websites\dev.hulpveren.shop\wwwroot")

SCRIPT_RE = re.compile(
    r"<script\b[^>]*>\s*(?:(?!</script>).)*?\bconst\s+MEGA_CFG\s*=\s*\{(?:(?!</script>).)*?</script>",
    re.IGNORECASE | re.DOTALL,
)

html_files = list(ROOT.rglob("*.html"))
changed = 0
removed_total = 0

for f in html_files:
    text = f.read_text(encoding="utf-8", errors="ignore")
    matches = list(SCRIPT_RE.finditer(text))
    if not matches:
        continue

    new_text, n = SCRIPT_RE.subn("", text)
    if n:
        new_text = re.sub(r"\n{4,}", "\n\n\n", new_text)
        f.write_text(new_text, encoding="utf-8")
        changed += 1
        removed_total += n

print(f"ROOT: {ROOT}")
print(f"HTML files scanned: {len(html_files)}")
print(f"Files changed: {changed}")
print(f"Inline mega scripts removed: {removed_total}")

