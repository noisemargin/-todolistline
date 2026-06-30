// ===== 主画布 =====
// 展示模式:卡片可拖拽;双击卡片切换完成状态(交互在 CardNode 内)。
// 编辑模式:卡片不可拖拽;单击改名、双击删除、悬停左右 '+';
//           悬停主线连线出现"删除主线";底部栏新建主线。

import { useCallback, useMemo, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Panel,
  Position,
  useStore,
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
} from '../lib/dates';

/* ========== 类型注册 ========== */
const nodeTypes = { dateLine: DateLineNode, card: CardNode };
const edgeTypes = { taskLine: TaskLineEdge };

/* ========== 布局常量 ========== */
const START_DATE = dayFromToday(START_OFFSET);
const CARD_OFFSET = (DAY_WIDTH - CARD_WIDTH) / 2;

function xForDay(dayIndex: number): number {
  return dayIndex * DAY_WIDTH + CARD_OFFSET;
}
function dayFromX(x: number): number {
  const idx = Math.round((x - CARD_OFFSET) / DAY_WIDTH);
  return Math.max(0, Math.min(TOTAL_DAYS - 1, idx));
}
function markerFor(d: Date): string {
  if (d.getDate() !== 1) return '';
  if (d.getMonth() === 0) return `${d.getFullYear()}`;
  return `${d.getMonth() + 1}月`;
}

/* ========== 从 store 派生节点/连线 ========== */

function buildCardNodes(mainTasks: MainTask[], subTasks: SubTask[]): Node[] {
  return subTasks.map((task) => {
    const mainIndex = mainTasks.findIndex((m) => m.id === task.mainTaskId);
    const taskDate = new Date(task.date);
    const dayIndex = diffDays(START_DATE, taskDate);
    const rowY = task.y ?? (ROW_START_Y + Math.max(0, mainIndex) * ROW_HEIGHT);
    const color = mainTasks[mainIndex]?.color ?? 'hsl(145,55%,60%)';

    return {
      id: task.id,
      type: 'card',
      position: { x: xForDay(dayIndex), y: rowY },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      data: {
        title: task.title,
        color,
        done: task.done,
        mainTaskId: task.mainTaskId,
        date: taskDate,
      },
      draggable: true, // 两种模式都允许自由拖拽
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
        style: { stroke: color, strokeWidth: 1.5, opacity: 0.55 },
        markerEnd: 'url(#dot-elegant)',
      });
    }
  }
  return edges;
}

/* ========== 当前年月指示器 ========== */
function CurrentMonthPanel() {
  const text = useStore((s) => {
    const [tx, , zoom] = s.transform;
    if (!s.width || !zoom) return '';
    const centerX = (s.width / 2 - tx) / zoom;
    const dayIndex = Math.round(centerX / DAY_WIDTH);
    const d = addDays(START_DATE, dayIndex);
    return `${d.getFullYear()}年 ${d.getMonth() + 1}月`;
  });
  return (
    <Panel position="top-left">
      <div style={{ padding: '4px 10px', borderRadius: 8, background: 'rgba(20,22,27,0.85)', border: '1px solid var(--line-date)', color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, backdropFilter: 'blur(4px)' }}>
        {text}
      </div>
    </Panel>
  );
}

/* ========== 主画布 ========== */
export default function Canvas() {
  const mainTasks = useTaskStore((s) => s.mainTasks);
  const subTasks = useTaskStore((s) => s.subTasks);
  const moveSubTask = useTaskStore((s) => s.moveSubTask);
  const editMode = useUIStore((s) => s.editMode);
  const toggleEditMode = useUIStore((s) => s.toggleEditMode);

  // 日期竖线(静态)
  const dateNodes = useMemo<Node[]>(() => {
    const today = dayFromToday(0);
    const dates = buildDates(START_DATE, TOTAL_DAYS);
    return dates.map((d, i) => ({
      id: `date-${i}`,
      type: 'dateLine',
      position: { x: i * DAY_WIDTH, y: 0 },
      data: { label: formatMD(d), marker: markerFor(d), isToday: isSameDay(d, today), height: TIMELINE_HEIGHT },
      draggable: false,
      selectable: false,
    }));
  }, []);

  const cardNodes = useMemo(() => buildCardNodes(mainTasks, subTasks), [mainTasks, subTasks]);
  const initEdges = useMemo(() => buildEdges(mainTasks, subTasks), [mainTasks, subTasks]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initEdges);

  useEffect(() => {
    setNodes([...dateNodes, ...cardNodes]);
  }, [dateNodes, cardNodes, setNodes]);

  useEffect(() => {
    setEdges(initEdges);
  }, [initEdges, setEdges]);

  // 拖动松手(仅展示模式触发,编辑模式 draggable=false)
  const onNodeDragStop: OnNodeDrag = useCallback(
    (_evt, node) => {
      if (node.type !== 'card') return;
      const dayIndex = dayFromX(node.position.x);
      const x = xForDay(dayIndex);
      const y = node.position.y;

      onNodesChange([{ id: node.id, type: 'position', position: { x, y } }]);

      const snap = addDays(START_DATE, dayIndex);
      const old = (node.data.date as Date);
      snap.setHours(old.getHours(), old.getMinutes(), 0, 0);
      moveSubTask(node.id, snap.getTime(), y);
    },
    [onNodesChange, moveSubTask],
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
        <SelectionLayer />

        {/* 右下角:编辑/展示模式切换 */}
        <Panel position="bottom-right">
          <button
            onClick={toggleEditMode}
            title={editMode ? '切换到展示模式' : '切换到编辑模式'}
            style={{
              padding: '8px 16px',
              borderRadius: 10,
              background: editMode ? 'var(--accent)' : 'rgba(20,22,27,0.92)',
              border: editMode ? 'none' : '1px solid var(--line-date)',
              color: editMode ? '#0E0F12' : 'var(--text-primary)',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              backdropFilter: 'blur(6px)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
              transition: 'all 0.2s',
            }}
          >
            {editMode ? '✓ 编辑中' : '✎ 编辑'}
          </button>
        </Panel>

        <Background variant={BackgroundVariant.Dots} gap={32} size={1} color="var(--bg-dots)" />
      </ReactFlow>

      {/* 底部新增主线栏(仅编辑模式可见) */}
      <CreateMainBar />
    </div>
  );
}
