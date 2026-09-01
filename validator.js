import { ToolError, ToolErrorCode } from "./errors.js";
import { DEFAULT_LIMITS } from "./limits.js";

export function validateFiles(files, config = {}) {
  const limits = { ...DEFAULT_LIMITS, ...config.limits };
  const list = Array.from(files || []);
  if (!list.length) throw new ToolError(ToolErrorCode.VALIDATION, "Please add at least one file.");
  if (list.length > limits.maxFiles) throw new ToolError(ToolErrorCode.VALIDATION, `You can add up to ${limits.maxFiles} files at a time.`);

  let total = 0;
  for (const file of list) {
    if (!(file instanceof File) || !file.size) throw new ToolError(ToolErrorCode.FILE, "One of the selected files could not be read.");
    if (file.size > limits.maxFileBytes) throw new ToolError(ToolErrorCode.RESOURCE, `${file.name} is larger than the allowed limit.`);
    total += file.size;
    if (config.accept && !fileMatches(file, config.accept)) {
      throw new ToolError(ToolErrorCode.FILE, `${file.name} is not supported by this tool.`);
    }
  }
  if (total > limits.maxTotalBytes) throw new ToolError(ToolErrorCode.RESOURCE, "The selected files exceed the total batch limit.");
  return list;
}

function fileMatches(file, accept) {
  return accept.some(rule => {
    if (rule.endsWith("/*")) return file.type.startsWith(rule.slice(0, -1));
    return file.type === rule || file.name.toLowerCase().endsWith(rule.toLowerCase());
  });
}
