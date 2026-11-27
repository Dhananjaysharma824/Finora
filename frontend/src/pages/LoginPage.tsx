import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/useAuthStore';
import { useFinoraStore } from '@/stores/useFinoraStore';
import { isBackendConfigured } from '@/services/api';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/FormControls';

const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((s) => s.login);
  const enterDemoMode = useAuthStore((s) => s.enterDemoMode);
  const authError = useAuthStore((s) => s.authError);

  const [serverError, setServerError] = useState<string | null>(null);
  const backendEnabled = isBackendConfigured();
  const redirectTo =
    (location.state as { from?: string } | null)?.from ?? '/dashboard';

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (values: LoginFormValues) => {
    setServerError(null);
    try {
      await login(values.email, values.password);
      await useFinoraStore.getState().syncFromBackend();
      toast.success('Signed in');
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Unable to sign in');
    }
  };

  const handleDemoContinue = () => {
    enterDemoMode();
    navigate('/dashboard', { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F7F8F5] px-4 py-10 text-[#18231E] dark:bg-[#0E1512] dark:text-[#EDF2EE]">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 items-center justify-center rounded-lg bg-[#153D32] px-4">
            <img
              src="/finora_logo.png"
              alt="Finora"
              className="h-9 w-auto object-contain"
            />
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-[-0.02em]">
            Sign in to Finora
          </h1>
          <p className="mt-1 text-sm text-[#66736A] dark:text-[#9EADA4]">
            Your Money. Your Clarity
          </p>
        </div>

        <Card>
          <CardContent className="p-6 space-y-4">
            {serverError || authError ? (
              <div className="rounded-lg border border-[#D9534F]/30 bg-[#FBEAEA] px-3.5 py-2.5 text-xs text-[#B33935] dark:bg-[#361B1A] dark:text-[#EB8582]">
                {serverError ?? authError}
              </div>
            ) : null}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Input
                label="Email"
                type="email"
                placeholder="alex@finora.app"
                autoComplete="email"
                required
                error={errors.email?.message}
                {...register('email')}
              />
              <Input
                label="Password"
                type="password"
                placeholder="Enter your password"
                autoComplete="current-password"
                required
                error={errors.password?.message}
                {...register('password')}
              />
              <div className="flex justify-end">
                <Link
                  to="/forgot-password"
                  className="text-xs font-medium text-[#2F765B] hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <Button type="submit" className="w-full" isLoading={isSubmitting}>
                Sign in
              </Button>
            </form>

            {!backendEnabled ? (
              <div className="border-t border-[#E5E9E3] pt-4 dark:border-[#24332C]">
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  onClick={handleDemoContinue}
                >
                  Continue in Local Demo Mode
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-[#66736A] dark:text-[#9EADA4]">
          New to Finora?{' '}
          <Link to="/register" className="font-medium text-[#2F765B] hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
