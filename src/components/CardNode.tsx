// ===== 小任务(支线)卡片节点 =====
// 展示模式:可拖拽;双击切换完成状态。
// 编辑模式:可拖拽;单击=改名;左右两侧"热区"靠近时出现 '+',点击在前/后一天新增同主线卡片。
// 删除:不在卡片上做,改由画布框选 + Delete(见 SelectionLayer)。
// 选中状态:被框选时高亮描边。

import { memo, useState, useCallback, useRef, useEffect } from 'react';
import type { CSSProperties } from 'react';
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
  /** 每条主线第一张卡片:实心纯色,充当标题卡 */
  isFirst?: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;
type CardStyle = CSSProperties & Record<'--card-color' | '--card-color-soft' | '--card-color-dim', string>;

function withAlpha(color: string, alpha: number): string {
  return color.replace(/^hsl\((.*)\)$/i, `hsla($1, ${alpha})`);
}

function CardNode({ id, data }: NodeProps) {
  const { title, color, done, mainTaskId, date: cardDate, isFirst } = data as CardData;
  const editMode = useUIStore((s) => s.editMode);
  const editingCardId = useUIStore((s) => s.editingCardId);
  const setEditingCardId = useUIStore((s) => s.setEditingCardId);
  const selected = useUIStore((s) => s.selectedIds.includes(id));
  const renameSubTask = useTaskStore((s) => s.renameSubTask);
  const toggleSubTaskDone = useTaskStore((s) => s.toggleSubTaskDone);
  const addSubTask = useTaskStore((s) => s.addSubTask);

  const isEditing = editingCardId === id;
  const dateLabel = `${cardDate.getMonth() + 1}/${cardDate.getDate()}`;
  const color90 = withAlpha(color, 0.9);
  const color72 = withAlpha(color, 0.72);
  const color55 = withAlpha(color, 0.55);
  const color24 = withAlpha(color, 0.24);
  const color14 = withAlpha(color, 0.14);
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
        '--card-color': color,
        '--card-color-soft': color24,
        '--card-color-dim': color55,
        minHeight: 58,
        padding: '9px 12px 11px',
        borderRadius: 'var(--radius-md)',
        // 标题卡(isFirst):实心纯色 + 深色文字;普通卡:半透明底色 + 彩色边框
        background: isFirst
          ? (done ? 'var(--card-done-bg)' : `linear-gradient(135deg, ${color}, ${color90} 72%, rgba(255,255,255,0.16))`)
          : (done ? 'var(--card-done-bg)' : `linear-gradient(180deg, ${color24}, var(--card-surface))`),
        border: isFirst
          ? `1px solid ${done ? 'var(--panel-border)' : color72}`
          : `1px solid ${done ? 'var(--line-date)' : color55}`,
        outline: selected ? '2px solid var(--accent)' : 'none',
        outlineOffset: 2,
        color: isFirst ? '#06111A' : 'var(--text-primary)',
        fontSize: 14,
        fontWeight: isFirst ? 700 : 500,
        lineHeight: 1.35,
        boxShadow: isFirst
          ? `0 16px 34px rgba(0,8,18,0.34), 0 0 0 3px ${done ? 'rgba(255,255,255,0.02)' : color14}`
          : 'var(--card-shadow)',
        opacity: done && !isFirst ? 0.5 : 1,
        textDecoration: done ? 'line-through' : 'none',
        userSelect: 'none',
        whiteSpace: 'nowrap',
        overflow: 'visible',
        position: 'relative',
        cursor: editMode ? (isEditing ? 'text' : 'pointer') : 'grab',
      } as CardStyle}
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
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              marginBottom: 5,
              color: isFirst ? 'rgba(6,17,26,0.66)' : 'var(--text-faint)',
              fontFamily: 'var(--font-data)',
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: '.12em',
              textTransform: 'uppercase',
              textDecoration: 'none',
            }}
          >
            <span>{isFirst ? '主线' : '节点'}</span>
            <span>{dateLabel}</span>
          </span>
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
                  border: 1px solid var(--card-color-dim);
                  background: linear-gradient(180deg, var(--card-color-soft), rgba(7,17,28,0.86));
                  color: var(--card-color); font-size: 15px; font-weight: 800;
                  cursor: pointer; padding: 0; line-height: 1;
                  display: flex; align-items: center; justify-content: center;
                  box-shadow: 0 10px 22px rgba(0,7,15,.32), 0 0 0 2px var(--card-color-soft);
                  backdrop-filter: blur(12px);
                }
                .card-add:hover {
                  border-color: var(--card-color);
                  background: linear-gradient(180deg, var(--card-color), var(--card-color-dim));
                  color: #06111A;
                }
                .card-node::after {
                  content: "";
                  position: absolute;
                  left: 10px; right: 10px; bottom: 5px;
                  height: 1px;
                  background: linear-gradient(90deg, transparent, rgba(255,255,255,.28), transparent);
                  opacity: .22;
                }
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
