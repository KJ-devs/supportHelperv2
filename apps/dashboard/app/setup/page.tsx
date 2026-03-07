'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import SetupStepper from './components/SetupStepper';
import AdminCreationStep from './components/AdminCreationStep';
import AiKeyStep from './components/AiKeyStep';
import GithubConnectStep from './components/GithubConnectStep';
import EmailConfigStep from './components/EmailConfigStep';
import SummaryStep from './components/SummaryStep';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function SetupPage() {
  const t = useTranslations('setup');
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [stepLoading, setStepLoading] = useState(false);
  const [config, setConfig] = useState({
    adminCreated: false,
    aiKeyConfigured: false,
    githubConnected: false,
    emailConfigured: false,
  });
  const router = useRouter();

  const STEPS = [
    { id: 1, label: t('steps.adminAccount') },
    { id: 2, label: t('steps.aiApiKey') },
    { id: 3, label: t('steps.github') },
    { id: 4, label: t('steps.email') },
    { id: 5, label: t('steps.summary') },
  ];

  const checkSetupStatus = async () => {
    try {
      const response = await fetch(`${API_URL}/api/setup/status`);
      const data = await response.json();

      if (data.setupCompleted) {
        router.push('/login');
        return;
      }

      if (data.progress && data.progress.currentStep) {
        setCurrentStep(data.progress.currentStep);

        if (data.progress.completedSteps) {
          const completedSteps = data.progress.completedSteps;
          setConfig({
            adminCreated: completedSteps.includes(1),
            aiKeyConfigured: completedSteps.includes(2),
            githubConnected: completedSteps.includes(3),
            emailConfigured: completedSteps.includes(4),
          });
        }
      }
    } catch (error) {
      console.error('Failed to check setup status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkSetupStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveProgress = async (step: number, completedSteps?: number[]) => {
    try {
      const token = localStorage.getItem('auth_token');
      await fetch(`${API_URL}/api/setup/progress`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          currentStep: step,
          completedSteps,
        }),
      });
    } catch (error) {
      console.error('Failed to save progress:', error);
    }
  };

  const handleStepComplete = async (step: number, configUpdate?: Partial<typeof config>) => {
    if (configUpdate) {
      setConfig(prev => ({ ...prev, ...configUpdate }));
    }

    const completedSteps = [];
    for (let i = 1; i <= step; i++) {
      completedSteps.push(i);
    }
    await saveProgress(step + 1, completedSteps);

    setCurrentStep(step + 1);
  };

  const handleAdminComplete = () => {
    handleStepComplete(1, { adminCreated: true });
  };

  const handleAiKeyComplete = () => {
    handleStepComplete(2, { aiKeyConfigured: true });
  };

  const handleAiKeySkip = () => {
    handleStepComplete(2, { aiKeyConfigured: false });
  };

  const handleGithubComplete = () => {
    handleStepComplete(3, { githubConnected: false });
  };

  const handleGithubSkip = () => {
    handleStepComplete(3, { githubConnected: false });
  };

  const handleEmailComplete = () => {
    handleStepComplete(4, { emailConfigured: true });
  };

  const handleEmailSkip = () => {
    handleStepComplete(4, { emailConfigured: false });
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <svg
            className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <p className="text-gray-600 dark:text-gray-400">{t('loadingSetup')}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">{t('title')}</h1>
          <p className="text-gray-600 dark:text-gray-400">{t('subtitle')}</p>
        </div>

        <SetupStepper currentStep={currentStep} steps={STEPS} />

        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md dark:shadow-gray-800/20 p-8 mb-6 transition-all">
          {currentStep === 1 && (
            <AdminCreationStep
              onComplete={handleAdminComplete}
              isLoading={stepLoading}
              setIsLoading={setStepLoading}
            />
          )}

          {currentStep === 2 && (
            <AiKeyStep onComplete={handleAiKeyComplete} onSkip={handleAiKeySkip} />
          )}

          {currentStep === 3 && (
            <GithubConnectStep onComplete={handleGithubComplete} onSkip={handleGithubSkip} />
          )}

          {currentStep === 4 && (
            <EmailConfigStep onComplete={handleEmailComplete} onSkip={handleEmailSkip} />
          )}

          {currentStep === 5 && <SummaryStep config={config} />}
        </div>

        {currentStep > 1 && currentStep < 5 && (
          <div className="flex justify-start">
            <button
              onClick={handleBack}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 text-sm flex items-center"
            >
              <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              {t('back')}
            </button>
          </div>
        )}

        <div className="text-center mt-8">
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('footer')}</p>
        </div>
      </div>
    </main>
  );
}
