import { useEffect, useState } from "react";
import api from "../../api/client";

interface TutorContact {
  email: string | null;
  whatsapp: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ContactTutorDialog({ open, onClose }: Props) {
  const [contact, setContact] = useState<TutorContact | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get<TutorContact>("/settings/tutor-contact")
      .then((res) => {
        if (!cancelled) setContact(res.data);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load tutor contact details.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  const whatsappDigits = (contact?.whatsapp || "").replace(/[^\d]/g, "");

  return (
    <div
      className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-sm p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-4">Contact Tutor</h3>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          Reach out to your tutor directly:
        </p>

        {loading && (
          <div className="text-sm text-gray-500 dark:text-gray-400 py-2">Loading…</div>
        )}
        {error && (
          <div className="text-sm text-red-600 py-2">{error}</div>
        )}

        {!loading && !error && (
          <div className="space-y-3">
            {contact?.email ? (
              <a
                href={`mailto:${contact.email}`}
                className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <span className="text-xl">📧</span>
                <div>
                  <p className="text-sm font-medium text-blue-900">Email</p>
                  <p className="text-xs text-blue-700 break-all">{contact.email}</p>
                </div>
              </a>
            ) : (
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg text-gray-400 dark:text-gray-500">
                <span className="text-xl">📧</span>
                <p className="text-xs">Email not configured</p>
              </div>
            )}

            {whatsappDigits ? (
              <a
                href={`https://wa.me/${whatsappDigits}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
              >
                <span className="text-xl">💬</span>
                <div>
                  <p className="text-sm font-medium text-green-900">WhatsApp</p>
                  <p className="text-xs text-green-700">{contact?.whatsapp}</p>
                </div>
              </a>
            ) : (
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg text-gray-400 dark:text-gray-500">
                <span className="text-xl">💬</span>
                <p className="text-xs">WhatsApp not configured</p>
              </div>
            )}
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full mt-4 px-4 py-2 text-sm text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}
