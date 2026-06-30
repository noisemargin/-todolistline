// ===== 小任务(支线)卡片节点 =====
// 展示模式:可拖拽;双击切换完成状态。
// 编辑模式:可拖拽;单击=改名;左右两侧"热区"靠近时出现 '+',点击在前/后一天新增同主线卡片。
// 删除:不在卡片上做,改由画布框选 + Delete(见 SelectionLayer)。
// 选中状态:被框选时高亮描边。

import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useTaskStore } from '../store/taskStore';
import { useUIStore } from '../store/uiStore';
import { CARD_WIDTH } from '../lib/dates';

export type CardData = {
  title: string;
  color: string;
  done: boolean;
  mainTaskId: string;
  date: Date;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function CardNode({ id, data }: NodeProps) {
  const { title, color, done, mainTaskId, date: cardDate } = data as CardData;
  const editMode = useUIStore((s) => s.editMode);
  const editingCardId = useUIStore((s) => s.editingCardId);
  const setEditingCardId = useUIStore((s) => s.setEditingCardId);
  const selected = useUIStore((s) => s.selectedIds.includes(id));
  const renameSubTask = useTaskStore((s) => s.renameSubTask);
  const toggleSubTaskDone = useTaskStore((s) => s.toggleSubTaskDone);
  const addSubTask = useTaskStore((s) => s.addSubTask);

  const isEditing = editingCardId === id;
  const [text, setText] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);
  const clickTimer = useRef<number | null>(null);

  useEffect(() => { if (!isEditing) setText(title); }, [title, isEditing]);
  useEffect(() => { if (isEditing) inputRef.current?.focus(); }, [isEditing]);

  const commit = useCallback(() => {
    const trimmed = text.trim();
    if (trimmed && trimmed !== title) renameSubTask(id, trimmed);
    setEditingCardId(null);
  }, [text, title, id, renameSubTask, setEditingCardId]);

  // 单击:编辑模式 → 延时进入改名(等待是否双击)
  const handleClick = useCallback(() => {
    if (!editMode || isEditing) return;
    if (clickTimer.current !== null) return;
    clickTimer.current = window.setTimeout(() => {
      clickTimer.current = null;
      setEditingCardId(id);
    }, 220);
  }, [editMode, isEditing, id, setEditingCardId]);

  // 双击:取消改名计时;展示模式=切换完成,编辑模式=不处理(删除走框选)
  const handleDoubleClick = useCallback(() => {
    if (clickTimer.current !== null) { clearTimeout(clickTimer.current); clickTimer.current = null; }
    if (isEditing) return;
    if (!editMode) toggleSubTaskDone(id);
  }, [editMode, isEditing, id, toggleSubTaskDone]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') commit();
      if (e.key === 'Escape') { setText(title); setEditingCardId(null); }
    },
    [commit, title, setEditingCardId],
  );

  return (
    <div
      className="card-node"
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      style={{
        width: CARD_WIDTH,
        padding: '12px 14px',
        borderRadius: 12,
        background: done ? 'rgba(255,255,255,0.04)' : `${color}26`,
        border: `1px solid ${done ? 'var(--line-date)' : color}`,
        outline: selected ? '2px solid var(--accent)' : 'none',
        outlineOffset: 2,
        color: 'var(--text-primary)',
        fontSize: 14,
        fontWeight: 500,
        lineHeight: 1.3,
        boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
        opacity: done ? 0.5 : 1,
        textDecoration: done ? 'line-through' : 'none',
        userSelect: 'none',
        whiteSpace: 'nowrap',
        overflow: 'visible',
        position: 'relative',
        cursor: editMode ? (isEditing ? 'text' : 'pointer') : 'grab',
      }}
    >
      <Handle type="source" position={Position.Right} style={{ opacity: 0, pointerEvents: 'none' }} />
      <Handle type="target" position={Position.Left} style={{ opacity: 0, pointerEvents: 'none' }} />

      {isEditing ? (
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          style={{
            width: '100%', background: 'transparent', border: 'none',
            color: 'var(--text-primary)', fontSize: 14, fontWeight: 500,
            outline: 'none', padding: 0,
          }}
        />
      ) : (
        <>
          <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {title}
          </span>

          {/* 编辑模式:左右"热区",靠近卡片两侧才出现 '+',热区到按钮连续,鼠标不会丢 */}
          {editMode && (
            <>
              <div className="card-zone card-zone-left">
                <button
                  className="card-add"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); addSubTask(mainTaskId, cardDate.getTime() - DAY_MS); }}
                  onDoubleClick={(e) => e.stopPropagation()}
                  title="在前一天新增任务"
                >
                  +
                </button>
              </div>
              <div className="card-zone card-zone-right">
                <button
                  className="card-add"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); addSubTask(mainTaskId, cardDate.getTime() + DAY_MS); }}
                  onDoubleClick={(e) => e.stopPropagation()}
                  title="在后一天新增任务"
                >
                  +
                </button>
              </div>

              <style>{`
                .card-zone {
                  position: absolute; top: 0; height: 100%;
                  width: 44px; display: flex; align-items: center;
                  z-index: 10;
                }
                .card-zone-left  { left: -44px; justify-content: flex-start; padding-left: 4px; }
                .card-zone-right { right: -44px; justify-content: flex-end; padding-right: 4px; }
                /* 默认隐藏 '+';仅当鼠标在该侧热区内才显示 */
                .card-zone .card-add { opacity: 0; transition: opacity .12s; }
                .card-zone:hover .card-add { opacity: 1; }
                .card-add {
                  width: 24px; height: 24px; border-radius: 50%;
                  border: 1.5px solid var(--text-muted);
                  background: rgba(14,15,18,0.95);
                  color: var(--text-muted); font-size: 15px; font-weight: 700;
                  cursor: pointer; padding: 0; line-height: 1;
                  display: flex; align-items: center; justify-content: center;
                }
                .card-add:hover { border-color: var(--accent); color: var(--accent); }
                /* 悬停整张卡片(含热区)时把节点提到最上层,避免被相邻日期线遮挡 */
                .react-flow__node:has(.card-zone:hover) { z-index: 1000 !important; }
              `}</style>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default memo(CardNode);
