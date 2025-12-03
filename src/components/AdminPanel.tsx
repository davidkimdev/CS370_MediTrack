import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { useAuth } from '../contexts/AuthContext';
import { AuthService } from '../services/authService';
import { showErrorToast, showSuccessToast } from '../utils/toastUtils';
import type { InvitationCode, UserProfile } from '../types/auth';
import {
  Ban,
  Clipboard,
  ClipboardCheck,
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { AdminKpiHeader } from './admin/KpiHeader';
import { MedicationService } from '../services/medicationService';
import ManageAccounts from '@/components/admin/ManageAccounts';

export function AdminPanel() {
  const { user, profile } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [pendingUsers, setPendingUsers] = useState<UserProfile[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [invitationCodes, setInvitationCodes] = useState<InvitationCode[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [userActionLoading, setUserActionLoading] = useState<Record<string, boolean>>({});
  const [codeActionLoading, setCodeActionLoading] = useState<Record<string, boolean>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const currentUserId = user?.id ?? '';
  const isAdmin = profile?.role === 'admin';

  const activeUsers = useMemo(() => {
    return allUsers
      .filter((user) => user.isApproved)
      .sort((a, b) => {
        if (a.role !== b.role) {
          return a.role === 'admin' ? -1 : 1;
        }
        return a.email.localeCompare(b.email);
      });
  }, [allUsers]);

  const loadAdminData = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!currentUserId || !isAdmin) {
        if (!silent) {
          setRefreshing(false);
        }
        if (!hasLoaded) {
          setIsLoading(false);
        }
        return;
      }

      const isInitialLoad = !hasLoaded;
      if (isInitialLoad && !silent) {
        setIsLoading(true);
      } else if (!silent) {
        setRefreshing(true);
      }

      try {
        const [pending, users, codes] = await Promise.all([
          AuthService.getPendingUsers(),
          AuthService.getAllUsers(),
          AuthService.getInvitationCodes(),
        ]);
        setPendingUsers(pending);
        setAllUsers(users);
        setInvitationCodes(codes);
        setHasLoaded(true);
      } catch (error) {
        console.error('Failed to load admin data', error);
        showErrorToast(
          'Failed to load account information',
          error instanceof Error ? error.message : 'Please try again later.',
        );
      } finally {
        if (isInitialLoad && !silent) {
          setIsLoading(false);
        }
        if (!silent) {
          setRefreshing(false);
        }
      }
    },
    [currentUserId, isAdmin, hasLoaded],
  );

  useEffect(() => {
    if (isAdmin) {
      void loadAdminData();
    }
  }, [isAdmin, loadAdminData]);

  const withUserAction = async (userId: string, action: () => Promise<void>) => {
    setUserActionLoading((prev) => ({ ...prev, [userId]: true }));
    try {
      await action();
      await loadAdminData({ silent: true });
    } catch (error) {
      console.error('Admin user action failed', error);
      showErrorToast('Action failed', error instanceof Error ? error.message : 'Please retry.');
    } finally {
      setUserActionLoading((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const handleApproveUser = (userId: string) => {
    return withUserAction(userId, async () => {
      await AuthService.adminUpdateUser(userId, { isApproved: true });
      showSuccessToast('User approved', 'The account now has full access.');
    });
  };

  const handleRejectUser = (userId: string) =>
    withUserAction(userId, async () => {
      await AuthService.rejectUser(userId);
      showSuccessToast('User rejected', 'The account request has been removed.');
    });

  const handleRoleChange = (
    userId: string,
    currentRole: 'admin' | 'staff',
    nextRole: 'admin' | 'staff',
    displayName: string,
  ) => {
    if (currentRole === nextRole) {
      return;
    }

    const confirmed = window.confirm(
      `Change ${displayName}'s role from ${currentRole} to ${nextRole}? They will immediately have ${nextRole} permissions.`,
    );

    if (!confirmed) {
      return;
    }

    return withUserAction(userId, async () => {
      await AuthService.adminUpdateUser(userId, { role: nextRole });
      showSuccessToast('Role updated', `${displayName} is now ${nextRole}.`);
    });
  };

  const handleToggleApproval = (userId: string, approved: boolean) =>
    withUserAction(userId, async () => {
      await AuthService.adminUpdateUser(userId, { isApproved: approved });
      showSuccessToast(
        approved ? 'Access restored' : 'Access revoked',
        approved
          ? 'User account has been re-enabled.'
          : 'User account has been disabled and will require re-approval.',
      );
    });

  const handleGenerateInvite = async () => {
    if (!currentUserId) {
      return;
    }

    setIsGeneratingCode(true);
    try {
      const code = await AuthService.createInvitationCode(currentUserId, inviteEmail || undefined);
      setGeneratedCode(code);
      setInviteEmail('');
      showSuccessToast('Invitation ready', 'Share this code to onboard a teammate.', {
        label: 'Copy code',
        icon: <Clipboard className="h-3 w-3" />,
        onClick: () => {
          navigator.clipboard.writeText(code).then(
            () => showSuccessToast('Invitation copied'),
            () => showErrorToast('Copy failed', 'Unable to copy to clipboard.'),
          );
        },
      });
      await loadAdminData({ silent: true });
    } catch (error) {
      console.error('Failed to create invitation code', error);
      showErrorToast(
        'Could not create invitation',
        error instanceof Error ? error.message : 'Please try again later.',
      );
    } finally {
      setIsGeneratingCode(false);
    }
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      showSuccessToast('Invitation copied', 'Code copied to clipboard.');
      setTimeout(() => setCopiedCode((prev) => (prev === code ? null : prev)), 2000);
    } catch (error) {
      console.error('Failed to copy code', error);
      showErrorToast('Copy failed', 'Unable to copy to clipboard.');
    }
  };

  const handleRefresh = async () => {
    await loadAdminData({ silent: false });
  };

  const handleDeactivateCode = async (codeId: string) => {
    setCodeActionLoading((prev) => ({ ...prev, [codeId]: true }));
    try {
      await AuthService.deactivateInvitationCode(codeId);
      showSuccessToast('Invitation disabled', 'The code can no longer be redeemed.');
      await loadAdminData({ silent: true });
    } catch (error) {
      console.error('Failed to deactivate invitation code', error);
      showErrorToast(
        'Unable to disable code',
        error instanceof Error ? error.message : 'Please try again later.',
      );
    } finally {
      setCodeActionLoading((prev) => ({ ...prev, [codeId]: false }));
    }
  };

  const getInvitationStatus = (code: InvitationCode) => {
    if (code.usedAt) {
      return {
        label: 'Used',
        className: 'bg-emerald-100 text-emerald-700',
        variant: 'outline' as const,
      };
    }
    if (!code.isActive) {
      return { label: 'Disabled', className: 'text-muted-foreground', variant: 'outline' as const };
    }
    if (code.expiresAt.getTime() < Date.now()) {
      return { label: 'Expired', className: '', variant: 'destructive' as const };
    }
    return {
      label: 'Active',
      className: 'bg-emerald-100 text-emerald-700',
      variant: 'outline' as const,
    };
  };

  const { activeCodes, archivedCodes } = useMemo(() => {
    const now = Date.now();
    const active = invitationCodes.filter(
      (code) => code.isActive && !code.usedAt && code.expiresAt.getTime() >= now,
    );
    const archived = invitationCodes.filter((code) => !active.includes(code));
    return { activeCodes: active, archivedCodes: archived };
  }, [invitationCodes]);

  if (!isAdmin) {
    return null;
  }

  // KPI Metrics (memoized for performance)
  const [medStats, setMedStats] = useState<{ total: number; low: number; out: number } | null>(
    null,
  );
  const [showManageAccounts, setShowManageAccounts] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadMedStats() {
      try {
        const meds = await MedicationService.getAllMedications();
        if (cancelled) return;
        const total = meds.length;
        const low = meds.filter(
          (m) => typeof m.minStock === 'number' && m.currentStock <= (m.minStock || 0),
        ).length;
        const out = meds.filter((m) => (m.currentStock || 0) <= 0).length;
        setMedStats({ total, low, out });
      } catch (e) {
        console.warn('Failed to load medication stats (non-blocking):', e);
        if (!cancelled) setMedStats({ total: 0, low: 0, out: 0 });
      }
    }
    void loadMedStats();
    return () => {
      cancelled = true;
    };
  }, []);

  const kpiMetrics = useMemo(() => {
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const recentRedemptions = invitationCodes.filter(
      (c) => c.usedAt && c.usedAt.getTime() >= sevenDaysAgo,
    ).length;
    return {
      activeUsers: activeUsers.length,
      adminUsers: allUsers.filter((u) => u.role === 'admin' && u.isApproved).length,
      pendingApprovals: pendingUsers.length,
      activeInvitationCodes: invitationCodes.filter(
        (c) => c.isActive && !c.usedAt && c.expiresAt.getTime() >= now,
      ).length,
      recentRedemptions,
      totalMedications: medStats?.total ?? undefined,
      lowStock: medStats?.low ?? undefined,
      outOfStock: medStats?.out ?? undefined,
    };
  }, [activeUsers, allUsers, pendingUsers, invitationCodes, medStats]);

  if (showManageAccounts) {
    return <ManageAccounts onBack={() => setShowManageAccounts(false)} />;
  }

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold flex items-center gap-2">
              <ShieldCheck className="size-6 text-emerald-600" />
              Admin Control Center
            </h2>
            <p className="text-sm text-muted-foreground">
              Manage access, onboard new teammates, and review account activity.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="bg-white text-foreground hover:bg-muted"
              onClick={() => setShowManageAccounts(true)}
            >
              Manage accounts
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing || isLoading}
            >
              {refreshing ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 size-4" />
              )}
              Refresh
            </Button>
          </div>
        </div>
        {/* KPI Header */}
        <AdminKpiHeader
          loading={isLoading && !hasLoaded}
          metrics={kpiMetrics}
          title="Admin overview"
        />
      </div>
      {/* Additional admin widgets can be added below as needed */}
    </div>
  );
}
