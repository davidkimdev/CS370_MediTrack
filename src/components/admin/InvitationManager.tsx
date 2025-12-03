import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { InvitationManager as InvitationUtils } from '../../utils/invitationManager';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { Copy, Plus, Mail, Calendar, User } from 'lucide-react';
import { logger } from '../../utils/logger';

export function InvitationManagerPanel() {
  const { user } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);
  const [email, setEmail] = useState('');
  const [expiresInDays, setExpiresInDays] = useState('7');
  const [preset, setPreset] = useState('STAFF');
  const [customCode, setCustomCode] = useState('');

  const handleGenerateCode = async () => {
    if (!user?.id) return;

    try {
      setIsGenerating(true);

      const options = {
        email: email.trim() || undefined,
        expiresInDays: parseInt(expiresInDays),
        customCode: customCode.trim() || undefined,
      };

      const code = await InvitationUtils.createInvitation(user.id, options);
      setGeneratedCodes((prev) => [code, ...prev]);

      // Clear form
      setEmail('');
      setCustomCode('');

      logger.info('Invitation code generated successfully', { code });
    } catch (error) {
      logger.error(
        'Failed to generate invitation code',
        error instanceof Error ? error : new Error(String(error)),
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGeneratePreset = async () => {
    if (!user?.id) return;

    try {
      setIsGenerating(true);
      const presetConfig = InvitationUtils.PRESETS[preset as keyof typeof InvitationUtils.PRESETS];

      const code = await InvitationUtils.createInvitation(user.id, {
        expiresInDays: presetConfig.expiresInDays,
      });

      setGeneratedCodes((prev) => [code, ...prev]);
      logger.info('Preset invitation code generated', { preset, code });
    } catch (error) {
      logger.error(
        'Failed to generate preset code',
        error instanceof Error ? error : new Error(String(error)),
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      logger.info('Invitation code copied to clipboard', { code });
    } catch (error) {
      logger.error(
        'Failed to copy code',
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Quick Presets */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="size-5" />
            Quick Generate
          </CardTitle>
          <CardDescription>Generate invitation codes with common presets</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4">
            <div className="space-y-2 flex-1">
              <Label htmlFor="preset">Preset Type</Label>
              <Select value={preset} onValueChange={setPreset}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STAFF">Staff (30 days)</SelectItem>
                  <SelectItem value="ADMIN">Admin (7 days)</SelectItem>
                  <SelectItem value="CLINIC">Clinic (60 days)</SelectItem>
                  <SelectItem value="TEMP">Temporary (3 days)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleGeneratePreset} disabled={isGenerating} className="shrink-0">
              {isGenerating ? (
                <div className="flex items-center gap-2">
                  <div className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Generating...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Plus className="size-4" />
                  Generate
                </div>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Custom Code Generator */}
      <Card>
        <CardHeader>
          <CardTitle>Custom Invitation</CardTitle>
          <CardDescription>Create a custom invitation with specific settings</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email (Optional)</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Leave empty for general use code</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="customCode">Custom Code (Optional)</Label>
                <Input
                  id="customCode"
                  type="text"
                  placeholder="MYCUSTOM"
                  value={customCode}
                  onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
                  maxLength={8}
                />
                <p className="text-xs text-muted-foreground">Leave empty for auto-generation</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="expires">Expires In (Days)</Label>
                <Select value={expiresInDays} onValueChange={setExpiresInDays}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 day</SelectItem>
                    <SelectItem value="3">3 days</SelectItem>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="14">14 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="60">60 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button onClick={handleGenerateCode} disabled={isGenerating} className="w-full">
                  {isGenerating ? (
                    <div className="flex items-center gap-2">
                      <div className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Creating...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Plus className="size-4" />
                      Create Invitation
                    </div>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Generated Codes */}
      {generatedCodes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="size-5" />
              Generated Codes ({generatedCodes.length})
            </CardTitle>
            <CardDescription>Recently generated invitation codes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {generatedCodes.map((code, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="font-mono text-base px-3 py-1">
                      {code}
                    </Badge>
                    <div className="text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="size-3" />
                        Just created
                      </div>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => copyToClipboard(code)}>
                    <Copy className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="size-5" />
            How to Use
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <div className="size-6 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-medium text-primary">1</span>
              </div>
              <p>Generate an invitation code using the forms above</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="size-6 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-medium text-primary">2</span>
              </div>
              <p>Share the code with the person you want to invite</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="size-6 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-medium text-primary">3</span>
              </div>
              <p>They enter the code during registration for instant approval</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="size-6 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-medium text-primary">4</span>
              </div>
              <p>Without a code, new users need manual admin approval</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
