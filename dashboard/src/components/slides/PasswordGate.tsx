import { useState, type FormEvent } from 'react';
import { validatePassword } from './passwordValidation';

interface PasswordGateProps {
  onAuthenticate: () => void;
}

export default function PasswordGate({ onAuthenticate }: PasswordGateProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (validatePassword(password)) {
      onAuthenticate();
    } else {
      setError('Incorrect password. Please try again.');
    }
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm"
      >
        <h2 className="mb-1 text-lg font-semibold text-slate-800">
          Slides Access
        </h2>
        <p className="mb-6 text-sm text-slate-500">
          Enter the password to view the presentation.
        </p>

        <label htmlFor="slide-password" className="mb-1 block text-sm font-medium text-slate-700">
          Password
        </label>
        <input
          id="slide-password"
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (error) setError('');
          }}
          className="mb-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="Enter password"
          autoFocus
        />

        {error && (
          <p className="mb-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        {!error && <div className="mb-3" />}

        <button
          type="submit"
          className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Unlock
        </button>
      </form>
    </div>
  );
}
