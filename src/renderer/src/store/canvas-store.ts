import { create } from "zustand";
import { bridge } from "./bridge";
import type { CanvasSelectionPayload } from "../../../shared/ipc";

interface CanvasState {
  readonly selection: CanvasSelectionPayload | null;
  readonly lastSource: "canvas" | "tree" | "programmatic";
  setSelection: (payload: CanvasSelectionPayload | null) => void;
  selectBySelector: (selector: string) => void;
  subscribe: () => () => void;
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  selection: null,
  lastSource: "canvas",
  setSelection: (payload) => {
    set({
      selection: payload,
      lastSource: payload?.source ?? get().lastSource,
    });
  },
  selectBySelector: (selector: string) => {
    const api = bridge();
    if (!api?.selectCanvasElement) return;
    set({ lastSource: "tree" });
    api.selectCanvasElement(selector, "tree");
  },
  subscribe: () => {
    const api = bridge();
    if (!api?.onCanvasSelection) return () => undefined;
    return api.onCanvasSelection((payload) => {
      const src = payload.source ?? "canvas";
      // Avoid ping-pong: if we just initiated from tree, still accept once; we track lastSource
      set({ selection: { ...payload, source: src }, lastSource: src });
    });
  },
}));
