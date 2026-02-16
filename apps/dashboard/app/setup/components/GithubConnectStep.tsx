'use client';

interface GithubConnectStepProps {
  onComplete: () => void;
  onSkip: () => void;
}

export default function GithubConnectStep({ onComplete, onSkip }: GithubConnectStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Connect GitHub
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Connect your GitHub account to automatically sync tickets with GitHub issues and enable CI/CD integration.
        </p>
      </div>

      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
        <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
          <strong>GitHub Integration Features:</strong>
        </p>
        <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1 ml-4 list-disc">
          <li>Automatic issue creation from tickets</li>
          <li>Two-way sync between tickets and issues</li>
          <li>CI/CD pipeline integration</li>
          <li>Automated agent task creation</li>
        </ul>
      </div>

      <div className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md">
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
          You can connect GitHub now or skip and configure it later from the settings page.
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          To connect GitHub, you&apos;ll need to authorize the Support Helper application in your GitHub account or organization.
        </p>
      </div>

      <div className="flex space-x-3">
        <button
          onClick={onComplete}
          className="flex-1 px-4 py-2 bg-gray-800 dark:bg-gray-700 text-white rounded-md hover:bg-gray-900 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 flex items-center justify-center"
        >
          <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
            <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
          </svg>
          Go to GitHub Settings
        </button>

        <button
          onClick={onSkip}
          className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
        >
          Skip for Now
        </button>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
        Note: GitHub integration can be configured anytime from the Settings page
      </p>
    </div>
  );
}
