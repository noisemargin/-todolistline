// ===== 主线串联曲线(自定义 Edge)=====
// 用贝塞尔曲线平滑串联同主线卡片。
// 编辑模式下:鼠标悬停连线 → 线中点出现"删除主线"悬浮按钮,点击删除整条主线。

import { useState } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react';
import { useUIStore } from '../store/uiStore';
import { useTaskStore } from '../store/taskStore';

export default function TaskLineEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  data,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    curvature: 0.18,
  });

  const editMode = useUIStore((s) => s.editMode);
  const deleteMainTask = useTaskStore((s) => s.deleteMainTask);
  const [hover, setHover] = useState(false);

  const mainTaskId = (data as { mainTaskId?: string } | undefined)?.mainTaskId;

  return (
    <>
      {/* 可见曲线 */}
      <BaseEdge
        id={id}
        path={edgePath}
        style={{ ...style, filter: 'drop-shadow(0 0 3px rgba(57,255,106,0.08))' }}
        markerEnd={markerEnd}
      />

      {/* 编辑模式:加宽透明命中区,用于悬停检测 */}
      {editMode && (
        <path
          d={edgePath}
          fill="none"
          stroke="transparent"
          strokeWidth={20}
          style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
        />
      )}

      {/* 悬停时:线中点显示删除主线按钮 */}
      {editMode && hover && mainTaskId && (
        <EdgeLabelRenderer>
          <button
            onClick={() => deleteMainTask(mainTaskId)}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            title="删除整条主线及其全部卡片"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
              padding: '4px 10px',
              borderRadius: 8,
              border: 'none',
              background: 'rgba(255,80,80,0.92)',
              color: '#fff',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
            }}
          >
            删除主线
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
