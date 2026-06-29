/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Establish global iframe detection safely
let isSandboxIframe = false;
if (typeof window !== 'undefined') {
  try {
    isSandboxIframe = window.self !== window.top;
  } catch (e) {
    isSandboxIframe = true;
  }
}

// 1. Safe localStorage & sessionStorage Polyfills
if (typeof window !== 'undefined') {
  const testStorage = (type: 'localStorage' | 'sessionStorage') => {
    try {
      const storage = window[type];
      const testKey = `__storage_test_${type}__`;
      storage.setItem(testKey, testKey);
      storage.removeItem(testKey);
      return true;
    } catch (e) {
      return false;
    }
  };

  const createMemoryStorage = () => {
    const store: Record<string, string> = {};
    return {
      getItem(key: string): string | null {
        return key in store ? store[key] : null;
      },
      setItem(key: string, value: string): void {
        store[key] = String(value);
      },
      removeItem(key: string): void {
        delete store[key];
      },
      clear(): void {
        for (const key in store) {
          delete store[key];
        }
      },
      key(index: number): string | null {
        const keys = Object.keys(store);
        return index >= 0 && index < keys.length ? keys[index] : null;
      },
      get length(): number {
        return Object.keys(store).length;
      }
    };
  };

  if (!testStorage('localStorage')) {
    console.warn("Native localStorage is blocked or not available. Activating memory storage fallback.");
    try {
      const memoryStorage = createMemoryStorage();
      Object.defineProperty(window, 'localStorage', {
        value: memoryStorage,
        configurable: true,
        enumerable: true,
        writable: true
      });
      // Also ensure globalThis has it
      if (typeof globalThis !== 'undefined') {
        Object.defineProperty(globalThis, 'localStorage', {
          value: memoryStorage,
          configurable: true,
          enumerable: true,
          writable: true
        });
      }
    } catch (e) {
      console.error("Failed to inject memory localStorage polyfill:", e);
    }
  }

  if (!testStorage('sessionStorage')) {
    console.warn("Native sessionStorage is blocked or not available. Activating memory storage fallback.");
    try {
      const memoryStorage = createMemoryStorage();
      Object.defineProperty(window, 'sessionStorage', {
        value: memoryStorage,
        configurable: true,
        enumerable: true,
        writable: true
      });
      if (typeof globalThis !== 'undefined') {
        Object.defineProperty(globalThis, 'sessionStorage', {
          value: memoryStorage,
          configurable: true,
          enumerable: true,
          writable: true
        });
      }
    } catch (e) {
      console.error("Failed to inject memory sessionStorage polyfill:", e);
    }
  }
}

// 2. Safe Sandbox Proxies for dialogs & window.open
if (typeof window !== 'undefined') {
  // Safe window.alert
  try {
    const originalAlert = window.alert;
    window.alert = function (message) {
      console.log("[ALERT PROXY]:", message);
      if (!isSandboxIframe) {
        try {
          originalAlert.call(window, message);
        } catch (e) {
          console.warn("Failed to invoke native window.alert:", message, e);
        }
      }
    };
  } catch (e) {
    console.warn("Could not proxy window.alert:", e);
  }

  // Safe window.confirm
  try {
    const originalConfirm = window.confirm;
    window.confirm = function (message) {
      console.log("[CONFIRM PROXY]:", message);
      if (isSandboxIframe) {
        return true; // Auto-confirm inside the sandboxed iframe to allow flow to complete
      }
      try {
        return originalConfirm.call(window, message);
      } catch (e) {
        console.warn("Failed to invoke native window.confirm, defaulting to true:", message, e);
        return true;
      }
    };
  } catch (e) {
    console.warn("Could not proxy window.confirm:", e);
  }

  // Safe window.open
  try {
    const originalOpen = window.open;
    window.open = function (url, target, features) {
      console.log("[OPEN PROXY]:", url, target);
      if (isSandboxIframe) {
        return null; // Prevent popups/redirect errors inside iframe
      }
      try {
        return originalOpen.call(window, url || '', target || '', features || '');
      } catch (e) {
        console.warn("Failed to invoke native window.open:", url, e);
        return null;
      }
    };
  } catch (e) {
    console.warn("Could not proxy window.open:", e);
  }
}
