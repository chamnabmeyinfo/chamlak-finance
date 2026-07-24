import React, { useState } from 'react';
import { CategoryIcon } from './CategoryIcon';

interface LoginViewProps {
  onSignIn: () => void;
  onContinueAsGuest: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onSignIn, onContinueAsGuest }) => {
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    try {
      await onSignIn();
    } catch (error) {
      console.error('Sign-in error:', error);
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 transition-colors duration-300" id="login-container">
      {/* Decorative Blur Accents */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-indigo-200 dark:bg-indigo-900/20 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-teal-200 dark:bg-teal-900/20 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse pointer-events-none" />

      <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-8 shadow-xl relative z-10 transition-all duration-300">
        {/* Branding & Logo */}
        <div className="text-center space-y-4 mb-8">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-indigo-100 dark:shadow-none animate-bounce">
            <CategoryIcon name="Play" size={22} className="fill-white translate-x-[2px] text-white" />
          </div>
          <div className="space-y-1">
            <h1 className="text-lg font-black text-slate-800 dark:text-slate-100 tracking-wider uppercase">
              CHAMLAK <span className="text-indigo-600 dark:text-indigo-400">MEDIA</span>
            </h1>
            <p className="text-[10px] text-teal-600 dark:text-teal-400 font-extrabold uppercase tracking-widest leading-none">
              Finance Hub
            </p>
          </div>
          <div className="pt-2">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
              Manage Your Capital
            </h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-sm mx-auto">
              Track expenses, set monthly target budgets, scan receipts, and visualize your financial growth securely in the cloud.
            </p>
          </div>
        </div>

        {/* Feature Grid */}
        <div className="space-y-4 mb-8">
          <div className="flex items-start gap-3.5 p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-950/40 transition duration-150 border border-transparent hover:border-slate-100 dark:hover:border-slate-800/55">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <CategoryIcon name="TrendingUp" size={16} />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200">Real-Time Syncing</h3>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Secure cloud database synchronized across all devices instantly.</p>
            </div>
          </div>

          <div className="flex items-start gap-3.5 p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-950/40 transition duration-150 border border-transparent hover:border-slate-100 dark:hover:border-slate-800/55">
            <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-100 dark:border-teal-900/40 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
              <CategoryIcon name="Compass" size={16} />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200">Smart AI Diagnostics</h3>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Analyze monthly cash flows and budget absorption thresholds automatically.</p>
            </div>
          </div>

          <div className="flex items-start gap-3.5 p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-950/40 transition duration-150 border border-transparent hover:border-slate-100 dark:hover:border-slate-800/55">
            <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <CategoryIcon name="PiggyBank" size={16} />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200">Limits & Budgets</h3>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Create smart limits per category to safeguard your net savings rate.</p>
            </div>
          </div>
        </div>

        {/* Secure login action */}
        <div className="space-y-3">
          <button
            onClick={handleSignIn}
            disabled={isSigningIn}
            className={`w-full flex items-center justify-center gap-3 py-3.5 px-4 bg-indigo-600 hover:bg-indigo-500 hover:shadow-lg disabled:opacity-75 text-white rounded-2xl text-xs font-bold transition duration-200 cursor-pointer shadow-md shadow-indigo-150 dark:shadow-none ${
              isSigningIn ? 'animate-pulse' : ''
            }`}
            id="btn-google-sign-in"
          >
            <CategoryIcon name="LogIn" size={16} />
            {isSigningIn ? 'Connecting Securely...' : 'Sign In with Google Account'}
          </button>

          <button
            onClick={onContinueAsGuest}
            disabled={isSigningIn}
            className="w-full flex items-center justify-center gap-3 py-3.5 px-4 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-bold transition duration-200 cursor-pointer shadow-3xs"
            id="btn-guest-sign-in"
          >
            <CategoryIcon name="User" size={16} className="text-indigo-600 dark:text-indigo-400" />
            Continue as Guest (Offline Mode)
          </button>
          
          <div className="flex items-center justify-center gap-1.5 pt-1 text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
            <CategoryIcon name="Shield" size={11} className="text-teal-600 dark:text-teal-400" />
            <span>Encrypted cloud storage policy</span>
          </div>
        </div>
      </div>
    </div>
  );
};
