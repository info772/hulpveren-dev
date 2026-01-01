# tools/build_hv_json.py
import argparse
import json
import re
from pathlib import Path

import pandas as pd


def fmt_month_year(v):
    """MAD gebruikt vaak 1e dag van de maand als Timestamp."""
    if pd.isna(v):
        return ""
    try:
        ts = pd.to_datetime(v)
        return f"{ts.month:02d}-{ts.year}"
    except Exception:
        s = str(v).strip()
        m = re.search(r"(\d{4})[-/](\d{1,2})", s)
        if m:
            y = int(m.group(1))
            mo = int(m.group(2))
            return f"{mo:02d}-{y}"
        return s


def split_codes(v):
    """Platform/Type codes opsplitsen: '2AB/2AD + 2AE' -> ['2AB','2AD','2AE']"""
    if pd.isna(v):
        return []
    s = str(v)
    s = re.sub(r"[\s/;+|]+", ",", s)
    parts = [p.strip() for p in s.split(",") if p.strip() and p.strip().lower() != "nan"]
    return parts


def pick_parts_ex_vat(row, vat_rate=0.21):
    """Pak parts prijs excl btw, met fallback."""
    for col in [
        "Sales price excl. VAT (retail)",
        "Sales price excl. VAT (B2B)",
    ]:
        v = row.get(col)
        if not pd.isna(v):
            try:
                return float(v)
            except Exception:
                pass

    # fallback: alleen incl btw aanwezig
    v_inc = row.get("Sales price incl. VAT (retail)")
    if not pd.isna(v_inc):
        try:
            return round(float(v_inc) / (1 + vat_rate), 2)
        except Exception:
            pass

    return None


def build_notes(row):
    bits = []

    def add(label, col):
        v = row.get(col)
        if pd.isna(v):
            return
        s = str(v).strip()
        if not s or s.lower() == "all":
            return
        bits.append(f"{label}: {s}")

    add("Engine", "Engine")
    add("Drivetrain", "Drivetrain")
    add("Rear wheels", "Rear wheels")
    add("Axle", "Axle")
    return ", ".join(bits)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True, help="MAD catalogue xlsx")
    ap.add_argument("--output", required=True, help="Output hv-kits.json")
    ap.add_argument("--sheet", default="MAD suspensionsystems catalogue")
    ap.add_argument("--minute-rate", type=float, default=1.25)
    ap.add_argument("--vat", type=float, default=0.21)
    ap.add_argument("--family-label", default="Hulpveren")
    ap.add_argument("--position-default", default="rear")
    args = ap.parse_args()

    inp = Path(args.input)
    outp = Path(args.output)
    outp.parent.mkdir(parents=True, exist_ok=True)

    df = pd.read_excel(inp, sheet_name=args.sheet)

    # Alleen HV
    hv = df[df["Group"].astype(str).str.upper() == "HV"].copy()

    kits = []

    for sku, grp in hv.groupby("Kit number"):
        grp = grp.copy()
        first = grp.iloc[0]

        parts_ex = pick_parts_ex_vat(first, vat_rate=args.vat)

        time_min = first.get("Time in Minutes (workshop)")
        try:
            time_min = float(time_min) if not pd.isna(time_min) else 0.0
        except Exception:
            time_min = 0.0

        labor_ex = round(time_min * args.minute_rate, 2)

        total_inc = None
        if parts_ex is not None:
            total_inc = round((parts_ex + labor_ex) * (1 + args.vat))

        approval = str(first.get("Approval") or "").strip()
        ean = str(first.get("EAN code") or "").strip() or None
        kind = str(first.get("Kind of kit") or "").strip()

        kit = {
            "sku": str(sku).strip(),
            "family_code": "HV",
            "family_label": args.family_label,
            "position": args.position_default,  # later per kit overschrijven als nodig
            "approval": approval,
            "ean": ean,
            "drivetrain_allowed": None,
            "rear_wheels_allowed": None,
            "kind": kind,
            "fitments": [],
            "pricing_nl": {
                "parts_ex_vat_eur": parts_ex,
                "minute_rate_eur": args.minute_rate,
                "vat_rate": args.vat,
                "mode": "add",
                "labor_time_min": time_min,
                "labor_ex_vat_min_eur": labor_ex,
                "labor_ex_vat_max_eur": labor_ex,
                "total_inc_vat_from_eur": total_inc,
            },
        }

        for _, row in grp.iterrows():
            fit = {
                "make": str(row.get("Make") or "").strip().upper(),
                "model": str(row.get("Model") or "").strip(),
                "platform_codes": split_codes(row.get("Type")),
                "remark": str(row.get("Remarks") or "").strip(),
                "year_from": fmt_month_year(row.get("Year start")),
                "year_to": fmt_month_year(row.get("Year end")),
                "notes": build_notes(row),
            }
            kit["fitments"].append(fit)

        kits.append(kit)

    payload = {"generated_from": inp.name, "kits": kits}

    with outp.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    print(f"OK: {len(kits)} HV kits -> {outp}")


if __name__ == "__main__":
    main()
