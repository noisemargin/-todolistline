// ===== Zustand 任务数据存储 =====
// 应用唯一的数据源。所有 CRUD 操作都在这里,画布只负责显示。
// persist 自动存 localStorage(刷新不丢),阶段 6 的水到渠成。

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { MIN_DAY_WIDTH, TOTAL_DAYS, buildDayGaps, normalizeDayGaps } from '../lib/dates';

/* ========== 类型定义 ========== */
export interface MainTask {
  id: string;
  title: string;
  color: string; // HSL 格式,如 "hsl(145, 55%, 60%)"
}

export interface SubTask {
  id: string;
  mainTaskId: string; // 属于哪条主线
  title: string;
  /** 计划时间,存为 UTC 毫秒。画布横向用日期,详情用时分。 */
  date: number;
  done: boolean;
  /** 画布上自由拖动的横向位置;不存时吸附到任务日期线。 */
  x?: number;
  /** 画布上自由拖动的纵向位置;不存时自动按主线行计算。 */
  y?: number;
}

type DeleteSnapshot = {
  mainTasks: MainTask[];
  subTasks: SubTask[];
};

/* ========== 颜色轮:夜航图坐标色,明度统一,只变色相 ========== */
const HUES = [194, 39, 266, 166, 328, 218, 88];
function colorForIndex(index: number): string {
  const h = HUES[index % HUES.length];
  return `hsl(${h}, 55%, 60%)`;
}

/* ========== ID 生成 ========== */
let _idSeq = 100;
function uid(): string {
  return `id-${_idSeq++}-${Date.now()}`;
}

/* ========== 构造初始日期(相对今天) ========== */
function dt(offset: number, h: number, m: number): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

/* ========== 初始假数据(仅首次加载,之后就读 localStorage) ========== */
const INIT_MAIN_TASKS: MainTask[] = [
  { id: 'm1', title: '考研英语', color: 'hsl(194, 55%, 60%)' },
  { id: 'm2', title: '毕业设计', color: 'hsl(39, 55%, 60%)' },
];

const INIT_SUB_TASKS: SubTask[] = [
  { id: 's1', mainTaskId: 'm1', title: '背单词 List1', date: dt(-2, 9, 0), done: true },
  { id: 's2', mainTaskId: 'm1', title: '阅读真题',     date: dt(0, 14, 30), done: false },
  { id: 's3', mainTaskId: 'm1', title: '写作模板',     date: dt(2, 20, 0), done: false },
  { id: 's4', mainTaskId: 'm2', title: '需求调研',     date: dt(-2, 10, 0), done: true },
  { id: 's5', mainTaskId: 'm2', title: '画原型图',     date: dt(1, 16, 15), done: false },
  { id: 's6', mainTaskId: 'm2', title: '写文献综述',   date: dt(3, 21, 30), done: false },
];

/* ========== Store 类型 ========== */
interface TaskStore {
  mainTasks: MainTask[];
  subTasks: SubTask[];
  dayGaps: number[];
  undoStack: DeleteSnapshot[];

  addMainTask: (title: string) => void;
  deleteMainTask: (id: string) => void;
  renameMainTask: (id: string, title: string) => void;

  addSubTask: (mainTaskId: string, date?: number) => void;
  deleteSubTask: (id: string) => void;
  deleteSubTasks: (ids: string[]) => void;
  renameSubTask: (id: string, title: string) => void;
  toggleSubTaskDone: (id: string) => void;
  moveSubTask: (id: string, date: number, y: number, x?: number) => void;
  resizeDateGapBefore: (dayIndex: number, deltaX: number) => void;

  canUndoDelete: () => boolean;
  undoLastDelete: () => void;
}

function pushUndo(s: TaskStore, snapshot: DeleteSnapshot): DeleteSnapshot[] {
  if (snapshot.mainTasks.length === 0 && snapshot.subTasks.length === 0) {
    return s.undoStack;
  }
  return [...s.undoStack, snapshot].slice(-12);
}

/* ========== 创建 Store ========== */
export const useTaskStore = create<TaskStore>()(
  persist(
    (set, get) => ({
      mainTasks: INIT_MAIN_TASKS,
      subTasks: INIT_SUB_TASKS,
      dayGaps: buildDayGaps(TOTAL_DAYS),
      undoStack: [] as DeleteSnapshot[],

      // ---- 主线操作 ----
      // 新建主线时,自动创建该主线的第一张卡片(排在今天),
      // 卡片标题沿用主线名,让画布上立刻能看到这条新主线。
      addMainTask: (title: string) => {
        const mainId = uid();
        const d = new Date();
        d.setHours(9, 0, 0, 0);
        set((s) => ({
          mainTasks: [...s.mainTasks, { id: mainId, title, color: colorForIndex(s.mainTasks.length) }],
          subTasks: [
            ...s.subTasks,
            { id: uid(), mainTaskId: mainId, title, date: d.getTime(), done: false },
          ],
        }));
      },
      deleteMainTask: (id: string) => {
        set((s) => {
          const removedMain = s.mainTasks.find((m) => m.id === id);
          const removedSubTasks = s.subTasks.filter((st) => st.mainTaskId === id);
          return {
            mainTasks: s.mainTasks.filter((m) => m.id !== id),
            subTasks: s.subTasks.filter((st) => st.mainTaskId !== id),
            undoStack: pushUndo(s, {
              mainTasks: removedMain ? [removedMain] : [],
              subTasks: removedSubTasks,
            }),
          };
        });
      },
      renameMainTask: (id: string, title: string) => {
        set((s) => ({
          mainTasks: s.mainTasks.map((m) => (m.id === id ? { ...m, title } : m)),
        }));
      },

      // ---- 小任务操作 ----
      addSubTask: (mainTaskId: string, date?: number) => {
        const d = date ? new Date(date) : new Date();
        if (!date) d.setHours(9, 0, 0, 0);
        set((s) => ({
          subTasks: [
            ...s.subTasks,
            { id: uid(), mainTaskId, title: '新任务', date: d.getTime(), done: false },
          ],
        }));
      },
      // 删除卡片;若删完后该主线一张卡都不剩,则连主线一起移除
      //(主线 = 它那条卡片线,没有卡片就没有主线)。
      deleteSubTask: (id: string) => {
        set((s) => {
          const target = s.subTasks.find((st) => st.id === id);
          const remaining = s.subTasks.filter((st) => st.id !== id);
          let mainTasks = s.mainTasks;
          let removedMainTasks: MainTask[] = [];
          if (target) {
            const stillHasCards = remaining.some((st) => st.mainTaskId === target.mainTaskId);
            if (!stillHasCards) {
              removedMainTasks = s.mainTasks.filter((m) => m.id === target.mainTaskId);
              mainTasks = s.mainTasks.filter((m) => m.id !== target.mainTaskId);
            }
          }
          return {
            subTasks: remaining,
            mainTasks,
            undoStack: pushUndo(s, {
              mainTasks: removedMainTasks,
              subTasks: target ? [target] : [],
            }),
          };
        });
      },
      deleteSubTasks: (ids: string[]) => {
        const idSet = new Set(ids);
        if (idSet.size === 0) return;
        set((s) => {
          const removedSubTasks = s.subTasks.filter((st) => idSet.has(st.id));
          if (removedSubTasks.length === 0) return {};

          const remainingSubTasks = s.subTasks.filter((st) => !idSet.has(st.id));
          const emptyMainIds = new Set(
            s.mainTasks
              .filter((m) => !remainingSubTasks.some((st) => st.mainTaskId === m.id))
              .map((m) => m.id),
          );
          const removedMainTasks = s.mainTasks.filter((m) => emptyMainIds.has(m.id));

          return {
            mainTasks: s.mainTasks.filter((m) => !emptyMainIds.has(m.id)),
            subTasks: remainingSubTasks,
            undoStack: pushUndo(s, {
              mainTasks: removedMainTasks,
              subTasks: removedSubTasks,
            }),
          };
        });
      },
      renameSubTask: (id: string, title: string) => {
        set((s) => ({
          subTasks: s.subTasks.map((st) => (st.id === id ? { ...st, title } : st)),
        }));
      },
      toggleSubTaskDone: (id: string) => {
        set((s) => ({
          subTasks: s.subTasks.map((st) =>
            st.id === id ? { ...st, done: !st.done } : st,
          ),
        }));
      },
      moveSubTask: (id: string, date: number, y: number, x?: number) => {
        set((s) => ({
          subTasks: s.subTasks.map((st) =>
            st.id === id ? { ...st, date, y, x } : st,
          ),
        }));
      },
      resizeDateGapBefore: (dayIndex: number, deltaX: number) => {
        if (dayIndex <= 0) return;
        set((s) => {
          const gapIndex = dayIndex - 1;
          const dayGaps = normalizeDayGaps(s.dayGaps, TOTAL_DAYS);
          dayGaps[gapIndex] = Math.max(MIN_DAY_WIDTH, dayGaps[gapIndex] + deltaX);
          return { dayGaps };
        });
      },
      canUndoDelete: (): boolean => {
        return get().undoStack.length > 0;
      },
      undoLastDelete: () => {
        set((s) => {
          const snapshot = s.undoStack.at(-1);
          if (!snapshot) return {};
          const existingMainIds = new Set(s.mainTasks.map((m) => m.id));
          const existingSubIds = new Set(s.subTasks.map((st) => st.id));

          return {
            mainTasks: [
              ...s.mainTasks,
              ...snapshot.mainTasks.filter((m) => !existingMainIds.has(m.id)),
            ],
            subTasks: [
              ...s.subTasks,
              ...snapshot.subTasks.filter((st) => !existingSubIds.has(st.id)),
            ],
            undoStack: s.undoStack.slice(0, -1),
          };
        });
      },
    }),
    {
      name: 'task-canvas-store', // localStorage key
      version: 5,
      migrate: (persisted) => {
        const state = persisted as Partial<TaskStore>;
        return {
          ...state,
          dayGaps: normalizeDayGaps(state.dayGaps, TOTAL_DAYS),
          mainTasks: (state.mainTasks ?? INIT_MAIN_TASKS).map((task, index) => ({
            ...task,
            color: colorForIndex(index),
          })),
          subTasks: state.subTasks ?? INIT_SUB_TASKS,
          undoStack: [],
        };
      },
      partialize: (state) => ({
        mainTasks: state.mainTasks,
        subTasks: state.subTasks,
        dayGaps: state.dayGaps,
      }),
    },
  ),
);
