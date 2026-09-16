"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import PWAInstallModal from "@/components/PWAInstallModal";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import SuggestSourceModal from "@/components/SuggestSourceModal";

function ProfileContent() {
  const { user, token, isAuthenticated, isLoading: authLoading, logout, updateUser } = useAuth();
  const router = useRouter();
  const { isInstallable } = usePWAInstall();

  const [showPWAInstall, setShowPWAInstall] = useState(false);
  const [showSuggestModal, setShowSuggestModal] = useState(false);
  const [mySubmissions, setMySubmissions] = useState<any[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [showEditUsername, setShowEditUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [savingUsername, setSavingUsername] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const fetchMySubmissions = async () => {
    if (!token) return;
    try {
      setLoadingSubmissions(true);
      const res = await fetch(`${apiUrl}/api/sources/my-submissions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMySubmissions(data);
      }
    } catch (err) {
      console.error("Failed to load user submissions", err);
    } finally {
      setLoadingSubmissions(false);
    }
  };

  // Redirect if unauthenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login?redirect=/profile");
    } else if (token) {
      fetchMySubmissions();
    }
  }, [authLoading, isAuthenticated, router, token]);

  useEffect(() => {
    if (user) {
      setUsernameInput(user.username || user.email?.split("@")[0] || "");
    }
  }, [user]);

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  const handleSaveUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = usernameInput.trim();
    if (!trimmed) return;

    setSavingUsername(true);
    try {
      if (token) {
        const res = await fetch(`${apiUrl}/users/me/username`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ username: trimmed }),
        });
        if (!res.ok) throw new Error("Could not update username.");
      }

      updateUser({ username: trimmed });
      setMessage("Username updated successfully!");
      setShowEditUsername(false);
      setTimeout(() => setMessage(null), 3000);
    } catch {
      updateUser({ username: trimmed });
      setMessage("Username updated locally.");
      setShowEditUsername(false);
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setSavingUsername(false);
    }
  };

  const savedCount = user?.saved_event_ids?.length || 0;
  const initials = (user?.username || user?.email || "US").slice(0, 2).toUpperCase();

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-2 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
          Profile
        </h1>
        {user?.is_admin && (
          <Link
            href="/admin/sources"
            className="text-xs font-bold px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1"
          >
            <span>🛡️</span>
            <span>Admin</span>
          </Link>
        )}
      </div>

      {message && (
        <div className="mb-4 p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs font-bold animate-fadeIn">
          ✓ {message}
        </div>
      )}

      {/* User Card matching Screen 8 */}
      <div className="bg-[#131b2e] border border-slate-800 rounded-3xl p-5 sm:p-6 mb-6 flex items-center gap-4 shadow-lg">
        <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 text-white font-black text-xl flex items-center justify-center shadow-md shadow-indigo-600/30 flex-shrink-0">
          {initials}
        </div>

        <div className="flex-1 min-w-0">
          {showEditUsername ? (
            <form onSubmit={handleSaveUsername} className="flex items-center gap-2">
              <input
                type="text"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                className="py-1 px-2.5 bg-slate-900 border border-indigo-500 rounded-lg text-sm text-white outline-none w-36"
                autoFocus
              />
              <button
                type="submit"
                disabled={savingUsername}
                className="py-1 px-2.5 bg-indigo-600 text-white text-xs font-bold rounded-lg"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setShowEditUsername(false)}
                className="text-xs text-slate-400"
              >
                ✕
              </button>
            </form>
          ) : (
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white truncate">
                {user?.username || user?.email?.split("@")[0] || "EventScout Explorer"}
              </h2>
              <button
                onClick={() => setShowEditUsername(true)}
                className="text-slate-400 hover:text-indigo-400 text-xs"
                title="Edit username"
              >
                ✏️
              </button>
            </div>
          )}
          <p className="text-xs text-slate-400 truncate mt-0.5">{user?.email}</p>
        </div>
      </div>

      {/* Menu List matching Screen 8 */}
      <div className="bg-[#131b2e] border border-slate-800 rounded-3xl overflow-hidden mb-6 divide-y divide-slate-800/80 shadow-sm">
        {/* My Preferences */}
        <Link
          href="/preferences"
          className="flex items-center justify-between p-4 sm:p-4.5 hover:bg-slate-800/50 transition-colors active-press group"
        >
          <div className="flex items-center gap-3.5">
            <span className="w-9 h-9 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center text-base flex-shrink-0">
              🔖
            </span>
            <span className="text-sm font-bold text-white group-hover:text-indigo-300">
              My Preferences
            </span>
          </div>
          <span className="text-slate-500 group-hover:text-slate-300 text-sm">›</span>
        </Link>

        {/* Saved Events */}
        <Link
          href="/saved"
          className="flex items-center justify-between p-4 sm:p-4.5 hover:bg-slate-800/50 transition-colors active-press group"
        >
          <div className="flex items-center gap-3.5">
            <span className="w-9 h-9 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center text-base flex-shrink-0">
              📁
            </span>
            <span className="text-sm font-bold text-white group-hover:text-indigo-300">
              Saved Events
            </span>
          </div>
          <div className="flex items-center gap-2">
            {savedCount > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-800 text-indigo-400">
                {savedCount}
              </span>
            )}
            <span className="text-slate-500 group-hover:text-slate-300 text-sm">›</span>
          </div>
        </Link>

        {/* Attending */}
        <Link
          href="/saved?tab=attending"
          className="flex items-center justify-between p-4 sm:p-4.5 hover:bg-slate-800/50 transition-colors active-press group"
        >
          <div className="flex items-center gap-3.5">
            <span className="w-9 h-9 rounded-xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center text-base flex-shrink-0">
              📅
            </span>
            <span className="text-sm font-bold text-white group-hover:text-indigo-300">
              Attending
            </span>
          </div>
          <span className="text-slate-500 group-hover:text-slate-300 text-sm">›</span>
        </Link>

        {/* Notification Settings */}
        <Link
          href="/preferences"
          className="flex items-center justify-between p-4 sm:p-4.5 hover:bg-slate-800/50 transition-colors active-press group"
        >
          <div className="flex items-center gap-3.5">
            <span className="w-9 h-9 rounded-xl bg-amber-600/20 text-amber-400 flex items-center justify-center text-base flex-shrink-0">
              🔔
            </span>
            <span className="text-sm font-bold text-white group-hover:text-indigo-300">
              Notification Settings
            </span>
          </div>
          <span className="text-slate-500 group-hover:text-slate-300 text-sm">›</span>
        </Link>

        {/* Install App (PWA) */}
        <button
          onClick={() => setShowPWAInstall(true)}
          className="w-full flex items-center justify-between p-4 sm:p-4.5 hover:bg-slate-800/50 transition-colors active-press group text-left"
        >
          <div className="flex items-center gap-3.5">
            <span className="w-9 h-9 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center text-base flex-shrink-0">
              📱
            </span>
            <div>
              <span className="text-sm font-bold text-white group-hover:text-indigo-300">
                Install App (PWA)
              </span>
              <span className="block text-[10px] text-slate-400">
                Offline access & standalone home screen
              </span>
            </div>
          </div>
          <span className="text-slate-500 group-hover:text-slate-300 text-sm">›</span>
        </button>

        {/* Suggest Event Website */}
        <button
          onClick={() => setShowSuggestModal(true)}
          className="w-full flex items-center justify-between p-4 sm:p-4.5 hover:bg-slate-800/50 transition-colors active-press group text-left"
        >
          <div className="flex items-center gap-3.5">
            <span className="w-9 h-9 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center text-base flex-shrink-0">
              🌐
            </span>
            <div>
              <span className="text-sm font-bold text-white group-hover:text-indigo-300">
                Suggest Event Website
              </span>
              <span className="block text-[10px] text-slate-400">
                Submit a website for admin review & approval
              </span>
            </div>
          </div>
          <span className="text-xs font-bold text-indigo-400 group-hover:text-indigo-300">➕ Add</span>
        </button>

        {/* About EventScout / Onboarding Replay */}
        <Link
          href="/onboarding"
          className="flex items-center justify-between p-4 sm:p-4.5 hover:bg-slate-800/50 transition-colors active-press group"
        >
          <div className="flex items-center gap-3.5">
            <span className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center text-base flex-shrink-0">
              ℹ️
            </span>
            <span className="text-sm font-bold text-white group-hover:text-indigo-300">
              About EventScout
            </span>
          </div>
          <span className="text-slate-500 group-hover:text-slate-300 text-sm">›</span>
        </Link>
      </div>

      {/* User Submitted Websites Section */}
      <div className="mb-6 bg-[#131b2e] rounded-2xl border border-slate-800 p-4 sm:p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-base">📋</span>
            <h3 className="text-sm font-bold text-white">My Suggested Websites</h3>
          </div>
          <button
            onClick={() => setShowSuggestModal(true)}
            className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1"
          >
            <span>➕</span>
            <span>Suggest URL</span>
          </button>
        </div>

        <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">
          Links you submit are reviewed by an administrator. Once approved, the website will be added to EventScout&apos;s active scrapers.
        </p>

        {loadingSubmissions ? (
          <div className="py-4 text-center text-xs text-slate-400 animate-pulse">
            Loading your submissions...
          </div>
        ) : mySubmissions.length === 0 ? (
          <div className="py-5 text-center rounded-xl bg-slate-900/50 border border-slate-800/60 p-4">
            <p className="text-xs text-slate-400 mb-2">You haven&apos;t suggested any website URLs yet.</p>
            <button
              onClick={() => setShowSuggestModal(true)}
              className="px-3 py-1.5 rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 text-xs font-semibold hover:bg-indigo-600/30 transition-all"
            >
              Suggest an Event Website
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {mySubmissions.map((sub) => {
              const isApproved = sub.status === "ENABLED";
              const isPending = sub.status === "PENDING" || sub.status === "READY_FOR_REVIEW" || sub.status === "DISCOVERING" || sub.status === "TESTING";
              const isRejected = sub.status === "FAILED" || sub.status === "DISABLED";

              return (
                <div
                  key={sub.id || sub._id}
                  className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-white truncate">
                      {sub.name || "Event Website"}
                    </p>
                    <a
                      href={sub.url || sub.base_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-indigo-400 hover:underline truncate block"
                    >
                      {sub.url || sub.base_url}
                    </a>
                  </div>

                  <div>
                    {isApproved && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        ✓ Approved & Active
                      </span>
                    )}
                    {isPending && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                        ⏳ Pending Admin Review
                      </span>
                    )}
                    {isRejected && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                        ✕ Under Review / Declined
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Logout Button */}
      <button
        onClick={handleLogout}
        className="w-full py-3.5 px-4 rounded-2xl bg-[#131b2e] hover:bg-rose-950/20 border border-slate-800 hover:border-rose-900/50 text-rose-400 font-bold text-sm transition-all active-press flex items-center justify-center gap-2"
      >
        <span>🚪</span>
        <span>Log Out</span>
      </button>

      {/* PWA Install Modal */}
      <PWAInstallModal
        isOpen={showPWAInstall}
        onClose={() => setShowPWAInstall(false)}
      />

      {/* Suggest Source Modal */}
      <SuggestSourceModal
        isOpen={showSuggestModal}
        onClose={() => setShowSuggestModal(false)}
        onSubmitted={fetchMySubmissions}
      />
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-2xl mx-auto px-4 py-8 text-center text-slate-400 text-sm">
          Loading profile...
        </div>
      }
    >
      <ProfileContent />
    </Suspense>
  );
}
