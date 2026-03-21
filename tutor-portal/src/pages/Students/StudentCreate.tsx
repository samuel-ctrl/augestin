import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CredentialCard, Toast, useToast, standardOptions } from "@shared";
import api from "../../api/client";

interface Credentials {
  login_id: string;
  password: string;
}

export default function StudentCreate() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [standard, setStandard] = useState("");
  const [loading, setLoading] = useState(false);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const { toast, showApiError, dismiss } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload: Record<string, string> = { name };
      if (email) payload.email = email;
      if (phone) payload.phone = phone;
      if (standard) payload.standard = standard;

      const res = await api.post("/students", payload);
      setCredentials(res.data);
    } catch (err: unknown) {
      showApiError(err, "Failed to create student. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (credentials) {
    return (
      <div className="max-w-md mx-auto">
        <h1 className="text-xl font-semibold text-gray-800 mb-6">
          Student Created
        </h1>
        <CredentialCard
          loginId={credentials.login_id}
          password={credentials.password}
        />
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => {
              setCredentials(null);
              setName("");
              setEmail("");
              setPhone("");
              setStandard("");
            }}
            className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors"
          >
            Create Another
          </button>
          <button
            onClick={() => navigate("/students")}
            className="px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 transition-colors"
          >
            Back to Students
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}
      <h1 className="text-xl font-semibold text-gray-800 mb-6">
        Add New Student
      </h1>
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-lg border border-gray-200 p-6 space-y-4"
      >
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="Optional — used as login ID if provided"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Phone
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="Optional — used as login ID if no email"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Standard
          </label>
          <select
            value={standard}
            onChange={(e) => setStandard(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="">Select standard</option>
            {standardOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => navigate("/students")}
            className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Creating..." : "Create Student"}
          </button>
        </div>
      </form>
    </div>
  );
}
