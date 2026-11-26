// Pages and the standalone build use the same client with different origins.
const origin = import.meta.env.VITE_GAME_SERVER_ORIGIN || window.location.origin;

export function gameRequest(path: string, options?: RequestInit) {
  return fetch(new URL(path, origin), options);
}

export function gameSocketUrl() {
  const url = new URL('/ws', origin);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.href;
}
