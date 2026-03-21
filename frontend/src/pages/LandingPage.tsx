import { Link } from "react-router-dom";
import { ArrowRight, FileText, Mic, Hand, Bot, ScanLine, Shield, Download, Box, Sparkles, AudioWaveform, Atom, Zap, Hexagon } from "lucide-react";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[#030712] text-white overflow-y-auto">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#030712]/90 backdrop-blur-sm">
        <div className="flex items-center justify-between px-16 py-5">
          <div className="flex items-center gap-0.5">
            <span className="font-mono font-bold text-[22px] tracking-wider text-cadence-light">CAD</span>
            <span className="font-mono text-[22px] tracking-wider text-white">ence</span>
          </div>
          <nav className="flex items-center gap-9">
            <a href="#features" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">How It Works</a>
            <a href="#tech-stack" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">Tech Stack</a>
            <Link
              to="/app"
              className="font-mono text-[13px] font-semibold text-[#030712] px-6 py-2.5 rounded-md transition-colors"
              style={{ backgroundColor: "#22d3ee" }}
            >
              Try CADence
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="px-[120px] pt-20 pb-15 flex flex-col items-center gap-10" style={{
        background: "radial-gradient(ellipse 120% 120% at 50% 30%, #0F172A 0%, #030712 100%)"
      }}>
        {/* Badge */}
        <div className="flex items-center gap-2 bg-[#1E293B] border border-[#22D3EE33] rounded-full px-4 py-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-cadence-light" />
          <span className="font-mono text-[11px] font-medium tracking-[1.5px] text-slate-400">MACHacks 2026 Project</span>
        </div>

        {/* Headline */}
        <div className="flex flex-col items-center gap-5 w-full">
          <h1 className="text-[56px] font-bold text-center leading-tight">Design 3D Parts with</h1>
          <h1 className="text-[56px] font-bold text-center leading-tight text-cadence-light">Your Hands and Voice</h1>
          <p className="text-lg text-slate-400 text-center max-w-[700px] leading-relaxed">
            An AI-powered CAD editor that understands hand gestures, voice commands, and engineering spec sheets. No mouse required.
          </p>
        </div>

        {/* CTA */}
        <Link
          to="/app"
          className="flex items-center gap-2.5 font-mono text-base font-bold text-[#030712] px-10 py-4 rounded-lg transition-colors shadow-[0_4px_30px_rgba(34,211,238,0.25)]"
          style={{ backgroundColor: "#22d3ee" }}
        >
          Try CADence
          <ArrowRight className="h-[18px] w-[18px]" />
        </Link>

        {/* Viewport Mockup */}
        <div className="w-[1000px] max-w-full rounded-xl border border-[#1E293B] bg-[#0F172A] overflow-hidden">
          {/* Mockup top bar */}
          <div className="flex items-center justify-between h-10 px-4 bg-[#111827] border-b border-[#1E293B]">
            <span className="font-mono text-xs font-medium text-slate-500">CADence Viewport</span>
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/60" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
              <div className="w-3 h-3 rounded-full bg-green-500/60" />
            </div>
          </div>
          {/* Mockup content */}
          <div className="flex h-[520px]">
            <div className="flex-1 flex items-center justify-center" style={{
              background: "radial-gradient(ellipse 140% 140% at 40% 50%, #1a2744 0%, #0A0F1C 100%)"
            }}>
              <div className="text-slate-600 font-mono text-sm">3D Viewport Preview</div>
            </div>
            <div className="w-[300px] bg-[#111827] border-l border-[#1E293B] p-4 flex flex-col gap-3">
              <div className="text-xs font-medium text-slate-500">Chat Log</div>
              <div className="flex-1 flex flex-col gap-2">
                <div className="bg-[#1E293B] rounded-lg px-3 py-2 text-xs text-slate-400">Create a mounting bracket with 4 bolt holes</div>
                <div className="bg-cadence/10 border border-cadence/20 rounded-lg px-3 py-2 text-xs text-cadence-light">Building bracket geometry...</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="bg-[#0A0F1C] px-[120px] py-20 flex flex-col items-center gap-12">
        <div className="flex flex-col items-center gap-4">
          <span className="font-mono text-[11px] font-semibold tracking-[2px] text-cadence-light">HOW IT WORKS</span>
          <h2 className="text-4xl font-bold text-center">Three Steps to Your Next Part</h2>
        </div>

        <div className="flex gap-8 justify-center w-full">
          {[
            {
              num: "01",
              icon: <FileText className="h-9 w-9 text-cadence-light" />,
              title: "Upload a Spec Sheet",
              desc: "Drop your engineering PDF. Our AI reads dimensions, tolerances, and material specs automatically.",
            },
            {
              num: "02",
              icon: <Mic className="h-9 w-9 text-cadence-light" />,
              title: "Speak Your Design",
              desc: 'Describe what you want in plain English. "Add four M6 bolt holes" \u2014 and watch it appear in real time.',
            },
            {
              num: "03",
              icon: <Hand className="h-9 w-9 text-cadence-light" />,
              title: "Navigate with Gestures",
              desc: "Pinch to zoom, swipe to rotate, point to select. Your webcam tracks your hands \u2014 no special hardware needed.",
            },
          ].map((step) => (
            <div
              key={step.num}
              className="flex flex-col items-center gap-5 bg-[#111827] border border-[#1E293B] rounded-xl p-8 w-[360px]"
            >
              <span className="font-mono text-[32px] font-bold text-cadence-light/15">{step.num}</span>
              {step.icon}
              <h3 className="text-lg font-semibold text-center">{step.title}</h3>
              <p className="text-sm text-slate-400 text-center leading-relaxed max-w-[280px]">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-[#030712] px-[120px] py-20 flex flex-col items-center gap-12">
        <div className="flex flex-col items-center gap-4">
          <span className="font-mono text-[11px] font-semibold tracking-[2px] text-cadence-light">FEATURES</span>
          <h2 className="text-4xl font-bold text-center">Built for Engineers Who Think in 3D</h2>
        </div>

        <div className="grid grid-cols-2 gap-6 w-full max-w-[1200px]">
          {[
            {
              icon: <Bot className="h-5 w-5 text-cadence-light" />,
              title: "AI Design Agent",
              desc: "Claude interprets your voice commands and spec sheets to generate precise 3D geometry with engineering constraints.",
            },
            {
              icon: <ScanLine className="h-5 w-5 text-cadence-light" />,
              title: "Gesture Navigation",
              desc: "MediaPipe hand tracking turns your webcam into a 3D controller. Rotate, zoom, and select without touching your mouse.",
            },
            {
              icon: <Shield className="h-5 w-5 text-cadence-light" />,
              title: "Constraint-Aware",
              desc: "Every generated part respects real-world engineering constraints \u2014 tolerances, material limits, and manufacturing feasibility.",
            },
            {
              icon: <Download className="h-5 w-5 text-cadence-light" />,
              title: "Export to STL",
              desc: "One click to export your design as production-ready STL. Print it, machine it, or share it with your team.",
            },
          ].map((card) => (
            <div
              key={card.title}
              className="flex flex-col gap-4 bg-[#111827] border border-[#1E293B] rounded-xl p-7"
            >
              <div className="w-11 h-11 rounded-lg bg-cadence-light/10 flex items-center justify-center">
                {card.icon}
              </div>
              <h3 className="text-base font-semibold">{card.title}</h3>
              <p className="text-[13px] text-slate-400 leading-relaxed">{card.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Tech Stack */}
      <section id="tech-stack" className="bg-[#0A0F1C] border-y border-[#1E293B22] px-[120px] py-15 flex flex-col items-center gap-8">
        <span className="font-mono text-[11px] font-semibold tracking-[2px] text-slate-600">POWERED BY</span>
        <div className="flex items-center justify-center gap-12 flex-wrap">
          {[
            { icon: <Box className="h-[18px] w-[18px]" />, name: "Three.js" },
            { icon: <ScanLine className="h-[18px] w-[18px]" />, name: "MediaPipe" },
            { icon: <Sparkles className="h-[18px] w-[18px]" />, name: "Claude" },
            { icon: <AudioWaveform className="h-[18px] w-[18px]" />, name: "Whisper" },
            { icon: <Atom className="h-[18px] w-[18px]" />, name: "React" },
            { icon: <Zap className="h-[18px] w-[18px]" />, name: "FastAPI" },
            { icon: <Hexagon className="h-[18px] w-[18px]" />, name: "JSCAD" },
          ].map((tech) => (
            <div key={tech.name} className="flex items-center gap-2 text-slate-500">
              {tech.icon}
              <span className="font-mono text-sm font-medium">{tech.name}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#030712] border-t border-[#1E293B33] px-[120px] py-10 flex flex-col items-center gap-4">
        <div className="flex items-center gap-0.5">
          <span className="font-mono font-bold text-base text-cadence-light">CAD</span>
          <span className="font-mono text-base text-white">ence</span>
        </div>
        <div className="w-[200px] h-px bg-[#1E293B]" />
        <span className="font-mono text-[13px] font-medium text-slate-500">Built for MACHacks 2026</span>
        <span className="text-xs text-slate-600">Designed & engineered with caffeine and conviction</span>
        <span className="text-[11px] text-slate-700">&copy; 2026 CADence. All rights reserved.</span>
      </footer>
    </div>
  );
}
