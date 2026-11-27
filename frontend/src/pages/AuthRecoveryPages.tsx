import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { finoraApi } from '@/services/api';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/FormControls';

const forgotSchema = z.object({
  email: z.string().trim().email('Enter a valid email'),
});

const resetSchema = z.object({
  token: z.string().trim().min(16, 'Enter a valid reset token'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Include an uppercase letter')
    .regex(/[a-z]/, 'Include a lowercase letter')
    .regex(/[0-9]/, 'Include a number')
    .regex(/[^A-Za-z0-9]/, 'Include a special character'),
});

const verifySchema = z.object({
  token: z.string().trim().min(16, 'Enter a valid verification token'),
});

function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F7F8F5] px-4 py-10 text-[#18231E] dark:bg-[#0E1512] dark:text-[#EDF2EE]">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 items-center justify-center rounded-lg bg-[#153D32] px-4">
            <img src="/finora_logo.png" alt="Finora" className="h-9 w-auto object-contain" />
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-[-0.02em]">{title}</h1>
          <p className="mt-1 text-sm text-[#66736A] dark:text-[#9EADA4]">{subtitle}</p>
        </div>
        <Card>
          <CardContent className="p-6 space-y-4">{children}</CardContent>
        </Card>
        <p className="text-center text-xs text-[#66736A] dark:text-[#9EADA4]">
          <Link to="/login" className="font-medium text-[#2F765B] hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export function ForgotPasswordPage() {
  const [sentMessage, setSentMessage] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof forgotSchema>>({
    resolver: zodResolver(forgotSchema),
  });

  const onSubmit = async (values: z.infer<typeof forgotSchema>) => {
    try {
      const res = await finoraApi.auth.forgotPassword(values.email);
      setSentMessage(res.message);
      toast.success('Reset instructions sent if account exists');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to request reset');
    }
  };

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter your email to receive a password reset link"
    >
      {sentMessage ? (
        <div className="rounded-lg border border-[#2F765B]/30 bg-[#E5EFE8] px-3.5 py-3 text-xs text-[#153D32]">
          {sentMessage}
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Email"
            type="email"
            placeholder="alex@finora.app"
            required
            error={errors.email?.message}
            {...register('email')}
          />
          <Button type="submit" className="w-full" isLoading={isSubmitting}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthShell>
  );
}

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof resetSchema>>({
    resolver: zodResolver(resetSchema),
    defaultValues: { token: searchParams.get('token') ?? '' },
  });

  const onSubmit = async (values: z.infer<typeof resetSchema>) => {
    setErrorMsg(null);
    try {
      const res = await finoraApi.auth.resetPassword(values.token, values.newPassword);
      toast.success(res.message);
      navigate('/login', { replace: true });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to reset password');
    }
  };

  return (
    <AuthShell title="Set a new password" subtitle="Choose a strong password for your account">
      {errorMsg ? (
        <div className="rounded-lg border border-[#D9534F]/30 bg-[#FBEAEA] px-3.5 py-2.5 text-xs text-[#B33935]">
          {errorMsg}
        </div>
      ) : null}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Reset Token"
          placeholder="Paste reset token"
          required
          error={errors.token?.message}
          {...register('token')}
        />
        <Input
          label="New Password"
          type="password"
          placeholder="Min 8 chars, upper, lower, digit, symbol"
          required
          error={errors.newPassword?.message}
          {...register('newPassword')}
        />
        <Button type="submit" className="w-full" isLoading={isSubmitting}>
          Update password
        </Button>
      </form>
    </AuthShell>
  );
}

export function VerifyEmailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof verifySchema>>({
    resolver: zodResolver(verifySchema),
    defaultValues: { token: searchParams.get('token') ?? '' },
  });

  const onSubmit = async (values: z.infer<typeof verifySchema>) => {
    setErrorMsg(null);
    try {
      const res = await finoraApi.auth.verifyEmail(values.token);
      toast.success(res.message);
      navigate('/login', { replace: true });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Verification failed');
    }
  };

  return (
    <AuthShell title="Verify your email" subtitle="Confirm your Finora email verification token">
      {errorMsg ? (
        <div className="rounded-lg border border-[#D9534F]/30 bg-[#FBEAEA] px-3.5 py-2.5 text-xs text-[#B33935]">
          {errorMsg}
        </div>
      ) : null}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Verification Token"
          placeholder="Paste verification token"
          required
          error={errors.token?.message}
          {...register('token')}
        />
        <Button type="submit" className="w-full" isLoading={isSubmitting}>
          Verify email
        </Button>
      </form>
    </AuthShell>
  );
}
