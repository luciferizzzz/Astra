import { create } from "zustand";
import { bridge } from "./bridge";
import type { CanvasTreePayload } from "../../../shared/ipc";

interface CanvasTreeState {
  readonly tree: CanvasTreePayload | null;
  readonly loading: boolean;
  refresh: () => Promise<void>;
}

export const useCanvasTreeStore = create<CanvasTreeState>((set) => ({
  tree: null,
  loading: false,
  refresh: async () => {
    const api = bridge();
    if (!api?.getCanvasTree) return;
    set({ loading: true });
    try {
      const tree = await api.getCanvasTree();
      set({ tree, loading: false });
    } catch {
      set({ loading: false });
    }
  },
}));
