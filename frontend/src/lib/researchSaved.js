// Local persistence for Research Mode saves.
// Mirrors /lib/savedStore.js but isolated to a separate localStorage
// key so Vineyard saves never leak into Research and vice-versa.

const KEY = "research_saved_v1";

const readAll = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
};

const writeAll = (arr) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(arr));
  } catch {
    /* quota */
  }
};

export const listSaved = () => readAll();

export const isSaved = (id) => readAll().some((r) => r.id === id);

export const saveDoc = (doc) => {
  const all = readAll();
  if (all.some((r) => r.id === doc.id)) return all;
  all.unshift({
    id: doc.id,
    title: doc.title,
    url: doc.url || "",
    source: doc.source,
    entity: doc.entity,
    doc_type: doc.doc_type,
    snippet: doc.snippet || (doc.content || "").slice(0, 280),
    saved_at: new Date().toISOString(),
    note: "",
  });
  writeAll(all);
  return all;
};

export const removeSaved = (id) => {
  const all = readAll().filter((r) => r.id !== id);
  writeAll(all);
  return all;
};

export const updateNote = (id, note) => {
  const all = readAll().map((r) => (r.id === id ? { ...r, note } : r));
  writeAll(all);
  return all;
};

export const clearAll = () => writeAll([]);
