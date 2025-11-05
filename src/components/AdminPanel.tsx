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

export function AdminPanel() {
  const { user, profile } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
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

  const pendingUsers = useMemo(() => {
    return allUsers
      .filter((user) => !user.isApproved)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }, [allUsers]);

  const syncUserState = useCallback((updated: UserProfile) => {
    setAllUsers((prev) => {
      const index = prev.findIndex((user) => user.id === updated.id);
      if (index === -1) {
        return [...prev, updated];
      }

      const next = [...prev];
      next[index] = updated;
      return next;
    });
  }, []);

  const removeUser = useCallback((userId: string) => {
    setAllUsers((prev) => prev.filter((user) => user.id !== userId));
  }, []);

  const loadAdminData = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
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
      const [users, codes] = await Promise.all([
        AuthService.getAllUsers(),
        AuthService.getInvitationCodes(),
      ]);
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
  }, [currentUserId, isAdmin, hasLoaded]);

  useEffect(() => {
    if (isAdmin) {
      void loadAdminData();
    }
  }, [isAdmin, loadAdminData]);

  type ActionResult = UserProfile | 'removed' | void;

  const withUserAction = async (userId: string, action: () => Promise<ActionResult>) => {
    setUserActionLoading((prev) => ({ ...prev, [userId]: true }));
    try {
      const result = await action();

      if (result && result !== 'removed') {
        syncUserState(result);
      } else if (result === 'removed') {
        removeUser(userId);
      }

      await loadAdminData({ silent: true });
    } catch (error) {
      console.error('Admin user action failed', error);
      showErrorToast(
        'Action failed',
        error instanceof Error ? error.message : 'Please retry.',
      );
    } finally {
      setUserActionLoading((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const handleApproveUser = (userId: string) => {
    return withUserAction(userId, async () => {
      const updated = await AuthService.adminUpdateUser(userId, { isApproved: true });
      showSuccessToast('User approved', 'The account now has full access.');
      return updated;
    });
  };

  const handleRejectUser = (userId: string) =>
    withUserAction(userId, async () => {
      await AuthService.rejectUser(userId);
      showSuccessToast('User rejected', 'The account request has been removed.');
      return 'removed';
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

    if (currentRole === 'admin' && nextRole !== 'admin') {
      const adminCount = activeUsers.filter((user) => user.role === 'admin').length;
      if (adminCount <= 1) {
        showErrorToast(
          'Cannot remove final administrator',
          'Promote another user before downgrading this account.',
        );
        return;
      }
    }

    const confirmed = window.confirm(
      `Change ${displayName}'s role from ${currentRole} to ${nextRole}? They will immediately have ${nextRole} permissions.`,
    );

    if (!confirmed) {
      return;
    }

    return withUserAction(userId, async () => {
      const updated = await AuthService.adminUpdateUser(userId, { role: nextRole });
      showSuccessToast('Role updated', `${displayName} is now ${nextRole}.`);
      return updated;
    });
  };

  const handleToggleApproval = (userId: string, approved: boolean) =>
    withUserAction(userId, async () => {
      const updated = await AuthService.adminUpdateUser(userId, { isApproved: approved });
      showSuccessToast(
        approved ? 'Access restored' : 'Access revoked',
        approved
          ? 'User account has been re-enabled.'
          : 'User account has been disabled and will require re-approval.',
      );
      return updated;
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
      showSuccessToast('Invitation ready', 'Share this code to onboard a teammate.');
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
      return { label: 'Used', className: 'bg-emerald-100 text-emerald-700', variant: 'outline' as const };
    }
    if (!code.isActive) {
      return { label: 'Disabled', className: 'text-muted-foreground', variant: 'outline' as const };
    }
    if (code.expiresAt.getTime() < Date.now()) {
      return { label: 'Expired', className: '', variant: 'destructive' as const };
    }
    return { label: 'Active', className: 'bg-emerald-100 text-emerald-700', variant: 'outline' as const };
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

  return (
    <div className="space-y-6">
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
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing || isLoading}>
          {refreshing ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="size-5" />
            Invitation Codes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Optional email (locks code to this address)</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="name@example.com"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleGenerateInvite} disabled={isGeneratingCode} className="w-full sm:w-auto">
                {isGeneratingCode ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <UserPlus className="mr-2 size-4" />
                )}
                Generate code
              </Button>
            </div>
          </div>

          {generatedCode && (
            <div className="flex items-center gap-3 rounded-md border bg-muted/40 px-3 py-2">
              <span className="font-mono text-lg">{generatedCode}</span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => handleCopyCode(generatedCode)}
              >
                {copiedCode === generatedCode ? (
                  <ClipboardCheck className="mr-2 size-4" />
                ) : (
                  <Clipboard className="mr-2 size-4" />
                )}
                Copy
              </Button>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Invitation codes remain active for 7 days unless disabled or redeemed earlier.
          </p>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <KeyRound className="size-4" />
                Active invitation codes
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  Showing {activeCodes.length} active codes
                </span>
                {archivedCodes.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setIsHistoryOpen(true)}>
                    View history
                  </Button>
                )}
              </div>
            </div>

            {isLoading && !hasLoaded ? (
              <div className="py-4 text-center text-muted-foreground">
                <Loader2 className="mx-auto mb-2 size-4 animate-spin" />
                Loading invitation codes…
              </div>
            ) : activeCodes.length === 0 ? (
              <div className="rounded-md border border-dashed bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                No active invitation codes. Generate a new one above.
              </div>
            ) : (
              <div className="rounded-md border overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Expires</TableHead>
                        <TableHead className="w-[160px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeCodes.map((code) => {
                        const status = getInvitationStatus(code);
                        const disableLoading = codeActionLoading[code.id];
                        return (
                          <TableRow key={code.id}>
                            <TableCell className="font-mono text-xs sm:text-sm">{code.code}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {code.email ?? 'Any email'}
                            </TableCell>
                            <TableCell>
                              <Badge variant={status.variant} className={status.className}>
                                {status.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {code.createdAt.toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {code.expiresAt.toLocaleDateString()}
                            </TableCell>
                            <TableCell className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCopyCode(code.code)}
                              >
                                {copiedCode === code.code ? (
                                  <ClipboardCheck className="mr-2 size-4" />
                                ) : (
                                  <Clipboard className="mr-2 size-4" />
                                )}
                                Copy
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-muted-foreground hover:text-destructive"
                                disabled={disableLoading}
                                onClick={() => handleDeactivateCode(code.id)}
                              >
                                {disableLoading ? (
                                  <Loader2 className="mr-2 size-4 animate-spin" />
                                ) : (
                                  <Ban className="mr-2 size-4" />
                                )}
                                Disable
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="w-[92vw] max-w-4xl overflow-hidden p-0">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>Invitation Code History</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6">
            {archivedCodes.length === 0 ? (
              <div className="rounded-md border border-dashed bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
                No archived codes yet.
              </div>
            ) : (
              <div className="rounded-md border">
                <div className="max-h-[60vh] overflow-auto">
                  <Table className="w-full min-w-[720px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Expires</TableHead>
                        <TableHead>Resolved</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {archivedCodes.map((code) => {
                        const status = getInvitationStatus(code);
                        return (
                          <TableRow key={code.id}>
                            <TableCell className="font-mono text-xs sm:text-sm">{code.code}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {code.email ?? 'Any email'}
                            </TableCell>
                            <TableCell>
                              <Badge variant={status.variant} className={status.className}>
                                {status.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {code.createdAt.toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {code.expiresAt.toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {code.usedAt ? code.usedAt.toLocaleString() : '—'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="order-2 lg:order-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-5" /> Pending Approvals
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-6 text-center text-muted-foreground">
                <Loader2 className="mx-auto mb-2 size-5 animate-spin" />
                Loading pending requests…
              </div>
            ) : pendingUsers.length === 0 ? (
              <div className="py-6 text-center text-muted-foreground">
                No pending account requests.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Requested</TableHead>
                    <TableHead className="w-[150px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingUsers.map((pending) => {
                    const loading = userActionLoading[pending.id];
                    return (
                      <TableRow key={pending.id}>
                        <TableCell>{`${pending.firstName} ${pending.lastName}`}</TableCell>
                        <TableCell className="font-mono text-xs sm:text-sm">{pending.email}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {pending.createdAt.toLocaleDateString()}
                        </TableCell>
                        <TableCell className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={loading}
                            onClick={() => handleApproveUser(pending.id)}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={loading}
                            onClick={() => handleRejectUser(pending.id)}
                          >
                            Reject
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="order-1 lg:order-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-5" /> Active Accounts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="py-6 text-center text-muted-foreground">
                <Loader2 className="mx-auto mb-2 size-5 animate-spin" />
                Loading accounts…
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[180px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeUsers.map((account) => {
                    const loading = userActionLoading[account.id];
                    const isSelf = account.id === currentUserId;
                    return (
                      <TableRow key={account.id}>
                        <TableCell>{`${account.firstName} ${account.lastName}`}</TableCell>
                        <TableCell className="font-mono text-xs sm:text-sm">{account.email}</TableCell>
                        <TableCell>
                          <Select
                            value={account.role}
                            onValueChange={(value) =>
                              handleRoleChange(
                                account.id,
                                account.role,
                                value as 'admin' | 'staff',
                                `${account.firstName} ${account.lastName}`.trim() || account.email,
                              )
                            }
                            disabled={loading || isSelf}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="staff">Staff</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {account.isApproved ? (
                            <Badge variant="outline" className="bg-emerald-100 text-emerald-700">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="destructive">Disabled</Badge>
                          )}
                        </TableCell>
                        <TableCell className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={loading || isSelf}
                            onClick={() => handleToggleApproval(account.id, !account.isApproved)}
                          >
                            {account.isApproved ? 'Disable' : 'Re-enable'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
            <Separator />
            <p className="text-xs text-muted-foreground">
              * Admins can approve accounts, generate invitations, and adjust roles. Staff accounts have
              operational access only.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
