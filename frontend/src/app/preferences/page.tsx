"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

const EVENT_TYPE_CHIPS = [
  { id: "Hackathon", label: "Hackathons", icon: "⚡" },
  { id: "Workshop", label: "Workshops", icon: "🛠️" },
  { id: "Conference", label: "Conferences", icon: "📅" },
  { id: "Internship", label: "Internships", icon: "💼" },
  { id: "Competition", label: "Competitions", icon: "🏆" },
  { id: "Webinar", label: "Webinars", icon: "💻" },
];

const FIELD_CHIPS = [
  "AI/ML",
  "Web Development",
  "Cloud",
  "DevOps",
  "Cybersecurity",
  "Design",
  "Blockchain",
  "Product",
];

const LOCATION_OPTIONS = [
  "All Locations",
  "Online / Virtual",
  "Hyderabad",
  "Bengaluru",
  "Delhi NCR",
  "Mumbai",
  "Pune",
  "Chennai",
];

export default function PreferencesPage() {
  const router = useRouter();
  const { user, token, isAuthenticated, updateUser } = useAuth();

  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [preferredLocation, setPreferredLocation] = useState<string>("All Locations");
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(true);

  // Custom tag input
  const [showAddTag, setShowAddTag] = useState(false);
  const [customTagInput, setCustomTagInput] = useState("");

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  // Prepopulate from user data
  useEffect(() => {
    if (user) {
      if (user.preferred_event_types) setSelectedTypes(user.preferred_event_types);
      if (user.interests) setSelectedFields(user.interests);
      if (user.notification_preferences?.dashboard_enabled !== undefined) {
        setNotificationsEnabled(user.notification_preferences.dashboard_enabled);
      }
    }
  }, [user]);

  const toggleType = (t: string) => {
    setSelectedTypes((prev) =>
      prev.includes(t) ? prev.filter((item) => item !== t) : [...prev, t]
    );
  };

  const toggleField = (f: string) => {
    setSelectedFields((prev) =>
      prev.includes(f) ? prev.filter((item) => item !== f) : [...prev, f]
    );
  };

  const handleAddCustomTag = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customTagInput.trim();
    if (trimmed && !selectedFields.includes(trimmed)) {
      setSelectedFields((prev) => [...prev, trimmed]);
      setCustomTagInput("");
      setShowAddTag(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    const payload = {
      interests: selectedFields,
      skills: user?.skills || [],
      preferred_event_types: selectedTypes,
      preferred_modes: preferredLocation.includes("Online") ? ["Online"] : ["Online", "Offline"],
      notification_preferences: {
        dashboard_enabled: notificationsEnabled,
        browser_enabled: notificationsEnabled,
        email_enabled: notificationsEnabled,
      },
    };

    try {
      if (token) {
        const res = await fetch(`${apiUrl}/me/preferences`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) throw new Error("Failed to save preferences.");
      }

      updateUser(payload);
      setMessage("Preferences saved successfully!");
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("eventscout-toast", { detail: { message: "Preferences Saved" } })
        );
      }
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      // In offline/demo mode, update local auth state
      updateUser(payload);
      setMessage("Preferences saved locally.");
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-2 pb-12">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-xl bg-slate-800/80 text-slate-300 hover:text-white transition-colors active-press"
        >
          ←
        </button>
        <h1 className="text-2xl font-black text-white tracking-tight">
          Preferences
        </h1>
      </div>

      {/* Success / Info Message */}
      {message && (
        <div className="mb-5 p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-fadeIn">
          <span>✓</span>
          <span>{message}</span>
        </div>
      )}

      {/* SECTION 1: What are you interested in? */}
      <div className="mb-7">
        <h2 className="text-sm font-bold text-white mb-3">
          What are you interested in?
        </h2>
        <div className="grid grid-cols-2 gap-2.5">
          {EVENT_TYPE_CHIPS.map((type) => {
            const isSelected = selectedTypes.includes(type.id);
            return (
              <button
                key={type.id}
                onClick={() => toggleType(type.id)}
                className={`py-3 px-3.5 rounded-2xl border text-left flex items-center gap-2.5 transition-all active-press ${
                  isSelected
                    ? "bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20"
                    : "bg-[#131b2e] border-slate-800 text-slate-300 hover:border-slate-700"
                }`}
              >
                <span className="text-base">{type.icon}</span>
                <span className="text-xs font-bold truncate">{type.label}</span>
                {isSelected && (
                  <span className="ml-auto text-white text-xs font-black">✓</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* SECTION 2: Your fields of interest */}
      <div className="mb-7">
        <h2 className="text-sm font-bold text-white mb-3">
          Your fields of interest
        </h2>
        <div className="flex flex-wrap gap-2">
          {FIELD_CHIPS.map((field) => {
            const isSelected = selectedFields.includes(field);
            return (
              <button
                key={field}
                onClick={() => toggleField(field)}
                className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all active-press border ${
                  isSelected
                    ? "bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20"
                    : "bg-[#131b2e] border-slate-800 text-slate-300 hover:text-white"
                }`}
              >
                {field}
              </button>
            );
          })}

          {/* Any custom tags added by user */}
          {selectedFields
            .filter((f) => !FIELD_CHIPS.includes(f))
            .map((custom) => (
              <button
                key={custom}
                onClick={() => toggleField(custom)}
                className="py-2 px-3.5 rounded-xl text-xs font-bold bg-purple-600 text-white border border-purple-500 shadow-md flex items-center gap-1.5"
              >
                <span>{custom}</span>
                <span className="text-[10px]">✕</span>
              </button>
            ))}

          {/* Add more button / inline input */}
          {showAddTag ? (
            <form onSubmit={handleAddCustomTag} className="flex items-center gap-1.5">
              <input
                type="text"
                value={customTagInput}
                onChange={(e) => setCustomTagInput(e.target.value)}
                placeholder="e.g. Flutter, Rust"
                autoFocus
                className="py-1.5 px-3 rounded-xl bg-slate-900 border border-indigo-500 text-white text-xs outline-none w-32"
              />
              <button
                type="submit"
                className="py-1.5 px-2.5 bg-indigo-600 text-white text-xs font-bold rounded-xl"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => setShowAddTag(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </form>
          ) : (
            <button
              onClick={() => setShowAddTag(true)}
              className="py-2 px-3.5 rounded-xl text-xs font-bold bg-slate-800/80 border border-slate-700 text-slate-300 hover:text-white flex items-center gap-1"
            >
              <span>+</span>
              <span>Add more</span>
            </button>
          )}
        </div>
      </div>

      {/* SECTION 3: Preferred Location */}
      <div className="mb-7">
        <h2 className="text-sm font-bold text-white mb-2">
          Preferred Location
        </h2>
        <div className="relative">
          <select
            value={preferredLocation}
            onChange={(e) => setPreferredLocation(e.target.value)}
            className="w-full py-3.5 px-4 bg-[#131b2e] border border-slate-800 rounded-2xl text-xs font-bold text-white outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
          >
            {LOCATION_OPTIONS.map((loc) => (
              <option key={loc} value={loc} className="bg-slate-900 text-white">
                {loc}
              </option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-400 text-xs">
            ▼
          </div>
        </div>
      </div>

      {/* SECTION 4: Notifications Toggle */}
      <div className="mb-9 p-4 bg-[#131b2e] border border-slate-800 rounded-2xl flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center text-lg flex-shrink-0">
            🔔
          </div>
          <div>
            <div className="text-xs font-bold text-white">Notifications</div>
            <div className="text-[11px] text-slate-400">
              Get notified about new events and upcoming deadlines
            </div>
          </div>
        </div>

        {/* Toggle Switch */}
        <button
          type="button"
          role="switch"
          aria-checked={notificationsEnabled}
          onClick={() => setNotificationsEnabled(!notificationsEnabled)}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
            notificationsEnabled ? "bg-indigo-600" : "bg-slate-700"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
              notificationsEnabled ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {/* Primary CTA Button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-black text-sm shadow-xl shadow-indigo-600/30 transition-all active-press flex items-center justify-center gap-2"
      >
        <span>{saving ? "Saving Preferences..." : "Save Preferences"}</span>
      </button>
    </div>
  );
}
