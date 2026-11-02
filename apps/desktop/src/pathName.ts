/** Display a folder name from either Windows or POSIX paths. */
export function pathName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? path;
}
