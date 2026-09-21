import { pathToFileURL } from "node:url";

export function moduleSpecifier(path) {
  return pathToFileURL(path).href;
}
