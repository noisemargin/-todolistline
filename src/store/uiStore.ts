// ===== UI 状态(不持久化) =====
import { create } from 'zustand';

interface UIStore {
  editMode: boolean;
  toggleEditMode: () => void;
  /** 当前正在改名的卡片 ID(编辑模式单击卡片触发) */
  editingCardId: string | null;
  setEditingCardId: (id: string | null) => void;
  /** 当前框选中的卡片 ID 列表(按 Delete 可删除) */
  selectedIds: string[];
  setSelectedIds: (ids: string[]) => void;
  clearSelection: () => void;
}

export const useUIStore = create<UIStore>()((set) => ({
  editMode: false,
  toggleEditMode: () => set((s) => ({ editMode: !s.editMode, selectedIds: [] })),
  editingCardId: null,
  setEditingCardId: (id) => set({ editingCardId: id }),
  selectedIds: [],
  setSelectedIds: (ids) => set({ selectedIds: ids }),
  clearSelection: () => set({ selectedIds: [] }),
}));
