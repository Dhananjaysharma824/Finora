import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/useAuthStore';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/FormControls';

const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  email: z.string().trim().email('Enter a valid email').max(120),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Include an uppercase letter')
    .regex(/[a-z]/, 'Include a lowercase letter')
    .regex(/[0-9]/, 'Include a number')
    .regex(/[^A-Za-z0-9]/, 'Include a special character'),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const navigate = useNavigate();
  const registerUser = useAuthStore((s) => s.register);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (values: RegisterFormValues) => {
    setServerError(null);
    try {
      const msg = await registerUser(values.name, values.email, values.password);
      toast.success(msg);
      navigate('/login', { replace: true });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Unable to register');
    }
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
            Create your Finora account
          </h1>
          <p className="mt-1 text-sm text-[#66736A] dark:text-[#9EADA4]">
            Start organizing your personal finances
          </p>
        </div>

        <Card>
          <CardContent className="p-6 space-y-4">
            {serverError ? (
              <div className="rounded-lg border border-[#D9534F]/30 bg-[#FBEAEA] px-3.5 py-2.5 text-xs text-[#B33935] dark:bg-[#361B1A] dark:text-[#EB8582]">
                {serverError}
              </div>
            ) : null}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Input
                label="Full Name"
                placeholder="Alex Sharma"
                autoComplete="name"
                required
                error={errors.name?.message}
                {...register('name')}
              />
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
                placeholder="Min 8 chars, upper, lower, digit, symbol"
                autoComplete="new-password"
                required
                error={errors.password?.message}
                {...register('password')}
              />
              <Button type="submit" className="w-full" isLoading={isSubmitting}>
                Create account
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-[#66736A] dark:text-[#9EADA4]">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-[#2F765B] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
