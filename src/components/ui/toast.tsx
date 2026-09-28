'use client';

import { useEffect, useState } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastProps {
  type?: ToastType;
  message: string;
  duration?: number;
  onClose?: () => void;
}

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

const iconColors = {
  success: 'text-success',
  error: 'text-destructive',
  info: 'text-brand',
  warning: 'text-warning',
};

const bgColors = {
  success: 'bg-success-subtle',
  error: 'bg-destructive-subtle',
  info: 'bg-brand-subtle',
  warning: 'bg-warning-subtle',
};

export function Toast({
  type = 'info',
  message,
  duration = 3000,
  onClose,
}: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);
  const Icon = icons[type];

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        onClose?.();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  if (!isVisible) return null;

  return (
    <div
      className={cn(
        'fixed top-4 right-4 z-[100] flex items-start gap-3 p-4 rounded-xl shadow-pop max-w-md animate-in slide-in-from-right-full transition-all duration-300',
        bgColors[type]
      )}
    >
      <Icon className={cn('w-5 h-5 mt-0.5 flex-shrink-0', iconColors[type])} />
      <div className="flex-1">
        <p className="text-sm text-foreground">{message}</p>
      </div>
      <button
        onClick={() => {
          setIsVisible(false);
          onClose?.();
        }}
        className="text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// Toast容器组件
export function ToastContainer() {
  const [toasts, setToasts] = useState<
    Array<{ id: string; props: ToastProps }>
  >([]);

  const addToast = (props: Omit<ToastProps, 'onClose'>) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, props }]);
    return id;
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // 暴露到window对象以便全局调用
  useEffect(() => {
    (window as any).toast = {
      success: (message: string, duration?: number) =>
        addToast({ type: 'success', message, duration }),
      error: (message: string, duration?: number) =>
        addToast({ type: 'error', message, duration }),
      info: (message: string, duration?: number) =>
        addToast({ type: 'info', message, duration }),
      warning: (message: string, duration?: number) =>
        addToast({ type: 'warning', message, duration }),
    };

    return () => {
      delete (window as any).toast;
    };
  }, []);

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(({ id, props }) => (
        <Toast
          key={id}
          {...props}
          onClose={() => removeToast(id)}
        />
      ))}
    </div>
  );
}
