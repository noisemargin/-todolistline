// ===== Zustand 任务数据存储 =====
// 应用唯一的数据源。所有 CRUD 操作都在这里,画布只负责显示。
// persist 自动存 localStorage(刷新不丢),阶段 6 的水到渠成。

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
  /** 画布上自由拖动的纵向位置;不存时自动按主线行计算。 */
  y?: number;
}

/* ========== 颜色轮:HSL 明度统一,只变色相 ========== */
const HUES = [145, 215, 275, 35, 355, 185, 305];
let _colorIdx = 0;
function nextColor(): string {
  const h = HUES[_colorIdx % HUES.length];
  _colorIdx++;
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
  { id: 'm1', title: '考研英语', color: 'hsl(145, 55%, 60%)' },
  { id: 'm2', title: '毕业设计', color: 'hsl(215, 55%, 60%)' },
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

  addMainTask: (title: string) => void;
  deleteMainTask: (id: string) => void;
  renameMainTask: (id: string, title: string) => void;

  addSubTask: (mainTaskId: string, date?: number) => void;
  deleteSubTask: (id: string) => void;
  renameSubTask: (id: string, title: string) => void;
  toggleSubTaskDone: (id: string) => void;
  moveSubTask: (id: string, date: number, y: number) => void;
}

/* ========== 创建 Store ========== */
export const useTaskStore = create<TaskStore>()(
  persist(
    (set) => ({
      mainTasks: INIT_MAIN_TASKS,
      subTasks: INIT_SUB_TASKS,

      // ---- 主线操作 ----
      // 新建主线时,自动创建该主线的第一张卡片(排在今天),
      // 卡片标题沿用主线名,让画布上立刻能看到这条新主线。
      addMainTask: (title: string) => {
        const mainId = uid();
        const d = new Date();
        d.setHours(9, 0, 0, 0);
        set((s) => ({
          mainTasks: [...s.mainTasks, { id: mainId, title, color: nextColor() }],
          subTasks: [
            ...s.subTasks,
            { id: uid(), mainTaskId: mainId, title, date: d.getTime(), done: false },
          ],
        }));
      },
      deleteMainTask: (id: string) => {
        set((s) => ({
          mainTasks: s.mainTasks.filter((m) => m.id !== id),
          subTasks: s.subTasks.filter((st) => st.mainTaskId !== id),
        }));
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
          if (target) {
            const stillHasCards = remaining.some((st) => st.mainTaskId === target.mainTaskId);
            if (!stillHasCards) {
              mainTasks = s.mainTasks.filter((m) => m.id !== target.mainTaskId);
            }
          }
          return { subTasks: remaining, mainTasks };
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
      moveSubTask: (id: string, date: number, y: number) => {
        set((s) => ({
          subTasks: s.subTasks.map((st) =>
            st.id === id ? { ...st, date, y } : st,
          ),
        }));
      },
    }),
    {
      name: 'task-canvas-store', // localStorage key
      version: 1,
    },
  ),
);
