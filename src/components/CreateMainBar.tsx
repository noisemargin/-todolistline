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
      className="glass-panel"
      style={{
        position: 'fixed',
        bottom: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        padding: '10px',
      }}
    >
      <input
        className="text-input"
        ref={inputRef}
        type="text"
        placeholder="新的任务主线…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{
          width: 220,
          padding: '8px 12px',
          fontSize: 14,
        }}
      />
      <button
        className="primary-button"
        onClick={submit}
        style={{
          fontSize: 14,
        }}
      >
        添加主线
      </button>
    </div>
  );
}
