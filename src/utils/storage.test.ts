import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getSettings, saveSettings } from './storage';

const createLocalStorage = () => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  } as Storage;
};

describe('Settings storage', () => {
  it('includes a music toggle by default', () => {
    globalThis.localStorage = createLocalStorage();
    const settings = getSettings();
    assert.equal(settings.music, true);
    assert.equal(settings.musicVolume, 85);
    assert.equal(settings.soundVolume, 80);
  });

  it('persists the music toggle', () => {
    globalThis.localStorage = createLocalStorage();
    const updated = saveSettings({ music: false });
    assert.equal(updated.music, false);
    assert.equal(getSettings().music, false);
  });

  it('persists independent music and effects volumes', () => {
    globalThis.localStorage = createLocalStorage();
    saveSettings({ musicVolume: 42, soundVolume: 67 });
    assert.equal(getSettings().musicVolume, 42);
    assert.equal(getSettings().soundVolume, 67);
  });

  it('clamps saved volumes to the supported range', () => {
    globalThis.localStorage = createLocalStorage();
    localStorage.setItem('miniplay_settings', JSON.stringify({ musicVolume: 120, soundVolume: -10 }));
    const settings = getSettings();
    assert.equal(settings.musicVolume, 100);
    assert.equal(settings.soundVolume, 0);
  });
});
