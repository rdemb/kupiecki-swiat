// Node also loads shared game data when running the server and tests.
export function imageUrl(filename: string): string {
  const base = import.meta.env?.BASE_URL ?? '/';
  return `${base}src/assets/images/${filename}`;
}
