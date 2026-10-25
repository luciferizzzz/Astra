import { create } from "zustand";
import { bridge } from "./bridge";
import type { CanvasSelectionPayload } from "../../../shared/ipc";

interface CanvasState {
  readonly selection: CanvasSelectionPayload | null;
  subscribe: () => () => void;
}

export const useCanvasStore = create<CanvasState>((set) => ({
  selection: null,
  subscribe: () => {
    const api = bridge();
    if (!api?.onCanvasSelection) return () => undefined;
    return api.onCanvasSelection((payload) => {
      set({ selection: payload });
    });
  },
}));
