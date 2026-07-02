import React from "react";

type TestStatus = "submitted" | "pending" | "not_available";

interface StatsRowProps {
  videosWatched: { done: number; total: number };
  topicsComplete: { done: number; total: number };
  quizAvgScore: number | null;
  testStatus: TestStatus;
}

const testStatusLabel: Record<TestStatus, string> = {
  submitted: "Submitted",
  pending: "Pending",
  not_available: "Not available",
};

const testStatusClass: Record<TestStatus, string> = {
  submitted: "text-green-600 dark:text-green-400",
  pending: "text-amber-600 dark:text-amber-400",
  not_available: "text-gray-400 dark:text-gray-500",
};

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-lg font-bold text-gray-900 dark:text-gray-50 leading-tight">{value}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{label}</p>
      </div>
    </div>
  );
}

export default function StatsRow({ videosWatched, topicsComplete, quizAvgScore, testStatus }: StatsRowProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      <StatCard
        icon={<svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>}
        label="Videos Watched"
        value={`${videosWatched.done}/${videosWatched.total}`}
      />
      <StatCard
        icon={<svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        label="Topics Complete"
        value={`${topicsComplete.done}/${topicsComplete.total}`}
      />
      <StatCard
        icon={<svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3v-6m-3 6v-2m-2 8h10a2 2 0 002-2V6a2 2 0 00-2-2H7a2 2 0 00-2 2v13a2 2 0 002 2z" /></svg>}
        label="Quiz Avg Score"
        value={quizAvgScore == null ? "—" : `${Math.round(quizAvgScore)}%`}
      />
      <StatCard
        icon={<svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
        label="Test"
        value={<span className={testStatusClass[testStatus]}>{testStatusLabel[testStatus]}</span>}
      />
    </div>
  );
}
