const SAVE_KEY = 'ism_save_v1';
const SAVE_VERSION = 1;

export function hasSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    return data && data.version === SAVE_VERSION && !!data.dreamer;
  } catch {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== SAVE_VERSION) return null;
    if (!data.dreamer || !data.chapter || !data.position) return null;
    return data;
  } catch {
    return null;
  }
}

export function newSave(dreamer) {
  return {
    version: SAVE_VERSION,
    dreamer,
    chapter: 'atrium',
    position: { x: 0, y: 1.6, z: 6 },
    yaw: 0,
    inventory: [],
    journals: [],
    memoryCats: [],
    dreamTracks: [],
    tvSeen: [],
    doorState: {},
    createdAt: Date.now()
  };
}

export function writeSave(state) {
  state.version = SAVE_VERSION;
  state.savedAt = Date.now();
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

export function clearSave() {
  localStorage.removeItem(SAVE_KEY);
}
