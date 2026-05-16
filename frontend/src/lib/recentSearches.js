// localStorage-backed recent searches (last 8 distinct queries)
const KEY = "vineyard_recent_searches_v1";
const MAX = 8;

const read = () => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const write = (list) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* ignore quota */
  }
};

export const listRecent = () => read();

export const pushRecent = (query) => {
  const q = (query || "").trim();
  if (!q) return read();
  const items = read().filter((x) => x.q.toLowerCase() !== q.toLowerCase());
  const next = [{ q, at: new Date().toISOString() }, ...items].slice(0, MAX);
  write(next);
  return next;
};

export const clearRecent = () => {
  write([]);
  return [];
};
