import React, { useEffect } from "react";

export type ToastType = "success" | "error" | "info";

interface ToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
  duration?: number;
}

const toastStyles: Record<ToastType, { background: string; icon: string }> = {
  success: { background: "bg-green-600", icon: "✓" },
  error: { background: "bg-red-600", icon: "✕" },
  info: { background: "bg-blue-600", icon: "ℹ" },
};

export const Toast: React.FC<ToastProps> = ({
  message,
  type,
  onClose,
  duration = 3000,
}) => {
  useEffect(() => {
    const timer = window.setTimeout(onClose, duration);
    return () => window.clearTimeout(timer);
  }, [duration, onClose]);

  const { background, icon } = toastStyles[type];

  return (
    <div
      role={type === "error" ? "alert" : "status"}
      className={`fixed top-4 right-4 z-50 flex max-w-[calc(100vw-2rem)] items-center space-x-3 rounded-lg px-5 py-3 text-white shadow-lg ${background} animate-slide-in`}
    >
      <span aria-hidden="true" className="text-xl font-bold">
        {icon}
      </span>
      <span className="min-w-0 break-words font-medium">{message}</span>
      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar notificação"
        className="ml-2 shrink-0 text-white hover:text-gray-200"
      >
        <span aria-hidden="true">✕</span>
      </button>
    </div>
  );
};

export default Toast;
