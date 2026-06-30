// ===== 框选层(自定义橡皮筋选择)=====
// 在空白画布上左键拖拽画一个选择框:
//   - 从左向右拖:完全框住的卡片才被选中(window 模式)
//   - 从右向左拖:碰到的卡片选中,并扩展到其所属的【整条主线】(crossing 模式)
// 选中后按 Delete / Backspace 删除。点击空白处取消选中。
//
// 中键平移由 ReactFlow 的 panOnDrag={[1]} 负责;左键留给本框选,互不冲突。

import { useEffect, useRef, useState, useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useTaskStore } from '../store/taskStore';
import { useUIStore } from '../store/uiStore';
import {
  DAY_WIDTH,
  CARD_WIDTH,
  ROW_START_Y,
  ROW_HEIGHT,
  START_OFFSET,
  diffDays,
  dayFromToday,
  xForDayIndex,
} from '../lib/dates';

const START_DATE = dayFromToday(START_OFFSET);
const CARD_OFFSET = (DAY_WIDTH - CARD_WIDTH) / 2;
const CARD_H = 58; // 卡片大致高度,用于命中判断

type ScreenRect = { x: number; y: number; w: number; h: number };

export default function SelectionLayer() {
  const { screenToFlowPosition } = useReactFlow();
  const setSelectedIds = useUIStore((s) => s.setSelectedIds);
  const clearSelection = useUIStore((s) => s.clearSelection);

  const [rect, setRect] = useState<ScreenRect | null>(null);
  const startClient = useRef<{ x: number; y: number } | null>(null);

  // 计算某卡片在画布(flow)坐标系里的矩形
  const cardFlowRect = useCallback((task: { date: number; mainTaskId: string; x?: number; y?: number }) => {
    const { mainTasks } = useTaskStore.getState();
    const { dayGaps } = useTaskStore.getState();
    const mainIndex = mainTasks.findIndex((m) => m.id === task.mainTaskId);
    const dayIndex = diffDays(START_DATE, new Date(task.date));
    const x = task.x ?? (xForDayIndex(dayIndex, dayGaps) + CARD_OFFSET);
    const y = task.y ?? (ROW_START_Y + Math.max(0, mainIndex) * ROW_HEIGHT);
    return { left: x, right: x + CARD_WIDTH, top: y, bottom: y + CARD_H };
  }, []);

  // 监听画布空白处的左键拖拽
  useEffect(() => {
    const pane = document.querySelector('.react-flow__pane');
    if (!pane) return;

    const onMove = (e: MouseEvent) => {
      const s = startClient.current;
      if (!s) return;
      setRect({
        x: Math.min(s.x, e.clientX),
        y: Math.min(s.y, e.clientY),
        w: Math.abs(e.clientX - s.x),
        h: Math.abs(e.clientY - s.y),
      });
    };

    const onUp = (e: MouseEvent) => {
      const s = startClient.current;
      startClient.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setRect(null);
      if (!s) return;

      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      // 拖动距离太小 = 视作点击空白 → 取消选中
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5) {
        clearSelection();
        return;
      }

      // 选择框两个角换算到画布坐标
      const p1 = screenToFlowPosition({ x: s.x, y: s.y });
      const p2 = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const box = {
        left: Math.min(p1.x, p2.x),
        right: Math.max(p1.x, p2.x),
        top: Math.min(p1.y, p2.y),
        bottom: Math.max(p1.y, p2.y),
      };

      const leftToRight = dx >= 0; // 拖拽方向
      const { subTasks } = useTaskStore.getState();

      const hit = subTasks.filter((t) => {
        const r = cardFlowRect(t);
        if (leftToRight) {
          // window:卡片完全在框内
          return r.left >= box.left && r.right <= box.right && r.top >= box.top && r.bottom <= box.bottom;
        }
        // crossing:卡片与框相交
        return !(r.right < box.left || r.left > box.right || r.bottom < box.top || r.top > box.bottom);
      });

      let ids = hit.map((t) => t.id);

      if (!leftToRight && ids.length > 0) {
        // 右→左:扩展到碰到的整条主线
        const mains = new Set(hit.map((t) => t.mainTaskId));
        ids = subTasks.filter((t) => mains.has(t.mainTaskId)).map((t) => t.id);
      }

      setSelectedIds(ids);
    };

    const onDown = (e: Event) => {
      const me = e as MouseEvent;
      if (me.button !== 0) return; // 只响应左键
      startClient.current = { x: me.clientX, y: me.clientY };
      setRect({ x: me.clientX, y: me.clientY, w: 0, h: 0 });
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    };

    pane.addEventListener('mousedown', onDown);
    return () => {
      pane.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [screenToFlowPosition, setSelectedIds, clearSelection, cardFlowRect]);

  // Delete / Backspace 删除选中
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      // 正在输入框打字时不触发
      const tag = (document.activeElement?.tagName ?? '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;

      const { selectedIds, clearSelection: clear } = useUIStore.getState();
      if (selectedIds.length === 0) return;
      e.preventDefault();
      const { deleteSubTasks } = useTaskStore.getState();
      deleteSubTasks(selectedIds);
      clear();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!rect) return null;

  return (
    <div
      style={{
        position: 'fixed',
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        border: '1px solid var(--accent)',
        background: 'var(--accent-soft)',
        pointerEvents: 'none',
        zIndex: 9999,
      }}
    />
  );
}
