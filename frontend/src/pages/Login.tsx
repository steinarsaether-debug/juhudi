import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Leaf, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { authApi, getErrorMessage } from '../services/api';
import { useAuthStore } from '../store/authStore';

interface LoginForm {
  email: string;
  password: string;
}

export default function Login() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>();

  const onSubmit = async (data: LoginForm) => {
    setError(null);
    try {
      const res = await authApi.login(data.email, data.password);
      setAuth(res.token, res.user);
      navigate(res.user.mustChangePass ? '/change-password' : '/');
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 to-primary-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-700 mb-4">
              <Leaf className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Juhudi Kilimo</h1>
            <p className="text-sm text-gray-500 mt-1">Loan Officer Portal</p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="label" htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                className={`input ${errors.email ? 'input-error' : ''}`}
                placeholder="you@juhudikilimo.co.ke"
                {...register('email', { required: 'Email is required' })}
              />
              {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
            </div>

            <div>
              <label className="label" htmlFor="password">Password</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className={`input pr-10 ${errors.password ? 'input-error' : ''}`}
                  placeholder="Enter your password"
                  {...register('password', { required: 'Password is required' })}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
            </div>

            <button type="submit" disabled={isSubmitting} className="btn-primary w-full py-2.5 mt-2">
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Signing in...
                </span>
              ) : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-gray-400">
            Authorised users only. All access is monitored and logged.
          </p>
        </div>

        <p className="mt-4 text-center text-xs text-primary-200">
          Juhudi Kilimo Ltd &bull; Kenya CBK Licensed &bull; KDPA Compliant
        </p>
      </div>
    </div>
  );
}
