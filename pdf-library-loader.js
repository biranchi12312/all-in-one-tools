const cache = new Map();

const PDFJS_VERSION = "3.11.174";
const PDFJS_BASE_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}`;
const PDFJS_SCRIPT_URL = `${PDFJS_BASE_URL}/build/pdf.min.js`;
const PDFJS_WORKER_URL = `${PDFJS_BASE_URL}/build/pdf.worker.min.js`;
const PDFJS_STANDARD_FONT_URL = `${PDFJS_BASE_URL}/standard_fonts/`;

function loadScript(url, key, timeoutMs = 20000) {
  if (cache.has(key)) return cache.get(key);

  const promise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-oriva-lib="${key}"]`);

    if (existing && window[key]) {
      resolve(window[key]);
      return;
    }

    const script = document.createElement("script");
    let timer = null;
    let settled = false;

    const cleanup = () => {
      if (timer) window.clearTimeout(timer);
      script.onload = null;
      script.onerror = null;
    };

    const fail = (message) => {
      if (settled) return;
      settled = true;
      cleanup();
      try { script.remove(); } catch (_) {}
      reject(new Error(message));
    };

    script.src = url;
    script.async = true;
    script.dataset.orivaLib = key;

    script.onload = () => {
      if (settled) return;
      if (!window[key]) {
        fail("Required PDF component loaded but did not initialize.");
        return;
      }
      settled = true;
      cleanup();
      resolve(window[key]);
    };
    script.onerror = () => fail("Required PDF component could not be loaded. Check your connection and try again.");

    timer = window.setTimeout(() => {
      fail("Required PDF component could not be loaded in time. Check your connection and try again.");
    }, timeoutMs);

    document.head.append(script);
  });

  cache.set(key, promise);
  return promise.catch(error => {
    // A failed CDN load must never poison the cache for the rest of the session.
    cache.delete(key);
    throw error;
  });
}

export async function loadPdfLib() {
  if (window.PDFLib) return window.PDFLib;

  return loadScript(
    "https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js",
    "PDFLib"
  );
}

function configurePdfJs(lib) {
  if (!lib) throw new Error("PDF component did not initialize.");
  lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
  return lib;
}

export async function loadPdfJs() {
  if (window.pdfjsLib) return configurePdfJs(window.pdfjsLib);
  return configurePdfJs(await loadScript(PDFJS_SCRIPT_URL, "pdfjsLib"));
}

export function createPdfDocumentOptions(data, extra = {}) {
  return {
    data,
    standardFontDataUrl: PDFJS_STANDARD_FONT_URL,
    // PDF.js warnings for missing optional system fonts are non-fatal, but they
    // should not pollute the app console when standard-font fallback is active.
    verbosity: 0,
    ...extra
  };
}
