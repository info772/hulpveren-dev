function summarize(findings) {
  const counts = { INFO: 0, WARN: 0, ERROR: 0 };
  findings.forEach((f) => {
    counts[f.severity] = (counts[f.severity] || 0) + 1;
  });
  return counts;
}

function topErrors(findings, limit = 20) {
  return findings.filter((f) => f.severity === "ERROR").slice(0, limit);
}

function mostCommonCodes(findings, limit = 10) {
  const map = new Map();
  findings.forEach((f) => {
    map.set(f.code, (map.get(f.code) || 0) + 1);
  });
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([code, count]) => ({ code, count }));
}

function renderReportMd({ findings, sources, suffixStats }) {
  const s = suffixStats.suffix || suffixStats;
  const counts = summarize(findings);
  const errors = topErrors(findings);
  const common = mostCommonCodes(findings);
  const contradictions = findings.filter((f) =>
    ["L101_MAD_SUFFIX_APPLICATION_CONTRADICTION", "L102_SD_INCLUDESFSD_CONTRADICTION"].includes(f.code)
  );

  const lines = [];
  lines.push("# Data quality report");
  lines.push("");
  lines.push(`- INFO: ${counts.INFO || 0}`);
  lines.push(`- WARN: ${counts.WARN || 0}`);
  lines.push(`- ERROR: ${counts.ERROR || 0}`);
  lines.push("");

  lines.push("## Top ERROR findings");
  if (!errors.length) {
    lines.push("Geen ERRORs.");
  } else {
    errors.forEach((f) => {
      lines.push(`- [${f.code}] ${f.message} (source: ${f.sourceFile}${f.recordId ? `, record: ${f.recordId}` : ""})`);
    });
  }
  lines.push("");

  lines.push("## Meest voorkomende codes");
  common.forEach((c) => lines.push(`- ${c.code}: ${c.count}`));
  lines.push("");

  lines.push("## Ontdekte bronnen");
  sources.forEach((s) => lines.push(`- ${s.type || "unknown"} — ${s.path}`));
  lines.push("");

  lines.push("## MAD suffix compliance");
  lines.push(`- Totaal HV/SD parsed: ${s.total}`);
  lines.push(`  - HV: ${s.hv}, SD: ${s.sd}`);
  lines.push(
    `  - Suffix verdeling: ${Object.entries(s.counts || {})

      .map(([k, v]) => `${k}:${v}`)
      .join(", ")}`
  );
  if (contradictions.length) {
    lines.push("- Conflicten:");
    contradictions.forEach((f) => lines.push(`  - ${f.recordId || ""} (${f.sourceFile}): ${f.message}`));
  } else {
    lines.push("- Geen MAD-conflicten.");
  }
  lines.push("");

  lines.push("## Next actions");
  lines.push("- Repareer ERRORs eerst; WARN zijn niet blokkerend maar wel oppakken.");
  lines.push("- Bekijk afgeleide velden in `out/derived` voor controle.");

  return lines.join("\n");
}

module.exports = { renderReportMd };
