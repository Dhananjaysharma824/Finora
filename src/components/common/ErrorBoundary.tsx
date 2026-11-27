import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(): void {
    // Intentionally avoid logging sensitive financial state or stack traces to console in production
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#F7F8F5] px-4 text-[#18231E] dark:bg-[#0E1512] dark:text-[#EDF2EE]">
          <div className="max-w-md rounded-xl border border-[#E5E9E3] bg-white p-6 text-center shadow-sm dark:border-[#24332C] dark:bg-[#151E1A]">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[#FBEAEA] text-[#D9534F]">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h1 className="font-display text-lg font-semibold">Something went wrong</h1>
            <p className="mt-1.5 text-xs leading-relaxed text-[#66736A] dark:text-[#9EADA4]">
              Finora encountered an unexpected error while rendering this view. Your locally stored financial records were not modified.
            </p>
            <div className="mt-5 flex justify-center gap-2.5">
              <Button
                variant="primary"
                size="sm"
                onClick={() => window.location.assign('/dashboard')}
                leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
              >
                Reload Dashboard
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
