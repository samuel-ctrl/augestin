import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CredentialCard, Toast, useToast, Button } from "@shared";
import api from "../../api/client";
import { useLookups } from "../../context/LookupContext";

interface Credentials {
  login_id: string;
  password: string;
}

export default function StudentCreate() {
  const navigate = useNavigate();
  const { standards, sections } = useLookups();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [standard, setStandard] = useState("");
  const [section, setSection] = useState("");
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
      payload.standard = standard;
      if (section) payload.section = section;

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
          <Button
            variant="outline" color="secondary"
            onClick={() => {
              setCredentials(null);
              setName("");
              setEmail("");
              setPhone("");
              setStandard("");
              setSection("");
            }}
          >
            Create Another
          </Button>
          <Button color="primary" onClick={() => navigate("/students")}>
            Back to Students
          </Button>
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
            Standard *
          </label>
          <select
            value={standard}
            onChange={(e) => setStandard(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="">Select standard</option>
            {standards.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Section
          </label>
          <select
            value={section}
            onChange={(e) => setSection(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="">Select section (optional)</option>
            {sections.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-3">
          <Button type="button" variant="outline" color="secondary" fullWidth onClick={() => navigate("/students")}>
            Cancel
          </Button>
          <Button type="submit" color="success" fullWidth loading={loading}>
            Create Student
          </Button>
        </div>
      </form>
    </div>
  );
}
