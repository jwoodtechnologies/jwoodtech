// localStorage-backed saved-results store (per device, no account)
const KEY = "vineyard_saved_v1";

const read = () => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const write = (items) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* ignore quota */
  }
};

export const listSaved = () => read();

export const isSaved = (url) => read().some((s) => s.url === url);

export const saveCitation = (c) => {
  const items = read();
  if (items.some((s) => s.url === c.url)) return items;
  const entry = {
    id:
      (crypto?.randomUUID?.() || Math.random().toString(36).slice(2)) +
      "-" +
      Date.now(),
    title: c.title,
    source_label: c.source_label || "",
    url: c.url,
    pdf_url: c.pdf_url || null,
    section_ref: c.section_ref || null,
    excerpt: c.excerpt || "",
    note: "",
    label: "",
    important: false,
    saved_at: new Date().toISOString(),
  };
  const next = [entry, ...items];
  write(next);
  return next;
};

export const removeSaved = (id) => {
  const next = read().filter((s) => s.id !== id);
  write(next);
  return next;
};

export const removeByUrl = (url) => {
  const next = read().filter((s) => s.url !== url);
  write(next);
  return next;
};

export const updateSaved = (id, patch) => {
  const next = read().map((s) => (s.id === id ? { ...s, ...patch } : s));
  write(next);
  return next;
};

export const clearAll = () => {
  write([]);
  return [];
};
