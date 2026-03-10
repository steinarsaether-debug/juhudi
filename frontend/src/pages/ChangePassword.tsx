import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { ShieldCheck, AlertCircle } from 'lucide-react';
import { authApi, getErrorMessage } from '../services/api';
import { useAuthStore } from '../store/authStore';

interface Form {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export default function ChangePassword() {
  const navigate = useNavigate();
  const { user, setAuth, token } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<Form>();

  const onSubmit = async (data: Form) => {
    setError(null);
    try {
      await authApi.changePassword(data.currentPassword, data.newPassword);
      setSuccess(true);
      if (user && token) {
        setAuth(token, { ...user, mustChangePass: false });
      }
      setTimeout(() => navigate('/'), 1500);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100">
            <ShieldCheck className="h-5 w-5 text-primary-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Change Password</h1>
            <p className="text-sm text-gray-500">You must set a new password to continue</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">
            Password changed successfully. Redirecting...
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="label">Current password</label>
            <input type="password" className={`input ${errors.currentPassword ? 'input-error' : ''}`}
              {...register('currentPassword', { required: 'Required' })} />
          </div>
          <div>
            <label className="label">New password</label>
            <input type="password" className={`input ${errors.newPassword ? 'input-error' : ''}`}
              {...register('newPassword', {
                required: 'Required',
                minLength: { value: 10, message: 'At least 10 characters' },
                validate: v => /[A-Z]/.test(v) && /[a-z]/.test(v) && /\d/.test(v) && /[^A-Za-z0-9]/.test(v)
                  || 'Must include uppercase, lowercase, number, and symbol',
              })} />
            {errors.newPassword && <p className="mt-1 text-xs text-red-600">{errors.newPassword.message}</p>}
          </div>
          <div>
            <label className="label">Confirm new password</label>
            <input type="password" className={`input ${errors.confirmPassword ? 'input-error' : ''}`}
              {...register('confirmPassword', {
                required: 'Required',
                validate: v => v === watch('newPassword') || 'Passwords do not match',
              })} />
            {errors.confirmPassword && <p className="mt-1 text-xs text-red-600">{errors.confirmPassword.message}</p>}
          </div>
          <button type="submit" disabled={isSubmitting || success} className="btn-primary w-full py-2.5">
            {isSubmitting ? 'Saving...' : 'Set new password'}
          </button>
        </form>
      </div>
    </div>
  );
}
