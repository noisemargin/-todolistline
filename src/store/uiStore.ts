// ===== UI 状态(不持久化) =====
import { create } from 'zustand';

interface UIStore {
  editMode: boolean;
  toggleEditMode: () => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
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
  theme: (localStorage.getItem('task-canvas-theme') === 'light' ? 'light' : 'dark'),
  toggleTheme: () => set((s) => {
    const theme = s.theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('task-canvas-theme', theme);
    document.documentElement.dataset.theme = theme;
    return { theme };
  }),
  editingCardId: null,
  setEditingCardId: (id) => set({ editingCardId: id }),
  selectedIds: [],
  setSelectedIds: (ids) => set({ selectedIds: ids }),
  clearSelection: () => set({ selectedIds: [] }),
}));
