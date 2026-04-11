import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { extractErrorMessage, Toast, useToast, PageHeader } from "@shared";
import api from "../api/client";

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast, showSuccess, dismiss } = useToast();

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      await api.put("/auth/change-password", {
        old_password: oldPassword,
        new_password: newPassword,
      });
      await refreshUser();
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      showSuccess("Password changed successfully.");
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to change password. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}
      <PageHeader title="Profile" />

      <div className="max-w-md mx-auto">
      {/* Info Card */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Name</span>
            <span className="text-gray-800 font-medium">{user?.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Login ID</span>
            <span className="text-gray-800 font-mono">{user?.login_id}</span>
          </div>
          {user?.standard && (
            <div className="flex justify-between">
              <span className="text-gray-500">Standard</span>
              <span className="text-gray-800">{user.standard}th</span>
            </div>
          )}
          {user?.email && (
            <div className="flex justify-between">
              <span className="text-gray-500">Email</span>
              <span className="text-gray-800">{user.email}</span>
            </div>
          )}
          {user?.phone && (
            <div className="flex justify-between">
              <span className="text-gray-500">Phone</span>
              <span className="text-gray-800">{user.phone}</span>
            </div>
          )}
        </div>
      </div>

      {/* Change Password */}
      <h2 className="text-lg font-medium text-gray-800 mb-3">
        Change Password
      </h2>
      <form
        onSubmit={handleChangePassword}
        className="bg-white rounded-lg border border-gray-200 p-6 space-y-4"
      >
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Current Password
          </label>
          <input
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            New Password
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Confirm New Password
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Changing..." : "Change Password"}
        </button>
      </form>
      </div>
    </div>
  );
}
