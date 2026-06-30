// ===== 主画布 =====
// 展示模式:卡片可拖拽;双击卡片切换完成状态(交互在 CardNode 内)。
// 编辑模式:卡片可拖拽;单击改名、悬停左右 '+';
//           悬停主线连线出现"删除主线";底部栏新建主线。

import { useCallback, useMemo, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Panel,
  Position,
  useStore,
  useReactFlow,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type OnNodeDrag,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import DateLineNode from './DateLineNode';
import CardNode from './CardNode';
import TaskLineEdge from './TaskLineEdge';
import CreateMainBar from './CreateMainBar';
import SelectionLayer from './SelectionLayer';
import ExportImportPanel from './ExportImportPanel';
import { useTaskStore, type MainTask, type SubTask } from '../store/taskStore';
import { useUIStore } from '../store/uiStore';
import {
  DAY_WIDTH,
  CARD_WIDTH,
  TIMELINE_HEIGHT,
  ROW_START_Y,
  ROW_HEIGHT,
  PAST_DAYS,
  TOTAL_DAYS,
  START_OFFSET,
  buildDates,
  formatMD,
  isSameDay,
  diffDays,
  addDays,
  dayFromToday,
  nearestDayFromX,
  xForDayIndex,
} from '../lib/dates';

/* ========== 类型注册 ========== */
const nodeTypes = { dateLine: DateLineNode, card: CardNode };
const edgeTypes = { taskLine: TaskLineEdge };

/* ========== 布局常量 ========== */
const START_DATE = dayFromToday(START_OFFSET);
const CARD_OFFSET = (DAY_WIDTH - CARD_WIDTH) / 2;
const SNAP_DISTANCE = 52;

function xForDay(dayIndex: number, dayGaps: number[]): number {
  return xForDayIndex(dayIndex, dayGaps) + CARD_OFFSET;
}
function dayFromCardX(x: number, dayGaps: number[]): number {
  return nearestDayFromX(x - CARD_OFFSET, dayGaps, TOTAL_DAYS);
}
function markerFor(d: Date): string {
  if (d.getDate() !== 1) return '';
  if (d.getMonth() === 0) return `${d.getFullYear()}`;
  return `${d.getMonth() + 1}月`;
}
function proximityForDay(dayIndex: number): number {
  const distance = Math.abs(dayIndex - PAST_DAYS);
  return Math.max(0.22, 1 - distance / 90);
}

/* ========== 从 store 派生节点/连线 ========== */

function buildCardNodes(mainTasks: MainTask[], subTasks: SubTask[], dayGaps: number[]): Node[] {
  // 找出每条主线最早的那张卡片(id),用作实心标题卡
  const firstIds = new Set<string>();
  const groups = new Map<string, SubTask[]>();
  for (const t of subTasks) {
    if (!groups.has(t.mainTaskId)) groups.set(t.mainTaskId, []);
    groups.get(t.mainTaskId)!.push(t);
  }
  for (const [, items] of groups) {
    items.sort((a, b) => a.date - b.date);
    firstIds.add(items[0].id);
  }

  return subTasks.map((task) => {
    const mainIndex = mainTasks.findIndex((m) => m.id === task.mainTaskId);
    const taskDate = new Date(task.date);
    const dayIndex = diffDays(START_DATE, taskDate);
    const rowY = task.y ?? (ROW_START_Y + Math.max(0, mainIndex) * ROW_HEIGHT);
    const color = mainTasks[mainIndex]?.color ?? 'hsl(145,55%,60%)';
    const isFirst = firstIds.has(task.id);

    return {
      id: task.id,
      type: 'card',
      position: { x: task.x ?? xForDay(dayIndex, dayGaps), y: rowY },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      data: {
        title: task.title,
        color,
        done: task.done,
        mainTaskId: task.mainTaskId,
        date: taskDate,
        isFirst, // 每条主线第一张卡片 = 实心标题卡
      },
      draggable: true,
      selectable: false,
    };
  });
}

function buildEdges(mainTasks: MainTask[], subTasks: SubTask[]): Edge[] {
  const groups = new Map<string, SubTask[]>();
  for (const t of subTasks) {
    if (!groups.has(t.mainTaskId)) groups.set(t.mainTaskId, []);
    groups.get(t.mainTaskId)!.push(t);
  }
  const edges: Edge[] = [];
  for (const [mainTaskId, items] of groups) {
    items.sort((a, b) => a.date - b.date);
    const main = mainTasks.find((m) => m.id === mainTaskId);
    const color = main?.color ?? 'hsl(145,55%,60%)';
    for (let i = 0; i < items.length - 1; i++) {
      edges.push({
        id: `edge-${items[i].id}-${items[i + 1].id}`,
        source: items[i].id,
        target: items[i + 1].id,
        type: 'taskLine',
        data: { mainTaskId },         // 连线知道属于哪条主线(悬停删除用)
        style: { stroke: color, strokeWidth: 1.65, opacity: 0.66 },
        markerEnd: 'url(#dot-elegant)',
      });
    }
  }
  return edges;
}

/* ========== 当前年月指示器 + 回到今天 ========== */
function CurrentMonthPanel() {
  const dayGaps = useTaskStore((s) => s.dayGaps);
  const text = useStore((s) => {
    const [tx, , zoom] = s.transform;
    if (!s.width || !zoom) return '';
    const centerX = (s.width / 2 - tx) / zoom;
    const dayIndex = nearestDayFromX(centerX, dayGaps, TOTAL_DAYS);
    const d = addDays(START_DATE, dayIndex);
    return `${d.getFullYear()}年 ${d.getMonth() + 1}月`;
  });
  return (
    <Panel position="top-left">
      <div className="glass-panel hud-panel month-chip">
        {text}
      </div>
    </Panel>
  );
}

function MissionPanel() {
  const mainTasks = useTaskStore((s) => s.mainTasks);
  const subTasks = useTaskStore((s) => s.subTasks);
  const doneCount = subTasks.filter((t) => t.done).length;
  const percent = subTasks.length ? Math.round((doneCount / subTasks.length) * 100) : 0;

  return (
    <Panel position="top-right">
      <div className="glass-panel hud-panel mission-panel" aria-label="任务概览">
        <div className="mission-stat">
          <div className="mission-label">routes</div>
          <div className="mission-value">{mainTasks.length}</div>
        </div>
        <div className="mission-stat">
          <div className="mission-label">nodes</div>
          <div className="mission-value">{subTasks.length}</div>
        </div>
        <div className="mission-stat">
          <div className="mission-label">done</div>
          <div className="mission-value">{percent}%</div>
        </div>
      </div>
    </Panel>
  );
}

/** 顶部快捷操作:回到今天 + 撤回最近一次删除 */
function TimelineControls() {
  const { setViewport } = useReactFlow();
  const dayGaps = useTaskStore((s) => s.dayGaps);
  const undoCount = useTaskStore((s) => s.undoStack.length);
  const undoLastDelete = useTaskStore((s) => s.undoLastDelete);
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const canUndo = undoCount > 0;

  const goToday = () => {
    // 今天的画布 x 坐标(日期间隙居中)
    const todayX = xForDayIndex(PAST_DAYS, dayGaps) + CARD_OFFSET;
    setViewport(
      { x: -(todayX - window.innerWidth / 2), y: 90, zoom: 1 },
      { duration: 600 }, // 平滑动画
    );
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'z' || (!e.ctrlKey && !e.metaKey)) return;
      const active = document.activeElement;
      const tag = (active?.tagName ?? '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || active?.getAttribute('contenteditable') === 'true') return;
      if (!useTaskStore.getState().canUndoDelete()) return;
      e.preventDefault();
      useTaskStore.getState().undoLastDelete();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <Panel position="top-center">
      <div className="glass-panel hud-panel" style={{ display: 'flex', gap: 6, padding: 6 }}>
        <button
          className="toolbar-button"
          onClick={goToday}
          title="回到今天"
          style={{
            color: 'var(--line-today)',
          }}
        >
          ◉ 定位今天
        </button>
        <button
          className="toolbar-button"
          onClick={undoLastDelete}
          disabled={!canUndo}
          title={canUndo ? '撤回最近一次删除 Ctrl+Z' : '暂无可撤回的删除'}
        >
          ↶ 撤回删除
        </button>
        <button
          className="toolbar-button"
          onClick={toggleTheme}
          title={theme === 'light' ? '切换到深色模式' : '切换到浅色模式'}
        >
          {theme === 'light' ? '☾ 深色' : '☀ 浅色'}
        </button>
      </div>
    </Panel>
  );
}

/* ========== 主画布 ========== */
export default function Canvas() {
  const mainTasks = useTaskStore((s) => s.mainTasks);
  const subTasks = useTaskStore((s) => s.subTasks);
  const dayGaps = useTaskStore((s) => s.dayGaps);
  const moveSubTask = useTaskStore((s) => s.moveSubTask);
  const resizeDateGapBefore = useTaskStore((s) => s.resizeDateGapBefore);
  const editMode = useUIStore((s) => s.editMode);
  const toggleEditMode = useUIStore((s) => s.toggleEditMode);

  // 日期竖线(静态)
  const dateNodes = useMemo<Node[]>(() => {
    const today = dayFromToday(0);
    const dates = buildDates(START_DATE, TOTAL_DAYS);
    return dates.map((d, i) => ({
      id: `date-${i}`,
      type: 'dateLine',
      position: { x: xForDayIndex(i, dayGaps), y: 0 },
      data: {
        label: formatMD(d),
        marker: markerFor(d),
        isToday: isSameDay(d, today),
        height: TIMELINE_HEIGHT,
        proximity: proximityForDay(i),
        canDrag: i > 0,
      },
      draggable: i > 0,
      selectable: false,
    }));
  }, [dayGaps]);

  const cardNodes = useMemo(() => buildCardNodes(mainTasks, subTasks, dayGaps), [mainTasks, subTasks, dayGaps]);
  const initEdges = useMemo(() => buildEdges(mainTasks, subTasks), [mainTasks, subTasks]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initEdges);

  useEffect(() => {
    setNodes([...dateNodes, ...cardNodes]);
  }, [dateNodes, cardNodes, setNodes]);

  useEffect(() => {
    setEdges(initEdges);
  }, [initEdges, setEdges]);

  // 拖动松手:横向吸附到最近日期,纵向保持自由位置。
  const onNodeDragStop: OnNodeDrag = useCallback(
    (_evt, node) => {
      if (node.type === 'dateLine') {
        const dayIndex = Number(node.id.replace('date-', ''));
        if (!Number.isFinite(dayIndex) || dayIndex <= 0) return;
        const currentX = xForDayIndex(dayIndex, dayGaps);
        resizeDateGapBefore(dayIndex, node.position.x - currentX);
        onNodesChange([{ id: node.id, type: 'position', position: { x: currentX, y: 0 } }]);
        return;
      }

      if (node.type !== 'card') return;
      const dayIndex = dayFromCardX(node.position.x, dayGaps);
      const nearestX = xForDay(dayIndex, dayGaps);
      const shouldSnap = Math.abs(node.position.x - nearestX) <= SNAP_DISTANCE;
      const x = shouldSnap ? nearestX : node.position.x;
      const y = node.position.y;

      onNodesChange([{ id: node.id, type: 'position', position: { x, y } }]);

      const snap = addDays(START_DATE, dayIndex);
      const old = (node.data.date as Date);
      snap.setHours(old.getHours(), old.getMinutes(), 0, 0);
      moveSubTask(node.id, snap.getTime(), y, shouldSnap ? undefined : x);
    },
    [onNodesChange, moveSubTask, resizeDateGapBefore, dayGaps],
  );

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        panOnDrag={[1]}
        selectionOnDrag={false}
        defaultViewport={{ x: -(PAST_DAYS * DAY_WIDTH) + 160, y: 90, zoom: 1 }}
        minZoom={0.3}
        maxZoom={2}
        nodesConnectable={false}
        onlyRenderVisibleElements
      >
        <svg style={{ position: 'absolute', width: 0, height: 0 }}>
          <defs>
            <marker id="dot-elegant" viewBox="0 0 10 10" refX={5} refY={5} markerWidth={5} markerHeight={5} orient="auto">
              <circle cx={5} cy={5} r={3.5} fill="context-stroke" />
            </marker>
          </defs>
        </svg>

        <CurrentMonthPanel />
        <MissionPanel />
        <TimelineControls />
        <SelectionLayer />

        {/* 左下角:导出/导入 */}
        <Panel position="bottom-left">
          <ExportImportPanel />
        </Panel>

        {/* 右下角:编辑/展示模式切换 */}
        <Panel position="bottom-right">
          <button
            className={editMode ? 'primary-button' : 'toolbar-button'}
            onClick={toggleEditMode}
            title={editMode ? '切换到展示模式' : '切换到编辑模式'}
            style={{
              fontSize: 13,
            }}
          >
            {editMode ? '✓ 规划中' : '✎ 规划'}
          </button>
        </Panel>

        <Background variant={BackgroundVariant.Dots} gap={28} size={1.1} color="var(--bg-dots)" />
      </ReactFlow>

      {/* 底部新增主线栏(仅编辑模式可见) */}
      <CreateMainBar />
    </div>
  );
}
