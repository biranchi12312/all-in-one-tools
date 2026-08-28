(function () {
  "use strict";

  const tools = Object.freeze([
    {
      id: "compressor",
      name: "Image Compressor",
      description: "Compress images with a simple, focused workflow.",
      category: "Image Tools",
      route: "compressor",
      viewId: "compressorView",
      icon: "compress",
      relatedTools: ["resize", "converter", "cropRotate"],
      helpSlug: "compress-images",
      seoPath: "/tools/compress-images/",
      seo: { title: "Compress Images Online | AuraStudio", description: "Compress supported image files with AuraStudio's focused online image compression tool." }
    },
    {
      id: "resize",
      name: "Image Resizer",
      description: "Resize images for the dimensions you need.",
      category: "Image Tools",
      route: "resize",
      viewId: "resizeView",
      icon: "resize",
      relatedTools: ["compressor", "cropRotate", "converter"],
      helpSlug: "resize-images",
      seoPath: "/tools/resize-images/",
      seo: { title: "Resize Images Online | AuraStudio", description: "Resize supported images to the dimensions you need with a focused AuraStudio workflow." }
    },
    {
      id: "cropRotate",
      name: "Crop & Rotate",
      description: "Crop, rotate and adjust image orientation in one workspace.",
      category: "Image Tools",
      route: "cropRotate",
      viewId: "cropRotateView",
      icon: "crop",
      relatedTools: ["resize", "compressor", "converter"],
      helpSlug: "crop-and-rotate",
      seoPath: "/tools/crop-rotate/",
      seo: { title: "Crop & Rotate Images Online | AuraStudio", description: "Crop, rotate and adjust image orientation with AuraStudio's focused image workspace." }
    },
    {
      id: "converter",
      name: "Image Converter",
      description: "Convert supported image files between common formats.",
      category: "Image Tools",
      route: "converter",
      viewId: "converterView",
      icon: "convert",
      relatedTools: ["compressor", "resize", "cropRotate"],
      helpSlug: "convert-images",
      seoPath: "/tools/convert-images/",
      seo: { title: "Convert Images Online | AuraStudio", description: "Convert supported image files between common formats with AuraStudio." }
    },
    {
      id: "pdfMerge",
      name: "PDF Merge",
      description: "Combine multiple PDF files into a single document.",
      category: "PDF Tools",
      route: "pdfMerge",
      viewId: "pdfMergeView",
      icon: "merge",
      relatedTools: ["pdfSplit", "pdfToImages", "imagesToPdf"],
      helpSlug: "merge-pdfs",
      seoPath: "/tools/merge-pdf/",
      seo: { title: "Merge PDF Files Online | AuraStudio", description: "Combine multiple PDF files into one document with AuraStudio's focused PDF merge tool." }
    },
    {
      id: "pdfToImages",
      name: "PDF to Images",
      description: "Convert PDF pages into image files.",
      category: "PDF Tools",
      route: "pdfToImages",
      viewId: "pdfToImagesView",
      icon: "pdf-image",
      relatedTools: ["imagesToPdf", "pdfMerge", "pdfSplit"],
      helpSlug: "pdf-to-images",
      seoPath: "/tools/pdf-to-images/",
      seo: { title: "Convert PDF to Images Online | AuraStudio", description: "Turn PDF pages into image files with AuraStudio's PDF to Images tool." }
    },
    {
      id: "imagesToPdf",
      name: "Images to PDF",
      description: "Turn selected images into a PDF document.",
      category: "PDF Tools",
      route: "imagesToPdf",
      viewId: "imagesToPdfView",
      icon: "images-pdf",
      relatedTools: ["pdfToImages", "pdfMerge", "pdfSplit"],
      helpSlug: "images-to-pdf",
      seoPath: "/tools/images-to-pdf/",
      seo: { title: "Convert Images to PDF Online | AuraStudio", description: "Combine selected images into a PDF document with AuraStudio." }
    },
    {
      id: "pdfSplit",
      name: "PDF Split",
      description: "Split a PDF into separate page ranges or files.",
      category: "PDF Tools",
      route: "pdfSplit",
      viewId: "pdfSplitView",
      icon: "split",
      relatedTools: ["pdfMerge", "pdfToImages", "imagesToPdf"],
      helpSlug: "split-pdf",
      seoPath: "/tools/split-pdf/",
      seo: { title: "Split PDF Online | AuraStudio", description: "Split a PDF into separate page ranges or files with AuraStudio's focused PDF tool." }
    }
  ]);

  const byId = Object.freeze(tools.reduce((map, tool) => {
    map[tool.id] = tool;
    return map;
  }, Object.create(null)));

  const byRoute = Object.freeze(tools.reduce((map, tool) => {
    map[tool.route] = tool;
    return map;
  }, Object.create(null)));

  function getAll() {
    return tools.slice();
  }

  function get(id) {
    return byId[id] || null;
  }

  function getByRoute(route) {
    return byRoute[route] || null;
  }

  function getRelated(id) {
    const tool = get(id);
    if (!tool) return [];
    return tool.relatedTools.map(get).filter(Boolean);
  }

  window.AuraToolRegistry = Object.freeze({
    getAll,
    get,
    getByRoute,
    getRelated,
    has: function (id) { return !!get(id); }
  });
})();
