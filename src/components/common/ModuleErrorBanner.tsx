import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ModuleErrorBannerProps {
  title: string;
  message: string;
  onRetry?: () => void;
  isRetrying?: boolean;
  onDismiss?: () => void;
}

export const ModuleErrorBanner: React.FC<ModuleErrorBannerProps> = ({
  title,
  message,
  onRetry,
  isRetrying = false,
  onDismiss,
}) => {
  return (
    <div
      role="alert"
      className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3"
    >
      <div className="flex items-start gap-2.5 text-xs">
        <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
        <div>
          <div className="font-bold">{title}</div>
          <div className="mt-0.5">{message}</div>
        </div>
      </div>

      {(onRetry || onDismiss) && (
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          {onRetry && (
            <button
              type="button"
              disabled={isRetrying}
              onClick={onRetry}
              className="px-2.5 py-1 text-xs font-semibold bg-white border border-red-300 text-red-700 hover:bg-red-100 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
              <span>{isRetrying ? 'Retrying...' : 'Retry'}</span>
            </button>
          )}
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="px-2 py-1 text-xs font-semibold text-red-700 hover:text-red-900 cursor-pointer"
            >
              Dismiss
            </button>
          )}
        </div>
      )}
    </div>
  );
};
