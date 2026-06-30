import { useEffect, useState } from "react";

const STORAGE_KEY = "diagram-tool-draft";

export interface DraftState {
  engine: string;
  version: string;
  code: string;
}

export function useDraftPersistence(initialState: DraftState) {
  const [state, setState] = useState<DraftState>(() => {
    // initialState 此處應該已經包含了 ?s= 解析結果（如果有）或是預設值
    // 這個 hook 內部只負責：如果 URL 沒有分享參數，且 localStorage 有資料，才覆蓋
    // 但為了簡化邏輯，較好的作法是由外部 (App.tsx) 決定最初的 initial state
    return initialState;
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        // ignore
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [state]);

  return [state, setState] as const;
}

// 輔助函式：讓外部讀取草稿
export function getDraftState(): DraftState | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}
