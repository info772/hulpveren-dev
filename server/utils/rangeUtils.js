function parseYM(input, defaultMonth = 1) {
  if (input == null || input === "") return null;
  if (typeof input === "object" && input.year) {
    const year = Number.parseInt(input.year, 10);
    const month = Number.parseInt(input.month, 10) || defaultMonth;
    if (!Number.isFinite(year)) return null;
    const safeMonth =
      Number.isFinite(month) && month >= 1 && month <= 12 ? month : defaultMonth;
    return { year, month: safeMonth };
  }

  const raw = String(input || "").trim();
  if (!raw) return null;

  const yearOnly = raw.match(/^(\d{4})$/);
  if (yearOnly) {
    return { year: Number.parseInt(yearOnly[1], 10), month: defaultMonth };
  }

  const yearMonth = raw.match(/^(\d{4})[\/-](\d{1,2})(?:[\/-]\d{1,2})?$/);
  if (yearMonth) {
    const year = Number.parseInt(yearMonth[1], 10);
    const month = Number.parseInt(yearMonth[2], 10);
    if (!Number.isFinite(year)) return null;
    return {
      year,
      month: month >= 1 && month <= 12 ? month : defaultMonth,
    };
  }

  const monthYear = raw.match(/^(\d{1,2})[\/-](\d{4})$/);
  if (monthYear) {
    const month = Number.parseInt(monthYear[1], 10);
    const year = Number.parseInt(monthYear[2], 10);
    if (!Number.isFinite(year)) return null;
    return {
      year,
      month: month >= 1 && month <= 12 ? month : defaultMonth,
    };
  }

  const dayMonthYear = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (dayMonthYear) {
    const month = Number.parseInt(dayMonthYear[2], 10);
    const year = Number.parseInt(dayMonthYear[3], 10);
    if (!Number.isFinite(year)) return null;
    return {
      year,
      month: month >= 1 && month <= 12 ? month : defaultMonth,
    };
  }

  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 8) {
    const year = Number.parseInt(digits.slice(0, 4), 10);
    const month = Number.parseInt(digits.slice(4, 6), 10);
    if (!Number.isFinite(year)) return null;
    return {
      year,
      month: month >= 1 && month <= 12 ? month : defaultMonth,
    };
  }
  if (digits.length >= 6) {
    const year = Number.parseInt(digits.slice(0, 4), 10);
    const month = Number.parseInt(digits.slice(4, 6), 10);
    if (!Number.isFinite(year)) return null;
    return {
      year,
      month: month >= 1 && month <= 12 ? month : defaultMonth,
    };
  }
  if (digits.length >= 4) {
    const year = Number.parseInt(digits.slice(0, 4), 10);
    return Number.isFinite(year) ? { year, month: defaultMonth } : null;
  }

  return null;
}

function toComparable(ym) {
  if (!ym || !Number.isFinite(ym.year) || !Number.isFinite(ym.month)) return null;
  return ym.year * 12 + (ym.month - 1);
}

function normalizeRange(start, end) {
  if (!start && !end) return null;
  return { start: start || null, end: end || null };
}

function parseRange(input) {
  if (input == null || input === "") return null;
  if (typeof input === "object") {
    if (input.label) {
      const viaLabel = parseRange(String(input.label));
      if (viaLabel) return viaLabel;
    }
    if (
      Object.prototype.hasOwnProperty.call(input, "start") ||
      Object.prototype.hasOwnProperty.call(input, "end")
    ) {
      const start = parseYM(input.start, 1);
      const end = parseYM(input.end, 12);
      return normalizeRange(start, end);
    }
    if (
      Object.prototype.hasOwnProperty.call(input, "from") ||
      Object.prototype.hasOwnProperty.call(input, "to")
    ) {
      const start = parseYM(input.from, 1);
      const end = parseYM(input.to, 12);
      return normalizeRange(start, end);
    }
    return null;
  }

  const raw = String(input || "").trim();
  if (!raw) return null;

  const slashParts = raw.split("/");
  if (slashParts.length >= 2) {
    const start = parseYM(slashParts[0], 1);
    const end = parseYM(slashParts[1], 12);
    return normalizeRange(start, end);
  }

  const yearRange = raw.match(/(\d{4})\s*-\s*(\d{4})/);
  if (yearRange) {
    const start = parseYM(yearRange[1], 1);
    const end = parseYM(yearRange[2], 12);
    return normalizeRange(start, end);
  }

  const singleStart = parseYM(raw, 1);
  const singleEnd = parseYM(raw, 12);
  return normalizeRange(singleStart, singleEnd);
}

function rangesOverlap(rangeA, rangeB) {
  if (!rangeA || !rangeB) return true;
  const aStart = toComparable(rangeA.start);
  const aEnd = toComparable(rangeA.end);
  const bStart = toComparable(rangeB.start);
  const bEnd = toComparable(rangeB.end);
  const left = aStart == null ? -Infinity : aStart;
  const right = aEnd == null ? Infinity : aEnd;
  const otherLeft = bStart == null ? -Infinity : bStart;
  const otherRight = bEnd == null ? Infinity : bEnd;
  return left <= otherRight && otherLeft <= right;
}

function clampRangeMax(current, maxYM) {
  if (!maxYM) return current;
  if (!current) return maxYM;
  const currentValue = toComparable(current);
  const maxValue = toComparable(maxYM);
  if (currentValue == null || maxValue == null) return current;
  return currentValue > maxValue ? maxYM : current;
}

function clampRangeMin(current, minYM) {
  if (!minYM) return current;
  if (!current) return minYM;
  const currentValue = toComparable(current);
  const minValue = toComparable(minYM);
  if (currentValue == null || minValue == null) return current;
  return currentValue < minValue ? minYM : current;
}

function clampGeneration(range, generation) {
  if (!range || !generation) return range;
  const start = range.start ? { ...range.start } : null;
  const end = range.end ? { ...range.end } : null;
  if (generation === 3) {
    const boundaryEnd = { year: 2015, month: 5 };
    return {
      start,
      end: clampRangeMax(end, boundaryEnd),
    };
  }
  if (generation === 4) {
    const boundaryStart = { year: 2015, month: 6 };
    return {
      start: clampRangeMin(start, boundaryStart),
      end,
    };
  }
  return range;
}

module.exports = {
  parseYM,
  parseRange,
  rangesOverlap,
  clampGeneration,
};
