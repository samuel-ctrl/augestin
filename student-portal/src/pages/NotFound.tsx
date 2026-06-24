import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-200 dark:text-gray-600 mb-4">404</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6">Page not found</p>
        <Link
          to="/self-study"
          className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 transition-colors"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
