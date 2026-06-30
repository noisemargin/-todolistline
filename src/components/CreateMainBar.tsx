// ===== 底部新增主线栏 =====
// 仅在编辑模式下显示。固定悬浮在画布底部中央。
// 输入名称 + 点击"新增"或按 Enter → 创建新的主线任务。

import { useState, useRef, useEffect } from 'react';
import { useTaskStore } from '../store/taskStore';
import { useUIStore } from '../store/uiStore';

export default function CreateMainBar() {
  const editMode = useUIStore((s) => s.editMode);
  const addMainTask = useTaskStore((s) => s.addMainTask);
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // 进入编辑模式时自动聚焦输入框
  useEffect(() => {
    if (editMode) inputRef.current?.focus();
  }, [editMode]);

  const submit = () => {
    const name = text.trim();
    if (!name) return;
    addMainTask(name);
    setText('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') submit();
  };

  if (!editMode) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        padding: '10px 16px',
        borderRadius: 12,
        background: 'rgba(14,15,18,0.95)',
        border: '1px solid var(--line-date)',
        backdropFilter: 'blur(8px)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      }}
    >
      <input
        ref={inputRef}
        type="text"
        placeholder="输入主线任务名称…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{
          width: 220,
          padding: '8px 12px',
          borderRadius: 8,
          border: '1px solid var(--line-date)',
          background: 'rgba(255,255,255,0.05)',
          color: 'var(--text-primary)',
          fontSize: 14,
          outline: 'none',
        }}
      />
      <button
        onClick={submit}
        style={{
          padding: '8px 18px',
          borderRadius: 8,
          border: 'none',
          background: 'var(--accent)',
          color: '#0E0F12',
          fontSize: 14,
          fontWeight: 700,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        新增
      </button>
    </div>
  );
}
