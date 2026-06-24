import React, { useState } from "react";

interface CredentialCardProps {
  loginId: string;
  password: string;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition-colors"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

export function CredentialCard({ loginId, password }: CredentialCardProps) {
  return (
    <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-3 sm:p-5">
      <h3 className="text-sm font-semibold text-green-800 dark:text-green-300 mb-3">
        Student credentials created successfully
      </h3>
      <div className="space-y-3">
        <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg px-3 py-2 sm:px-4 sm:py-2.5 border border-green-100 dark:border-green-900">
          <div className="min-w-0 flex-1 mr-2">
            <span className="text-xs text-gray-400 dark:text-gray-500 block">Login ID</span>
            <span className="text-sm font-mono font-medium text-gray-800 dark:text-gray-100 break-all">{loginId}</span>
          </div>
          <CopyButton text={loginId} />
        </div>
        <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg px-3 py-2 sm:px-4 sm:py-2.5 border border-green-100 dark:border-green-900">
          <div className="min-w-0 flex-1 mr-2">
            <span className="text-xs text-gray-400 dark:text-gray-500 block">Password</span>
            <span className="text-sm font-mono font-medium text-gray-800 dark:text-gray-100 break-all">{password}</span>
          </div>
          <CopyButton text={password} />
        </div>
      </div>
      <p className="text-xs text-green-600 dark:text-green-400 mt-3">
        Please share these credentials securely. The password cannot be retrieved later.
      </p>
    </div>
  );
}
