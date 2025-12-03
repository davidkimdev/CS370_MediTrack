import { useEffect, useMemo, useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { ShieldCheck, KeyRound, MailPlus, Trash2, RefreshCw } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ProfileService } from '../../services/profileService';
import { showErrorToast, showSuccessToast } from '../../utils/toastUtils';

const buildDisplayName = (first?: string, last?: string) => {
  const safeFirst = first?.trim() ?? '';
  const safeLast = last?.trim() ?? '';
  return [safeFirst, safeLast].filter(Boolean).join(' ') || 'Unnamed User';
};

export function ProfilePage() {
  const { user, profile, updateProfile, refreshUser, isLoading } = useAuth();
  const [firstName, setFirstName] = useState(profile?.firstName ?? '');
  const [lastName, setLastName] = useState(profile?.lastName ?? '');
  const [isSavingName, setIsSavingName] = useState(false);

  const [emailModal, setEmailModal] = useState<null | {
    mode: 'add' | 'replace' | 'remove';
    target?: string;
  }>(null);
  const [pendingEmail, setPendingEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isProcessingEmail, setIsProcessingEmail] = useState(false);

  useEffect(() => {
    setFirstName(profile?.firstName ?? '');
    setLastName(profile?.lastName ?? '');
  }, [profile?.firstName, profile?.lastName]);

  const primaryEmail = useMemo(() => user?.email ?? 'Unknown', [user?.email]);
  const secondaryEmails = useMemo(() => user?.secondaryEmails ?? [], [user?.secondaryEmails]);
  const hasNameChanges = useMemo(() => {
    return (
      (profile?.firstName ?? '') !== firstName.trim() ||
      (profile?.lastName ?? '') !== lastName.trim()
    );
  }, [firstName, lastName, profile?.firstName, profile?.lastName]);

  const closeEmailModal = () => {
    setEmailModal(null);
    setPendingEmail('');
    setPassword('');
    setIsProcessingEmail(false);
  };

  const handleNameSave = async () => {
    if (!user) return;
    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();

    if (!trimmedFirst || !trimmedLast) {
      showErrorToast('Please provide both first and last name.');
      return;
    }

    setIsSavingName(true);
    try {
      await updateProfile({ firstName: trimmedFirst, lastName: trimmedLast });
      await refreshUser();
      showSuccessToast('Profile updated', 'Your name has been saved successfully.');
    } catch (error) {
      showErrorToast(
        'Unable to update profile',
        error instanceof Error ? error.message : 'Please try again later.',
      );
    } finally {
      setIsSavingName(false);
    }
  };

  const handleEmailSubmit = async () => {
    if (!emailModal) return;
    if (!user) {
      showErrorToast('You must be signed in to manage email settings.');
      return;
    }

    const trimmedPassword = password.trim();
    if (!trimmedPassword) {
      showErrorToast('Please enter your account password to continue.');
      return;
    }

    setIsProcessingEmail(true);

    try {
      if (emailModal.mode === 'add') {
        if (!pendingEmail.trim()) {
          throw new Error('Please enter a backup email address.');
        }
        await ProfileService.addSecondaryEmail(pendingEmail, trimmedPassword);
        showSuccessToast('Backup email linked', 'You can now use this email for account recovery.');
      }

      if (emailModal.mode === 'replace') {
        if (!pendingEmail.trim()) {
          throw new Error('Please enter the new primary email address.');
        }
        await ProfileService.replacePrimaryEmail(pendingEmail, trimmedPassword);
        showSuccessToast(
          'Primary email updated',
          'Check your new inbox for a confirmation link to finalize the change.',
        );
      }

      if (emailModal.mode === 'remove') {
        if (!emailModal.target) {
          throw new Error('No email selected to remove.');
        }
        await ProfileService.removeSecondaryEmail(emailModal.target, trimmedPassword);
        showSuccessToast('Backup email removed');
      }

      await refreshUser();
      closeEmailModal();
    } catch (error) {
      setIsProcessingEmail(false);
      showErrorToast(
        'Email update failed',
        error instanceof Error ? error.message : 'Please verify the details and try again.',
      );
    }
  };

  const renderEmailDialog = () => (
    <Dialog open={emailModal !== null} onOpenChange={(open) => (!open ? closeEmailModal() : null)}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>
            {emailModal?.mode === 'add' && 'Add backup email'}
            {emailModal?.mode === 'replace' && 'Change primary email'}
            {emailModal?.mode === 'remove' && 'Remove backup email'}
          </DialogTitle>
          <DialogDescription>
            For security purposes, please confirm your password before making changes to registered
            email addresses.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {emailModal?.mode === 'add' && (
            <div className="space-y-2">
              <Label htmlFor="new-email">Backup email</Label>
              <Input
                id="new-email"
                type="email"
                placeholder="name@example.com"
                value={pendingEmail}
                onChange={(event) => setPendingEmail(event.target.value)}
                autoComplete="email"
              />
            </div>
          )}

          {emailModal?.mode === 'replace' && (
            <div className="space-y-2">
              <Label htmlFor="replace-email">New primary email</Label>
              <Input
                id="replace-email"
                type="email"
                placeholder="name@example.com"
                value={pendingEmail}
                onChange={(event) => setPendingEmail(event.target.value)}
                autoComplete="email"
              />
              <p className="text-xs text-muted-foreground">
                You will receive a confirmation link at the new address. The change completes after
                you confirm via email.
              </p>
            </div>
          )}

          {emailModal?.mode === 'remove' && (
            <Alert variant="destructive">
              <AlertTitle>Remove backup email</AlertTitle>
              <AlertDescription>
                {emailModal.target}
                <br />
                This email address will no longer receive notifications or account recovery prompts.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Password</Label>
            <Input
              id="confirm-password"
              type="password"
              placeholder="Re-enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={closeEmailModal}
            disabled={isProcessingEmail}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleEmailSubmit} disabled={isProcessingEmail}>
            {isProcessingEmail ? 'Processing...' : 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (isLoading) {
    return <div className="py-12 text-center text-muted-foreground">Loading profile…</div>;
  }

  if (!user) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Please sign in to manage your profile settings.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Account Profile</CardTitle>
          <CardDescription>
            Update how your name appears throughout the application.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="first-name">First name</Label>
              <Input
                id="first-name"
                placeholder="First name"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                autoComplete="given-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last-name">Last name</Label>
              <Input
                id="last-name"
                placeholder="Last name"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                autoComplete="family-name"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Display name preview:</span>
            <Badge variant="secondary" className="text-base font-medium">
              {buildDisplayName(firstName, lastName)}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">Role: {profile?.role ?? 'staff'}</Badge>
            {profile?.createdAt && (
              <span>Member since {profile.createdAt.toLocaleDateString()}</span>
            )}
          </div>

          <Separator />

          <div className="flex justify-end">
            <Button
              type="button"
              onClick={handleNameSave}
              disabled={!hasNameChanges || isSavingName}
            >
              {isSavingName ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email & Security</CardTitle>
          <CardDescription>
            Manage the email addresses connected to your account. Re-entering your password is
            required for every change.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> Primary email
            </Label>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/40 px-3 py-2">
              <div>
                <p className="text-sm font-medium text-foreground">{primaryEmail}</p>
                <p className="text-xs text-muted-foreground">Use this address to sign in.</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEmailModal({ mode: 'replace' });
                  setPendingEmail('');
                  setPassword('');
                }}
              >
                <RefreshCw className="mr-2 h-4 w-4" /> Change email
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <KeyRound className="h-4 w-4" /> Backup emails
              </Label>
              <Button
                size="sm"
                variant="secondary"
                disabled={secondaryEmails.length >= 1}
                onClick={() => {
                  setEmailModal({ mode: 'add' });
                  setPendingEmail('');
                  setPassword('');
                }}
              >
                <MailPlus className="mr-2 h-4 w-4" /> Add backup
              </Button>
            </div>

            {secondaryEmails.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No backup emails registered yet. We recommend adding one for account recovery.
              </p>
            ) : (
              <div className="space-y-2">
                {secondaryEmails.map((email) => (
                  <div
                    key={email}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2"
                  >
                    <span className="text-sm text-foreground">{email}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        setEmailModal({ mode: 'remove', target: email });
                        setPassword('');
                        setPendingEmail('');
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Remove backup email</span>
                    </Button>
                  </div>
                ))}
                {secondaryEmails.length >= 1 && (
                  <p className="text-xs text-muted-foreground">
                    You can keep only one backup email linked at a time.
                  </p>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {renderEmailDialog()}
    </div>
  );
}
