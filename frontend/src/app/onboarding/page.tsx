"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function OnboardingPage() {
  const router = useRouter();
  const [slide, setSlide] = useState(0);

  const slides = [
    {
      title: "All opportunities. One place.",
      subtitle: "Your gateway to hackathons, workshops, conferences, and tech opportunities.",
      badges: ["Hackathons", "Workshops", "Conferences", "Internships"],
    },
    {
      title: "Intelligent Recommendations.",
      subtitle: "Personalized matches tailored directly to your skills, domain, and career goals.",
      badges: ["AI / ML", "Web Dev", "Cloud", "Cybersecurity"],
    },
    {
      title: "Never Miss a Deadline.",
      subtitle: "Save events, track registration dates, and get notified before opportunities close.",
      badges: ["Smart Alerts", "Offline Access", "Top Picks", "Free Events"],
    },
  ];

  const handleFinish = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("eventscout_onboarded", "true");
    }
    router.push("/");
  };

  const handleNext = () => {
    if (slide < slides.length - 1) {
      setSlide(slide + 1);
    } else {
      handleFinish();
    }
  };

  const current = slides[slide];

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0b0f19] via-[#0f172a] to-[#1e1b4b] text-white flex flex-col justify-between px-6 py-8 relative overflow-hidden">
      {/* Background glowing orbs */}
      <div className="absolute -top-24 -left-24 w-72 h-72 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-24 w-72 h-72 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 left-1/4 w-72 h-72 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header: Logo & Skip */}
      <div className="flex items-center justify-between z-10 pt-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-indigo-500/30">
            E
          </div>
          <span className="font-extrabold text-xl tracking-tight text-white">
            EventScout
          </span>
        </div>

        <button
          onClick={handleFinish}
          className="text-sm font-semibold text-slate-400 hover:text-white px-3 py-1.5 rounded-lg transition-colors"
        >
          Skip
        </button>
      </div>

      {/* Center Illustration & Floating Categories */}
      <div className="flex flex-col items-center justify-center my-auto py-8 z-10">
        {/* Visual floating nodes circle */}
        <div className="relative w-72 h-72 sm:w-80 sm:h-80 flex items-center justify-center mb-8">
          {/* Subtle orbital dashed ring */}
          <div className="absolute inset-0 rounded-full border border-indigo-500/20 border-dashed animate-[spin_40s_linear_infinite]" />
          <div className="absolute inset-8 rounded-full border border-purple-500/20 pointer-events-none" />

          {/* Central Student Avatar with backpack */}
          <div className="w-36 h-36 sm:w-40 sm:h-40 rounded-full bg-gradient-to-tr from-indigo-900 via-indigo-600 to-purple-600 p-1 shadow-2xl shadow-indigo-600/40 relative z-10 flex items-center justify-center">
            <div className="w-full h-full rounded-full bg-[#0b0f19] flex flex-col items-center justify-center relative overflow-hidden">
              {/* Stylized vector student with backpack and phone */}
              <div className="w-14 h-14 rounded-full bg-amber-200/90 mb-1 flex items-center justify-center relative shadow-inner">
                {/* Hair */}
                <div className="absolute -top-1 w-15 h-8 bg-slate-900 rounded-t-full" />
                <span className="text-xl">✨</span>
              </div>
              <div className="w-20 h-16 bg-indigo-500 rounded-t-2xl flex items-center justify-center relative">
                {/* Backpack straps */}
                <div className="absolute -left-1 top-2 w-3 h-12 bg-indigo-900 rounded-full" />
                <div className="absolute -right-1 top-2 w-3 h-12 bg-indigo-900 rounded-full" />
                {/* Phone in hands */}
                <div className="w-6 h-9 bg-slate-900 border border-indigo-300/40 rounded-sm flex items-center justify-center">
                  <div className="w-3 h-4 bg-indigo-400/80 rounded-xs" />
                </div>
              </div>
            </div>
          </div>

          {/* Floating Category Pills */}
          <div className="absolute top-2 left-6 bg-slate-900/90 border border-indigo-500/40 text-indigo-300 text-xs font-bold px-3 py-1.5 rounded-full shadow-lg backdrop-blur-md flex items-center gap-1.5 animate-bounce [animation-duration:3s]">
            <span>⚡</span>
            <span>{current.badges[0]}</span>
          </div>

          <div className="absolute top-4 right-4 bg-slate-900/90 border border-purple-500/40 text-purple-300 text-xs font-bold px-3 py-1.5 rounded-full shadow-lg backdrop-blur-md flex items-center gap-1.5 animate-bounce [animation-duration:3.5s]">
            <span>🛠️</span>
            <span>{current.badges[1]}</span>
          </div>

          <div className="absolute bottom-6 left-2 bg-slate-900/90 border border-blue-500/40 text-blue-300 text-xs font-bold px-3 py-1.5 rounded-full shadow-lg backdrop-blur-md flex items-center gap-1.5 animate-bounce [animation-duration:4s]">
            <span>🌐</span>
            <span>{current.badges[2]}</span>
          </div>

          <div className="absolute bottom-8 right-2 bg-slate-900/90 border border-emerald-500/40 text-emerald-300 text-xs font-bold px-3 py-1.5 rounded-full shadow-lg backdrop-blur-md flex items-center gap-1.5 animate-bounce [animation-duration:3.2s]">
            <span>🎯</span>
            <span>{current.badges[3]}</span>
          </div>
        </div>

        {/* Text Area */}
        <div className="text-center max-w-sm px-4">
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-3">
            {current.title}
          </h1>
          <p className="text-slate-300 text-sm leading-relaxed">
            {current.subtitle}
          </p>
        </div>
      </div>

      {/* Bottom CTA & Progress Dots */}
      <div className="flex flex-col items-center gap-6 z-10 pb-4">
        {/* Dots */}
        <div className="flex items-center gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setSlide(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={`h-2 rounded-full transition-all duration-300 ${
                slide === i
                  ? "w-8 bg-indigo-500"
                  : "w-2 bg-slate-700 hover:bg-slate-600"
              }`}
            />
          ))}
        </div>

        {/* Action Button */}
        <button
          onClick={handleNext}
          className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 text-white font-black text-base shadow-xl shadow-indigo-600/30 hover:shadow-indigo-600/50 transition-all active-press flex items-center justify-center gap-2"
        >
          <span>{slide === slides.length - 1 ? "Get Started" : "Continue"}</span>
          <span className="text-lg">→</span>
        </button>
      </div>
    </div>
  );
}
