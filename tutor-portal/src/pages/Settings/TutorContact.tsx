import { useEffect, useState } from "react";
import { PageHeader, Button, LoadingSpinner, Toast, useToast } from "@shared";
import api from "../../api/client";

interface TutorContact {
  email: string | null;
  whatsapp: string | null;
}

export default function TutorContactSettings() {
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast, showSuccess, showApiError, dismiss } = useToast();

  useEffect(() => {
    api
      .get<TutorContact>("/settings/tutor-contact")
      .then((res) => {
        setEmail(res.data.email || "");
        setWhatsapp(res.data.whatsapp || "");
      })
      .catch((err) => showApiError(err, "Failed to load tutor contact."))
      .finally(() => setLoading(false));
  }, [showApiError]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put("/settings/tutor-contact", {
        email: email.trim() || null,
        whatsapp: whatsapp.trim() || null,
      });
      showSuccess("Tutor contact updated.");
    } catch (err) {
      showApiError(err, "Failed to save tutor contact.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner fullPage />;

  return (
    <div className="max-w-xl">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}
      <PageHeader
        title="Tutor Contact"
        subtitle="Shown to students when they tap 'Contact Tutor'."
      />

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tutor@example.com"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp number</label>
          <input
            type="tel"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="+919876543210"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-500 mt-1">
            Include country code. Students will be linked to <code>wa.me/&lt;digits&gt;</code>.
          </p>
        </div>
        <div className="flex justify-end pt-2">
          <Button color="primary" onClick={handleSave} loading={saving}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
