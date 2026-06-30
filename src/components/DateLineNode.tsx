// ===== 日期竖线节点 =====
// 一条日期竖线:顶部日期标签(逢月初/年初额外标月份或年份)+ 一条向下的竖线。
// 它是 React Flow 的"自定义节点",会随画布一起平移/缩放。

import { memo } from 'react';
import { useStore, type NodeProps } from '@xyflow/react';

/** 这个节点需要的数据 */
export type DateLineData = {
  label: string;    // 顶部主标签,如 "6/30"
  marker: string;   // 上方附加标记:月初显示 "7月",年初显示 "2027",平时为空
  isToday: boolean; // 是不是今天(今天用亮绿色高亮)
  height: number;   // 竖线高度
};

function DateLineNode({ data }: NodeProps) {
  const { label, marker, isToday, height } = data as DateLineData;

  // 读取当前画布缩放倍数,让线宽"反向补偿":缩放后视觉宽度恒定(不随放大变粗)。
  const zoom = useStore((s) => s.transform[2]);
  const lineWidth = (isToday ? 2 : 1) / zoom;

  return (
    <div style={{ pointerEvents: 'none', userSelect: 'none' }}>
      {/* 月初/年初的附加标记 */}
      {marker && (
        <div
          style={{
            color: 'var(--accent)',
            fontSize: 12,
            fontWeight: 700,
            textAlign: 'center',
            marginBottom: 2,
            whiteSpace: 'nowrap',
          }}
        >
          {marker}
        </div>
      )}

      {/* 主日期标签 */}
      <div
        style={{
          color: isToday ? 'var(--line-today)' : 'var(--text-muted)',
          fontSize: 14,
          fontWeight: isToday ? 700 : 500,
          textAlign: 'center',
          marginBottom: 8,
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </div>

      {/* 向下的竖线:宽度恒定,高度随画布缩放 */}
      <div
        style={{
          width: lineWidth,
          height,
          background: isToday ? 'var(--line-today)' : 'var(--line-date)',
          margin: '0 auto',
        }}
      />
    </div>
  );
}

// memo:数据没变就不重复渲染,小优化。
export default memo(DateLineNode);
