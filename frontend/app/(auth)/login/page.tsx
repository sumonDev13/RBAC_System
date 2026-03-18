'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Eye, EyeOff, ArrowRight, Loader2, Diamond, Hexagon, Circle } from 'lucide-react';
import { useState } from 'react';
import { useAppDispatch, useAppSelector, selectAuthError, selectIsLoading, selectUser } from '@/store/hooks';
import { loginThunk, clearError } from '@/store/slices/authSlice';

const schema = z.object({
  email:    z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});
type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const dispatch  = useAppDispatch();
  const router    = useRouter();
  const user      = useAppSelector(selectUser);
  const isLoading = useAppSelector(selectIsLoading);
  const authError = useAppSelector(selectAuthError);
  const [showPass, setShowPass] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  // Redirect if already logged in
  useEffect(() => {
    if (user) router.replace('/dashboard');
  }, [user]);

  useEffect(() => {
    return () => { dispatch(clearError()); };
  }, []);

  async function onSubmit(data: FormData) {
    const result = await dispatch(loginThunk(data));
    if (loginThunk.fulfilled.match(result)) {
      toast.success('Welcome back!');
      router.replace('/dashboard');
    }
  }

  const features = [
    { icon: <Hexagon size={14} />, label: 'Atomic permission model' },
    { icon: <Circle   size={14} />, label: 'Grant ceiling enforcement' },
    { icon: <Diamond  size={14} />, label: 'Full audit trail' },
  ];

  return (
    <div className="min-h-screen flex bg-base relative overflow-hidden">
      {/* Grid bg */}
      <div className="absolute inset-0 grid-bg pointer-events-none" />
      <div className="absolute -top-1/4 -left-1/4 w-[600px] h-[600px] rounded-full bg-accent/5 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-1/4 -right-1/4 w-[500px] h-[500px] rounded-full bg-success/4 blur-3xl pointer-events-none" />

      {/* Left branding panel */}
      <div className="hidden lg:flex flex-1 flex-col justify-center px-16 border-r border-border relative">
        <div className="animate-fade-up">
          {/* Logo */}
          <div className="w-12 h-12 rounded-xl bg-accent/10 border border-accent/25 flex items-center justify-center mb-8">
            <svg width="24" height="24" viewBox="0 0 26 26" fill="none">
              <path d="M4 13L13 4L22 13L13 22L4 13Z" stroke="#00D4FF" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M13 8L18 13L13 18L8 13L13 8Z" fill="#00D4FF" opacity="0.6"/>
            </svg>
          </div>

          <h1 className="font-display text-5xl font-extrabold leading-[1.1] text-primary mb-5">
            Dynamic<br/>
            <span className="text-accent">Permission</span><br/>
            Control.
          </h1>
          <p className="text-secondary text-[0.9375rem] leading-relaxed max-w-sm mb-12">
            A fully dynamic RBAC platform where access is granted atom by atom — no hardcoded roles, no developer required.
          </p>

          <div className="flex flex-col gap-3">
            {features.map((f, i) => (
              <div key={i} className={`flex items-center gap-3 animate-fade-up animation-delay-${(i + 1) * 100}`}>
                <div className="w-8 h-8 rounded-lg bg-elevated border border-border flex items-center justify-center text-accent">
                  {f.icon}
                </div>
                <span className="text-secondary text-sm">{f.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="w-full lg:max-w-[440px] flex flex-col justify-center px-10 lg:px-14 py-12">
        <div className="animate-fade-up animation-delay-100">
          <p className="font-display text-xs font-semibold tracking-[0.1em] uppercase text-accent mb-3">
            Welcome back
          </p>
          <h2 className="font-display text-3xl font-bold text-primary mb-8">
            Sign in to your account
          </h2>

          {/* Error */}
          {authError && (
            <div className="flex items-center gap-2.5 p-3.5 mb-5 bg-danger/10 border border-danger/20 rounded-md text-danger text-sm animate-fade-in">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {authError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label className="input-label">Email address</label>
              <input
                {...register('email')}
                type="email"
                className={`input-field ${errors.email ? 'error' : ''}`}
                placeholder="admin@example.com"
                autoComplete="email"
              />
              {errors.email && (
                <span className="text-danger text-xs">{errors.email.message}</span>
              )}
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label className="input-label">Password</label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPass ? 'text' : 'password'}
                  className={`input-field pr-11 ${errors.password ? 'error' : ''}`}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-secondary transition-colors"
                >
                  {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              {errors.password && (
                <span className="text-danger text-xs">{errors.password.message}</span>
              )}
            </div>

            <button
              type="submit"
              className="btn-primary w-full py-3 text-[0.9375rem] mt-1"
              disabled={isLoading}
            >
              {isLoading ? (
                <><Loader2 size={16} className="animate-spin" /> Signing in…</>
              ) : (
                <>Sign in <ArrowRight size={16} /></>
              )}
            </button>
          </form>

          <p className="mt-8 text-xs text-muted text-center">
            Protected by JWT · Tokens expire after 15 minutes
          </p>
        </div>
      </div>
    </div>
  );
}