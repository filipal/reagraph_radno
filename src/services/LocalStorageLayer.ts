/**
 * Sloj za pohranu JSON podataka u localStorage.
 * Koristi se za privremeno spremanje izmijenjenih podataka iz grafa.
 */
export const LocalStorageLayer = {
  saveJSON: (key: string, data: object) => {
    try {
      const json = JSON.stringify(data);
      localStorage.setItem(key, json);
    } catch (error) {
      console.error('Error saving JSON to localStorage:', error);
    }
  },

  loadJSON: (key: string): string | null => {
    try {
      const json = localStorage.getItem(key);
      return json ? JSON.parse(json) : null;
    } catch (error) {
      console.error('Error loading JSON from localStorage:', error);
      return null;
    }
  },

  deleteJSON: (key: string) => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Error deleting JSON from localStorage:', error);
    }
  },

  listAllKeys: (): string[] => {
    return Object.keys(localStorage);
  }
};
