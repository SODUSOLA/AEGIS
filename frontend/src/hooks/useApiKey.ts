import { useState, useCallback } from "react";

const API_KEY_STORAGE_KEY = "aegis-api-key";

export function useApiKey() {
  const [apiKey, setApiKeyState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(API_KEY_STORAGE_KEY);
    } catch {
      return null;
    }
  });

  const setApiKey = useCallback((key: string) => {
    try {
      localStorage.setItem(API_KEY_STORAGE_KEY, key);
    } catch {}
    setApiKeyState(key);
  }, []);

  const clearApiKey = useCallback(() => {
    try {
      localStorage.removeItem(API_KEY_STORAGE_KEY);
    } catch {}
    setApiKeyState(null);
  }, []);

  const maskedKey = apiKey
    ? apiKey.slice(0, 12) + "\u2022".repeat(16) + apiKey.slice(-4)
    : null;

  return { apiKey, setApiKey, clearApiKey, maskedKey };
}
