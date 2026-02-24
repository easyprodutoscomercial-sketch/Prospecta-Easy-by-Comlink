'use client';

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

interface OnboardingContextValue {
  tourActive: boolean;
  currentStep: number;
  totalSteps: number;
  startTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTour: () => void;
  completeTour: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

const STORAGE_KEY = 'controlei_tour_completed';

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [tourActive, setTourActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const totalSteps = 7;

  // Auto-start tour if never completed
  useEffect(() => {
    const completed = localStorage.getItem(STORAGE_KEY);
    if (!completed) {
      // Delay to let the UI render first
      const timer = setTimeout(() => setTourActive(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const startTour = useCallback(() => {
    setCurrentStep(0);
    setTourActive(true);
  }, []);

  const nextStep = useCallback(() => {
    setCurrentStep(prev => {
      if (prev >= totalSteps - 1) {
        setTourActive(false);
        localStorage.setItem(STORAGE_KEY, 'true');
        return 0;
      }
      return prev + 1;
    });
  }, [totalSteps]);

  const prevStep = useCallback(() => {
    setCurrentStep(prev => Math.max(0, prev - 1));
  }, []);

  const skipTour = useCallback(() => {
    setTourActive(false);
    localStorage.setItem(STORAGE_KEY, 'true');
    setCurrentStep(0);
  }, []);

  const completeTour = useCallback(() => {
    setTourActive(false);
    localStorage.setItem(STORAGE_KEY, 'true');
    setCurrentStep(0);
  }, []);

  return (
    <OnboardingContext.Provider value={{ tourActive, currentStep, totalSteps, startTour, nextStep, prevStep, skipTour, completeTour }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used within OnboardingProvider');
  return ctx;
}
