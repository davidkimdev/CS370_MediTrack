import { toast } from 'sonner';
import {
  RotateCcw,
  Loader2,
  XCircle,
  CheckCircle2,
  AlertTriangle,
  Info,
  RefreshCw,
} from 'lucide-react';
import React from 'react';

// Shared icon sizing wrapper
const IconWrap = ({ children }: { children: React.ReactNode }) => (
  <div className="shrink-0 mt-0.5">{children}</div>
);

// Base layout component for rich toasts
const ToastLayout = ({
  icon,
  title,
  description,
  actions,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string | React.ReactNode;
  actions?: React.ReactNode;
}) => (
  <div className="flex items-start gap-3">
    {icon && <IconWrap>{icon}</IconWrap>}
    <div className="flex-1 space-y-1">
      <div className="font-medium leading-snug">{title}</div>
      {description && (
        <div className="text-xs text-muted-foreground leading-relaxed">{description}</div>
      )}
      {actions && <div className="pt-1 flex flex-wrap gap-2">{actions}</div>}
    </div>
  </div>
);

// Professional toast utilities using default Sonner icons (clean black icons)
// Success toast: if an action is provided we fall back to native toast.success action API (more compact layout
// and consistent with earlier design). Without an action we use richer custom layout with icon.
export const showSuccessToast = (
  message: string,
  description?: string | React.ReactNode,
  action?: { label: string; onClick: () => void; icon?: React.ReactNode },
) => {
  if (action) {
    // Native success variant so the action button reliably appears (addresses missing Withdraw button issue)
    toast.success(message, {
      description: typeof description === 'string' ? description : undefined, // native API expects string
      action: {
        label: (
          <div className="flex items-center gap-1">
            {action.icon ? (
              <span className="inline-flex items-center justify-center">{action.icon}</span>
            ) : (
              <RotateCcw className="h-3 w-3" />
            )}
            {action.label}
          </div>
        ) as any,
        onClick: action.onClick,
      },
      duration: 9000,
    });
    return;
  }

  // No action: use the richer custom layout
  toast.custom(
    () => (
      <ToastLayout
        icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
        title={message}
        description={description}
      />
    ),
    { duration: 3800 },
  );
};

export const showErrorToast = (message: string, description?: string | React.ReactNode) => {
  toast.custom(
    () => (
      <ToastLayout
        icon={<XCircle className="h-5 w-5 text-red-600" />}
        title={message}
        description={description}
      />
    ),
    { duration: 6200 },
  );
};

export const showWarningToast = (message: string, description?: string | React.ReactNode) => {
  toast.custom(
    () => (
      <ToastLayout
        icon={<AlertTriangle className="h-5 w-5 text-amber-600" />}
        title={message}
        description={description}
      />
    ),
    { duration: 5200 },
  );
};

export const showInfoToast = (message: string, description?: string | React.ReactNode) => {
  toast.custom(
    () => (
      <ToastLayout
        icon={<Info className="h-5 w-5 text-blue-600" />}
        title={message}
        description={description}
      />
    ),
    { duration: 4200 },
  );
};

// Action toast with multiple buttons (primary + optional secondary)
export const showActionToast = ({
  title,
  description,
  actions,
  dismissAfter = 10000,
}: {
  title: string;
  description?: string | React.ReactNode;
  actions: Array<{
    label: string;
    variant?: 'primary' | 'secondary' | 'danger';
    onClick: () => void;
  }>;
  dismissAfter?: number;
}) => {
  toast.custom(
    (t) => (
      <ToastLayout
        icon={<RefreshCw className="h-5 w-5 text-slate-600" />}
        title={title}
        description={description}
        actions={
          <>
            {actions.map((a, i) => (
              <button
                key={i}
                onClick={() => {
                  a.onClick();
                  toast.dismiss(t);
                }}
                className={
                  `inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 transition-colors ` +
                  (a.variant === 'danger'
                    ? 'bg-red-600 text-white hover:bg-red-500 focus-visible:ring-red-400'
                    : a.variant === 'secondary'
                      ? 'bg-slate-200 text-slate-800 hover:bg-slate-300 focus-visible:ring-slate-400'
                      : 'bg-slate-900 text-white hover:bg-slate-800 focus-visible:ring-slate-500')
                }
              >
                {a.label}
              </button>
            ))}
          </>
        }
      />
    ),
    { duration: dismissAfter },
  );
};

// Progress toast returns an updater so caller can mutate state
export const showProgressToast = ({
  title,
  initialProgress = 0,
  description,
}: {
  title: string;
  initialProgress?: number;
  description?: string;
}) => {
  let currentProgress = initialProgress;
  let currentId = toast.custom(
    () => (
      <ToastLayout
        icon={<Loader2 className="h-5 w-5 animate-spin text-slate-500" />}
        title={title}
        description={
          <div className="space-y-2">
            {description && <div>{description}</div>}
            <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${currentProgress}%` }}
              />
            </div>
          </div>
        }
      />
    ),
    { duration: 30000 },
  );
  return {
    id: currentId,
    update: (progress: number, done?: boolean) => {
      currentProgress = progress;
      toast.dismiss(currentId); // Remove old
      if (done) {
        showSuccessToast(title + ' completed');
        return;
      }
      // Recreate with updated progress
      currentId = toast.custom(
        () => (
          <ToastLayout
            icon={<Loader2 className="h-5 w-5 animate-spin text-slate-500" />}
            title={title}
            description={
              <div className="space-y-2">
                {description && <div>{description}</div>}
                <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{ width: `${currentProgress}%` }}
                  />
                </div>
              </div>
            }
          />
        ),
        { duration: 30000 },
      );
    },
    fail: (errorMessage?: string) => {
      toast.dismiss(currentId);
      showErrorToast(title + ' failed', errorMessage);
    },
    dismiss: () => {
      toast.dismiss(currentId);
    },
  };
};

// Aggregate toast for summarizing multiple small successes/warnings
export const showAggregateToast = ({
  title,
  successes,
  warnings,
  errors,
}: {
  title: string;
  successes?: string[];
  warnings?: string[];
  errors?: string[];
}) => {
  const total = (successes?.length || 0) + (warnings?.length || 0) + (errors?.length || 0);
  const summaryParts: string[] = [];
  if (successes?.length) summaryParts.push(`${successes.length} ok`);
  if (warnings?.length) summaryParts.push(`${warnings.length} warn`);
  if (errors?.length) summaryParts.push(`${errors.length} err`);

  toast.custom(
    () => (
      <ToastLayout
        icon={<Info className="h-5 w-5 text-slate-600" />}
        title={`${title}${total ? ` (${summaryParts.join(', ')})` : ''}`}
        description={
          <div className="space-y-1">
            {successes && successes.length > 0 && (
              <div className="text-xs text-emerald-600">
                {successes.slice(0, 3).join(', ')}
                {successes.length > 3 && '…'}
              </div>
            )}
            {warnings && warnings.length > 0 && (
              <div className="text-xs text-amber-600">
                {warnings.slice(0, 3).join(', ')}
                {warnings.length > 3 && '…'}
              </div>
            )}
            {errors && errors.length > 0 && (
              <div className="text-xs text-red-600">
                {errors.slice(0, 3).join(', ')}
                {errors.length > 3 && '…'}
              </div>
            )}
          </div>
        }
      />
    ),
    { duration: 7000 },
  );
};
