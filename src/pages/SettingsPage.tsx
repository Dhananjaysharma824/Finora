import { useEffect, useState } from 'react';
import { Download, RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useFinoraStore } from '@/stores/useFinoraStore';
import type { CurrencyCode, DateFormatOption, NumberFormatOption, ThemeMode } from '@/types/finance';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/FormControls';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

export default function SettingsPage() {
  const profile = useFinoraStore((s) => s.profile);
  const preferences = useFinoraStore((s) => s.preferences);
  const accounts = useFinoraStore((s) => s.accounts);
  const transactions = useFinoraStore((s) => s.transactions);
  const budgets = useFinoraStore((s) => s.budgets);
  const goals = useFinoraStore((s) => s.goals);
  const recurringPayments = useFinoraStore((s) => s.recurringPayments);
  const updateProfile = useFinoraStore((s) => s.updateProfile);
  const updatePreferences = useFinoraStore((s) => s.updatePreferences);
  const resetDemoData = useFinoraStore((s) => s.resetDemoData);
  const clearAllData = useFinoraStore((s) => s.clearAllData);

  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [role, setRole] = useState(profile.role);

  useEffect(() => {
    setName(profile.name);
    setEmail(profile.email);
    setRole(profile.role);
  }, [profile]);

  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      toast.error('Name and email are required');
      return;
    }
    updateProfile({ name: name.trim(), email: email.trim(), role: role.trim() });
    toast.success('Profile updated');
  };

  const handleExportAllJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      profile,
      preferences,
      accounts,
      transactions,
      budgets,
      goals,
      recurringPayments,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finora-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Full data backup exported');
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="font-display text-2xl font-semibold tracking-[-0.02em] text-[#18231E] dark:text-[#EDF2EE]">
          Settings
        </h2>
        <p className="mt-0.5 text-sm text-[#66736A] dark:text-[#9EADA4]">
          Manage your profile, currency, appearance, alerts, and local data.
        </p>
      </div>

      {/* PROFILE */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Personal details displayed across Finora</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <Input
                label="Email Address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <Input
              label="Role / Tagline"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            />
            <div className="flex justify-end">
              <Button type="submit">Save Profile</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* PREFERENCES & APPEARANCE */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Preferences & Appearance</CardTitle>
            <CardDescription>Formatting and theme settings persist automatically</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="Display Currency"
              value={preferences.currency}
              onChange={(e) =>
                updatePreferences({ currency: e.target.value as CurrencyCode })
              }
            >
              <option value="INR">Indian Rupee (₹ INR)</option>
              <option value="USD">US Dollar ($ USD)</option>
              <option value="EUR">Euro (€ EUR)</option>
              <option value="GBP">British Pound (£ GBP)</option>
            </Select>

            <Select
              label="Theme"
              value={preferences.theme}
              onChange={(e) =>
                updatePreferences({ theme: e.target.value as ThemeMode })
              }
            >
              <option value="light">Light Mode</option>
              <option value="dark">Dark Mode</option>
              <option value="system">System Preference</option>
            </Select>

            <Select
              label="Date Format"
              value={preferences.dateFormat}
              onChange={(e) =>
                updatePreferences({ dateFormat: e.target.value as DateFormatOption })
              }
            >
              <option value="dd MMM yyyy">26 Nov 2026</option>
              <option value="MM/dd/yyyy">11/26/2026</option>
              <option value="yyyy-MM-dd">2026-11-26</option>
            </Select>

            <Select
              label="Number Format"
              value={preferences.numberFormat}
              onChange={(e) =>
                updatePreferences({ numberFormat: e.target.value as NumberFormatOption })
              }
            >
              <option value="en-IN">Indian (1,50,000.00)</option>
              <option value="en-US">International (150,000.00)</option>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* NOTIFICATIONS */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Notification Preferences</CardTitle>
            <CardDescription>Choose which automated insights Finora generates</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {(
            [
              ['budgetAlerts', 'Budget alerts (80% warning & 100% exceeded)'],
              ['paymentReminders', 'Upcoming recurring payment reminders'],
              ['savingsMilestones', 'Savings goal milestone celebrations'],
            ] as const
          ).map(([key, label]) => (
            <label
              key={key}
              className="flex items-center justify-between rounded-lg border border-[#E5E9E3] px-4 py-3 text-sm dark:border-[#24332C] cursor-pointer"
            >
              <span>{label}</span>
              <input
                type="checkbox"
                checked={preferences.alerts[key]}
                onChange={(e) =>
                  updatePreferences({
                    alerts: {
                      ...preferences.alerts,
                      [key]: e.target.checked,
                    },
                  })
                }
                className="h-4 w-4 rounded accent-[#153D32]"
              />
            </label>
          ))}
        </CardContent>
      </Card>

      {/* DATA MANAGEMENT */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Data Management</CardTitle>
            <CardDescription>Export your local ledger or reset demonstration records</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            onClick={handleExportAllJson}
            leftIcon={<Download className="h-4 w-4" />}
          >
            Export All Data (JSON)
          </Button>
          <Button
            variant="secondary"
            onClick={() => setConfirmResetOpen(true)}
            leftIcon={<RotateCcw className="h-4 w-4" />}
          >
            Reset Demo Data
          </Button>
          <Button
            variant="danger"
            onClick={() => setConfirmClearOpen(true)}
            leftIcon={<Trash2 className="h-4 w-4" />}
          >
            Clear Local Data
          </Button>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmResetOpen}
        onClose={() => setConfirmResetOpen(false)}
        onConfirm={() => {
          resetDemoData();
          toast.success('Demo data restored');
        }}
        title="Reset Demo Data"
        description="This will replace your current local transactions, budgets, and goals with Finora's default demonstration dataset."
        confirmLabel="Reset Demo Data"
        variant="primary"
      />

      <ConfirmDialog
        open={confirmClearOpen}
        onClose={() => setConfirmClearOpen(false)}
        onConfirm={() => {
          clearAllData();
          toast.success('Local application data cleared');
        }}
        title="Clear All Local Data"
        description="This permanently deletes all transactions, budgets, goals, and recurring reminders stored in this browser."
        confirmLabel="Clear Everything"
      />
    </div>
  );
}
