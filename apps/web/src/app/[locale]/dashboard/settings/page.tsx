"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { DashboardLayoutClient } from "../DashboardLayoutClient";
import { Card, CardContent, CardHeader, CardTitle, Button, LoadingSpinner } from "@/components/ui";
import { Lock, Bell, Globe, DollarSign } from "lucide-react";
import { authService, ApiError } from "@/lib/api";

export default function CustomerSettingsPage({ params: { locale } }: { params: { locale: string } }) {
  const t = useTranslations();
  
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordError(t("auth.resetPassword.errors.passwordMismatch", { defaultValue: "New passwords do not match." }));
      return;
    }

    setIsChangingPassword(true);
    setPasswordError(null);
    setPasswordSuccess(false);

    try {
      await authService.changePassword(currentPassword, newPassword);
      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      if (err instanceof ApiError) {
        setPasswordError(err.message);
      } else {
        setPasswordError("An unexpected error occurred while changing your password.");
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <DashboardLayoutClient locale={locale}>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {t("dashboard.settings.title", { defaultValue: "Account Settings" })}
        </h1>
        <p className="text-gray-600">
          {t("dashboard.settings.subtitle", { defaultValue: "Manage your account security and preferences." })}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Security / Password */}
        <div className="lg:col-span-2 space-y-8">
          <Card>
            <CardHeader className="border-b bg-gray-50/50 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Lock className="w-5 h-5 text-gray-500" />
                {t("dashboard.settings.changePassword", { defaultValue: "Change Password" })}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handlePasswordChange} className="space-y-4">
                {passwordError && (
                  <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
                    {passwordError}
                  </div>
                )}
                {passwordSuccess && (
                  <div className="p-3 bg-green-50 text-green-700 text-sm rounded-lg border border-green-200">
                    {t("dashboard.settings.passwordChanged", { defaultValue: "Your password has been changed successfully." })}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t("dashboard.settings.currentPassword", { defaultValue: "Current Password" })}
                  </label>
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t("dashboard.settings.newPassword", { defaultValue: "New Password" })}
                  </label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t("dashboard.settings.confirmNewPassword", { defaultValue: "Confirm New Password" })}
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                  />
                </div>

                <div className="pt-2">
                  <Button type="submit" disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}>
                     {isChangingPassword ? <LoadingSpinner size="sm" className="mr-2" /> : null}
                     {t("dashboard.settings.updatePassword", { defaultValue: "Update Password" })}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Preferences Placeholder */}
          <Card>
            <CardHeader className="border-b bg-gray-50/50 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Globe className="w-5 h-5 text-gray-500" />
                {t("dashboard.settings.regional", { defaultValue: "Regional Preferences" })}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900">Language</h4>
                  <p className="text-sm text-gray-500">Select your preferred language.</p>
                </div>
                <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary">
                  <option value="en">English (US)</option>
                  <option value="si">Sinhala</option>
                  <option value="ta">Tamil</option>
                </select>
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <div>
                  <h4 className="font-medium text-gray-900">Currency</h4>
                  <p className="text-sm text-gray-500">Select your preferred currency.</p>
                </div>
                <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary">
                  <option value="LKR">LKR (Rs)</option>
                  <option value="USD">USD ($)</option>
                </select>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar settings */}
        <div className="space-y-8">
          <Card>
            <CardHeader className="border-b bg-gray-50/50 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Bell className="w-5 h-5 text-gray-500" />
                {t("dashboard.settings.notifications", { defaultValue: "Notifications" })}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="pr-4">
                  <h4 className="text-sm font-medium text-gray-900">Email Notifications</h4>
                  <p className="text-xs text-gray-500">Receive updates and booking confirmations via email.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={emailNotifications} onChange={(e) => setEmailNotifications(e.target.checked)} />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <div className="pr-4">
                  <h4 className="text-sm font-medium text-gray-900">SMS Notifications</h4>
                  <p className="text-xs text-gray-500">Receive trip updates directly on your phone.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={smsNotifications} onChange={(e) => setSmsNotifications(e.target.checked)} />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayoutClient>
  );
}
