import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import { Users, UserCheck, UserPlus, KeyRound, CheckCircle2, Pill, AlertTriangle, Ban } from 'lucide-react';
import { cn } from '../ui/utils';

interface KpiHeaderProps {
  loading: boolean;
  title?: string;
  metrics: {
    // Accounts
    activeUsers: number;
    adminUsers: number;
    pendingApprovals: number;
    activeInvitationCodes: number;
    recentRedemptions: number; // codes used in last 7 days
    // Inventory/Medications (optional)
    totalMedications?: number;
    lowStock?: number;
    outOfStock?: number;
  };
}

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  loading: boolean;
  accent?: 'emerald' | 'indigo' | 'amber' | 'rose' | 'cyan';
}

// Simple count-up animation hook
function useCountUp(target: number, duration = 600): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let frame: number;
    const start = performance.now();
    function tick(now: number) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      setValue(Math.round(eased * target));
      if (progress < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return value;
}

function KpiCard({ icon, label, value, loading, accent = 'emerald' }: KpiCardProps) {
  const animated = useCountUp(value);
  if (loading) {
    return (
      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="p-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-6 w-1/3" />
            </div>
          </div>
        </div>
      </div>
    );
  }
  const accentClasses: Record<string, string> = {
    emerald: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800',
    indigo: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800',
    amber: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800',
    rose: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800',
    cyan: 'bg-cyan-50 dark:bg-cyan-950/40 border-cyan-200 dark:border-cyan-800',
  };
  return (
    <div className={cn('relative border transition-colors rounded-lg', accentClasses[accent])}>
      <div className="p-4">
        <div className="flex items-center gap-4">
          <div className={cn(
            'flex size-12 items-center justify-center rounded-xl text-emerald-600 dark:text-emerald-300',
            'bg-white/70 dark:bg-white/5 backdrop-blur-sm shadow-sm'
          )}>
            {icon}
          </div>
          <div className="flex-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground/80 font-medium">{label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{animated}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function HighlightCard({ icon, label, value, loading, accent = 'emerald' }: KpiCardProps) {
  const animated = useCountUp(value);
  const gradients: Record<string, string> = {
    emerald: 'from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-200/60 dark:border-emerald-900/60',
    indigo: 'from-indigo-500/10 via-indigo-500/5 to-transparent border-indigo-200/60 dark:border-indigo-900/60',
    amber: 'from-amber-500/10 via-amber-500/5 to-transparent border-amber-200/60 dark:border-amber-900/60',
    rose: 'from-rose-500/10 via-rose-500/5 to-transparent border-rose-200/60 dark:border-rose-900/60',
  };
  if (loading) {
    return (
      <div className="rounded-xl border p-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-7 w-1/3" />
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className={`relative overflow-hidden rounded-xl border bg-gradient-to-br ${gradients[accent]} backdrop-blur-sm group`}> 
      <div className="p-4 flex items-center gap-4">
        <div className="size-12 rounded-xl bg-white/70 dark:bg-white/5 flex items-center justify-center shadow-sm transition-colors group-hover:bg-white dark:group-hover:bg-white/10">
          {icon}
        </div>
        <div className="flex-1">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70 font-medium flex items-center gap-1">
            {label}
            <span className="inline-block h-1 w-1 rounded-full bg-primary/40" />
          </p>
          <p className="mt-0.5 text-[26px] leading-6 font-semibold tabular-nums tracking-tight">
            {animated}
          </p>
        </div>
      </div>
      <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="absolute -inset-px rounded-xl border border-primary/30" />
      </div>
    </div>
  );
}

function StatPill({ icon, label, value, loading }: { icon: React.ReactNode; label: string; value: number; loading: boolean }) {
  if (loading) {
    return <Skeleton className="h-7 w-32 rounded-full" />;
  }
  return (
    <div className="inline-flex items-center gap-2 rounded-full border px-3 h-7 text-xs bg-background/60">
      <span className="text-muted-foreground inline-flex items-center gap-1">
        {icon}
        {label}
      </span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

export function AdminKpiHeader({ loading, metrics, title = 'Overview' }: KpiHeaderProps) {
  // Build medication chunk
  const medHighlights: Array<{ label: string; value?: number; icon: React.ReactNode; accent: 'indigo' | 'amber' | 'rose' }> = [];
  if (metrics.totalMedications !== undefined) {
    medHighlights.push({ label: 'Total Medications', value: metrics.totalMedications, icon: <Pill className="size-6" />, accent: 'indigo' });
  }
  if (metrics.lowStock !== undefined) {
    medHighlights.push({ label: 'Low Stock', value: metrics.lowStock, icon: <AlertTriangle className="size-6" />, accent: 'amber' });
  }
  if (metrics.outOfStock !== undefined) {
    medHighlights.push({ label: 'Out of Stock', value: metrics.outOfStock, icon: <Ban className="size-6" />, accent: 'rose' });
  }
  const medPills: Array<{ label: string; value: number; icon: React.ReactNode }> = [];
  // keep pills empty for meds to reduce clutter

  // Build accounts chunk
  const acctHighlights: Array<{ label: string; value?: number; icon: React.ReactNode; accent: 'emerald' | 'amber' | 'indigo' }> = [
    // Emphasize action-needed first
    { label: 'Pending Approvals', value: metrics.pendingApprovals, icon: <UserPlus className="size-6" />, accent: 'amber' },
    { label: 'Active Users', value: metrics.activeUsers, icon: <Users className="size-6" />, accent: 'emerald' },
    { label: 'Admins', value: metrics.adminUsers, icon: <UserCheck className="size-6" />, accent: 'indigo' },
  ];
  const acctPills: Array<{ label: string; value: number; icon: React.ReactNode }> = [
    { label: 'Invites', value: metrics.activeInvitationCodes, icon: <KeyRound className="size-3" /> },
    { label: 'Redemptions', value: metrics.recentRedemptions, icon: <CheckCircle2 className="size-3" /> },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Medications chunk */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Medications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {medHighlights.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-3">
              {medHighlights.map((h, idx) => (
                <HighlightCard key={`med-h-${idx}`} icon={h.icon} label={h.label} value={h.value ?? 0} loading={loading} accent={h.accent} />
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No inventory metrics available.</div>
          )}
          {/* No pills for meds for a cleaner, balanced look */}
        </CardContent>
      </Card>

      {/* Accounts chunk */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Accounts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            {acctHighlights.map((h, idx) => (
              <HighlightCard key={`acct-h-${idx}`} icon={h.icon} label={h.label} value={h.value ?? 0} loading={loading} accent={h.accent} />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {acctPills.map((p, idx) => (
              <StatPill key={`acct-p-${idx}`} icon={p.icon} label={p.label} value={p.value} loading={loading} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function UserXIcon() {
  return <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
    <path fill="currentColor" d="M15.5 12a4.5 4.5 0 1 0-4.243-5.657A4.5 4.5 0 0 0 15.5 12ZM3 20a7 7 0 0 1 14 0v1H3v-1Zm18-9.5-1.5-1.5-1.5 1.5-1-1L18 8l-1.5-1.5 1-1L19 7l1.5-1.5 1 1L20 8l1.5 1.5-1 1Z" />
  </svg>;
}

export default AdminKpiHeader;
