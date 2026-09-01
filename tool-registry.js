export const TOOL_REGISTRY = Object.freeze({
  "compress-images": {category:"image", runtime:"client", futureApi:"/api/tools/compress-images"},
  "resize-images": {category:"image", runtime:"client", futureApi:"/api/tools/resize-images"},
  "convert-images": {category:"image", runtime:"client", futureApi:"/api/tools/convert-images"},
  "crop-rotate": {category:"image", runtime:"client", futureApi:"/api/tools/crop-rotate"},
  "images-to-pdf": {category:"pdf", runtime:"client", futureApi:"/api/tools/images-to-pdf"},
  "merge-pdf": {category:"pdf", runtime:"client", futureApi:"/api/tools/merge-pdf"},
  "split-pdf": {category:"pdf", runtime:"client", futureApi:"/api/tools/split-pdf"},
  "pdf-to-images": {category:"pdf", runtime:"client", futureApi:"/api/tools/pdf-to-images"}
});
