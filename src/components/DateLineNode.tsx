// ===== 日期竖线节点 =====
// 一条日期竖线:顶部日期标签(逢月初/年初额外标月份或年份)+ 一条向下的竖线。
// 它是 React Flow 的"自定义节点",会随画布一起平移/缩放。

import { memo } from 'react';
import { useStore, type NodeProps } from '@xyflow/react';

/** 这个节点需要的数据 */
export type DateLineData = {
  label: string;    // 顶部主标签,如 "6/30"
  marker: string;   // 上方附加标记:月初显示 "7月",年初显示 "2027",平时为空
  isToday: boolean; // 是不是今天(今天用暖色定位灯高亮)
  height: number;   // 竖线高度
  proximity: number; // 距离今天的视觉权重,越近越亮
  canDrag: boolean;
};

function DateLineNode({ data }: NodeProps) {
  const { label, marker, isToday, height, proximity, canDrag } = data as DateLineData;

  // 读取当前画布缩放倍数,让线宽"反向补偿":缩放后视觉宽度恒定(不随放大变粗)。
  const zoom = useStore((s) => s.transform[2]);
  const lineWidth = (isToday ? 2 : 1) / zoom;

  const labelOpacity = isToday ? 1 : Math.max(0.28, proximity);
  const lineOpacity = isToday ? 1 : Math.max(0.12, proximity * 0.7);

  return (
    <div
      title={canDrag ? '拖动日期线调整与前一天的间距' : '时间轴起点'}
      style={{
        cursor: canDrag ? 'ew-resize' : 'default',
        userSelect: 'none',
      }}
    >
      {/* 月初/年初的附加标记 */}
      {marker && (
        <div
          style={{
            color: 'var(--accent)',
            fontSize: 12,
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            textAlign: 'center',
            marginBottom: 4,
            whiteSpace: 'nowrap',
            letterSpacing: '.05em',
            textShadow: '0 0 14px rgba(104,216,255,0.28)',
            opacity: labelOpacity,
          }}
        >
          {marker}
        </div>
      )}

      {/* 主日期标签 */}
      <div
        style={{
          color: isToday ? 'var(--line-today)' : 'var(--text-muted)',
          fontSize: isToday ? 14 : 13,
          fontFamily: 'var(--font-data)',
          fontWeight: isToday ? 800 : 600,
          textAlign: 'center',
          marginBottom: 8,
          padding: isToday ? '4px 9px' : '3px 0',
          borderRadius: 999,
          background: isToday ? 'var(--signal-soft)' : 'transparent',
          border: isToday ? '1px solid rgba(255,184,74,0.28)' : '1px solid transparent',
          boxShadow: isToday ? '0 0 0 3px rgba(255,184,74,0.055)' : 'none',
          whiteSpace: 'nowrap',
          opacity: labelOpacity,
        }}
      >
        {label}
      </div>

      {/* 向下的竖线:宽度恒定,高度随画布缩放 */}
      <div
        className={isToday ? 'today-glow' : ''}
        style={{
          width: lineWidth,
          height,
          background: isToday
            ? 'linear-gradient(180deg, var(--line-today), rgba(255,184,74,0.22))'
            : 'linear-gradient(180deg, var(--line-date), rgba(83,112,140,0.12))',
          opacity: lineOpacity,
          margin: '0 auto',
        }}
      />
    </div>
  );
}

// memo:数据没变就不重复渲染,小优化。
export default memo(DateLineNode);
