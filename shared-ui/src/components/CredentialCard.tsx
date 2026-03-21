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
      className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

export function CredentialCard({ loginId, password }: CredentialCardProps) {
  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-5">
      <h3 className="text-sm font-semibold text-green-800 mb-3">
        Student credentials created successfully
      </h3>
      <div className="space-y-3">
        <div className="flex items-center justify-between bg-white rounded-lg px-4 py-2.5 border border-green-100">
          <div>
            <span className="text-xs text-gray-400 block">Login ID</span>
            <span className="text-sm font-mono font-medium text-gray-800">{loginId}</span>
          </div>
          <CopyButton text={loginId} />
        </div>
        <div className="flex items-center justify-between bg-white rounded-lg px-4 py-2.5 border border-green-100">
          <div>
            <span className="text-xs text-gray-400 block">Password</span>
            <span className="text-sm font-mono font-medium text-gray-800">{password}</span>
          </div>
          <CopyButton text={password} />
        </div>
      </div>
      <p className="text-xs text-green-600 mt-3">
        Please share these credentials securely. The password cannot be retrieved later.
      </p>
    </div>
  );
}
