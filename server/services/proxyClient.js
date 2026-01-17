const fetch = require("node-fetch");
const { XMLParser } = require("fast-xml-parser");

const BASE_URL = (process.env.PROXYV7_BASE || "http://proxyv7.easycarparts.nl").replace(
  /\/+$/,
  ""
);
const DEFAULT_TIMEOUT_MS = Number.parseInt(process.env.PROXY_TIMEOUT_MS || "8000", 10);

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  parseTagValue: true,
  trimValues: true,
});

class UpstreamError extends Error {
  constructor(message, status, upstreamMs, code) {
    super(message);
    this.name = "UpstreamError";
    this.status = status;
    this.upstreamMs = upstreamMs;
    this.code = code || "UPSTREAM_ERROR";
  }
}

function buildUrl(path) {
  return new URL(path, BASE_URL).toString();
}

async function fetchWithTimeout(url, options, timeoutMs, retries) {
  let attempt = 0;
  while (true) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      return res;
    } catch (err) {
      clearTimeout(timeoutId);
      attempt += 1;
      if (attempt > retries) throw err;
    }
  }
}

async function requestText(path, opts = {}) {
  const url = buildUrl(path);
  const start = Date.now();
  let res;
  const headers = Object.assign(
    {
      "user-agent": "Mozilla/5.0",
      accept: "*/*",
    },
    opts.headers || {}
  );
  try {
    res = await fetchWithTimeout(
      url,
      { method: "GET", headers },
      DEFAULT_TIMEOUT_MS,
      1
    );
  } catch (err) {
    err.upstreamMs = Date.now() - start;
    err.code = err.name === "AbortError" ? "UPSTREAM_TIMEOUT" : "UPSTREAM_NETWORK";
    throw err;
  }

  const text = await res.text();
  const upstreamMs = Date.now() - start;
  if (!res.ok && !opts.allowNonOk) {
    throw new UpstreamError(`Upstream status ${res.status}`, res.status, upstreamMs);
  }

  return {
    text,
    upstreamMs,
    status: res.status,
    contentType: res.headers.get("content-type") || "",
    url,
  };
}

function toInt(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "object") return null;
  const num = Number.parseInt(value, 10);
  return Number.isNaN(num) ? null : num;
}

function toText(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "object") return null;
  return String(value);
}

function getRootObject(parsed) {
  if (!parsed || typeof parsed !== "object") return {};
  if (parsed.SingleTypes) return parsed.SingleTypes;
  const keys = Object.keys(parsed);
  return keys.length ? parsed[keys[0]] : parsed;
}

function parseSingleTypes(xmlText) {
  const parsed = xmlParser.parse(xmlText);
  const root = getRootObject(parsed);
  const typesContainer = root.singletypes || root.singleTypes || root.SingleType || {};
  const typesNode = typesContainer.SingleType || typesContainer.singleType || typesContainer;
  const list = Array.isArray(typesNode) ? typesNode : typesNode ? [typesNode] : [];
  const error =
    toText(root.error) ||
    toText(root.Error) ||
    toText(root?.errors?.error) ||
    toText(root?.errors?.Error);
  const message = toText(root.message) || toText(root.Message);

  const candidates = list.map((item) => ({
    makeCode: toInt(item.makecode),
    make: item.makename || null,
    modelCode: toInt(item.modelcode),
    model: item.modelname || null,
    modelRemark: item.model_remark || null,
    bodyType: item.bodytype || null,
    typeCode: toInt(item.typecode),
    type: item.typename || null,
    typeRemark: item.type_remark || null,
    fuelCode: toInt(item.fuelcode),
    engineType: item.enginetype || null,
    kw: toInt(item.kw),
    kwCat: toInt(item.kw_cat),
    groupType: toInt(item.grouptype),
    ktyp: toInt(item.ktyp),
    driveType: item.drivetype || null,
    engineContents: toInt(item.engine_contents),
    cylinders: toInt(item.nocyl),
    typeFrom: toInt(item.type_from),
    typeTill: toInt(item.type_till),
  }));

  return {
    message,
    error,
    candidates,
  };
}

async function getTypesByLicenseplateNL(plate) {
  const { text, upstreamMs } = await requestText(
    `/mmt.ashx?operation=GetTypesByLicenseplateNL&plate=${encodeURIComponent(plate)}`
  );
  let parsed;
  try {
    parsed = parseSingleTypes(text);
  } catch (err) {
    return {
      candidates: [],
      message: null,
      error: "parse_error",
      raw: text,
      upstreamMs,
    };
  }
  return {
    candidates: parsed.candidates,
    message: parsed.message,
    error: parsed.error,
    raw: text,
    upstreamMs,
  };
}

async function getMenu() {
  const { text, upstreamMs } = await requestText("/PartServices/api/Menu/");
  let data;
  try {
    data = JSON.parse(text);
  } catch (err) {
    throw new UpstreamError("Invalid JSON from upstream", 502, upstreamMs, "UPSTREAM_BAD_JSON");
  }
  return { data, raw: text, upstreamMs };
}

async function getMenuParts(rootId, nodeId) {
  const { text, upstreamMs } = await requestText(
    `/PartServices/api/Menuparts/${rootId}/${nodeId}`
  );
  let data;
  try {
    data = JSON.parse(text);
  } catch (err) {
    throw new UpstreamError("Invalid JSON from upstream", 502, upstreamMs, "UPSTREAM_BAD_JSON");
  }
  return { data, raw: text, upstreamMs };
}

module.exports = {
  getTypesByLicenseplateNL,
  getMenu,
  getMenuParts,
  requestText,
  UpstreamError,
};
