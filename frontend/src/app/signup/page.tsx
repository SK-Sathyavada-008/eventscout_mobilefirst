"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function SignupPage() {
  const { signup, isAuthenticated } = useAuth();
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated) router.replace("/");
  }, [isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedUsername = username.trim();
    if (trimmedUsername.length < 2) {
      setError("Username must be at least 2 characters.");
      return;
    }

    if (!/^[a-zA-Z0-9_\-]+$/.test(trimmedUsername)) {
      setError("Username can only contain letters, numbers, hyphens, and underscores.");
      return;
    }

    if (!email.includes("@") || !email.includes(".")) {
      setError("Please enter a valid email address.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      await signup(trimmedUsername, email, password);
      router.push("/");
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Signup failed. Please check your details and try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-[#131b2e] rounded-3xl shadow-2xl border border-slate-800 p-6 sm:p-8">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-black text-2xl mx-auto mb-3 shadow-lg shadow-indigo-600/30">
              E
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              Create Account
            </h1>
            <p className="text-slate-400 mt-1 text-xs">
              Discover, personalize, and save high-impact tech opportunities.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div
              id="signup-error"
              className="mb-5 rounded-xl bg-red-950/40 border border-red-800/50 px-4 py-3 text-xs text-red-300 flex items-start gap-2"
            >
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label
                htmlFor="signup-username"
                className="block text-xs font-bold text-slate-300 mb-1.5"
              >
                Username
              </label>
              <input
                id="signup-username"
                type="text"
                required
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors text-sm"
                placeholder="e.g. shreya"
              />
            </div>

            <div>
              <label
                htmlFor="signup-email"
                className="block text-xs font-bold text-slate-300 mb-1.5"
              >
                Email address
              </label>
              <input
                id="signup-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors text-sm"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="signup-password"
                className="block text-xs font-bold text-slate-300 mb-1.5"
              >
                Password (min. 6 characters)
              </label>
              <input
                id="signup-password"
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors text-sm"
                placeholder="••••••••"
              />
            </div>

            <div>
              <label
                htmlFor="signup-confirm"
                className="block text-xs font-bold text-slate-300 mb-1.5"
              >
                Confirm password
              </label>
              <input
                id="signup-confirm"
                type="password"
                required
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors text-sm"
                placeholder="••••••••"
              />
            </div>

            <button
              id="signup-submit"
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-3 py-3.5 px-4 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 text-sm"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span>Creating account…</span>
                </>
              ) : (
                <span>Create account</span>
              )}
            </button>
          </form>

          {/* Footer */}
          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
            >
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
