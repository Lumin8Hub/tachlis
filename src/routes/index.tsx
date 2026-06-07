import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { submitInitiative } from "@/lib/sheets.functions";
import { uploadSubmissionFiles } from "@/lib/drive.functions";
import Chart from "chart.js/auto";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Faith, Not Fear - Speaker Initiative Hub" },
      { name: "description", content: "Submit your actionable takeaway for the Tachlis Conference II Takeaway Action Guide." },
      { property: "og:title", content: "Faith, Not Fear - Speaker Initiative Hub" },
      { property: "og:description", content: "Submit your actionable takeaway for the Tachlis Conference II Takeaway Action Guide." },
    ],
  }),
  component: Index,
});

interface Submission {
  name: string;
  title: string;
  type: string;
  desc: string;
}

const baselineSubmissions: Submission[] = [
  { name: "Mayor Steven Del Duca", title: "Community Bridge Project", type: "Declaration", desc: "A 30-day initiative to promote intercultural community safety dialogues across civic spaces." },
  { name: "Rabbi Mendel Kaplan", title: "Chabad Flamingo Youth Initiative", type: "Volunteering", desc: "Engaging local leaders and youth in community outreach and mutual volunteer care programs." },
  { name: "Melissa Lantsman, MP", title: "National Coalition for Security", type: "Advocacy", desc: "A grassroots campaign coordinating local concerns directly with federal leadership." },
  { name: "Ben Mulroney", title: "Creative Media Trust", type: "Other", desc: "Establishing positive community media narratives to counter fear and isolation." },
  { name: "Shuvaloy Majumdar, MP", title: "Calgary Leadership Exchange", type: "Declaration", desc: "Developing regional leadership mentorship guidelines to foster inter-generational faith." },
];

const actionTypes = ["Declaration", "Volunteering", "Petition", "Advocacy", "Donation", "Other"] as const;

type ActionType = (typeof actionTypes)[number];

const typeColors: Record<ActionType, string> = {
  Declaration: "#fce0a2",
  Volunteering: "#c99e49",
  Petition: "#14c3a2",
  Advocacy: "#3b82f6",
  Donation: "#9e7528",
  Other: "#64748b",
};

function Index() {
  const [currentStep, setCurrentStep] = useState(1);
  const [submissions, setSubmissions] = useState<Submission[]>(baselineSubmissions);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");

  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstanceRef = useRef<Chart | null>(null);

  const submitFn = useServerFn(submitInitiative);
  const uploadFn = useServerFn(uploadSubmissionFiles);

  // Form fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [org, setOrg] = useState("");
  const [title, setTitle] = useState("");
  const [type, setType] = useState<ActionType>("Declaration");
  const [desc, setDesc] = useState("");
  const [link, setLink] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [uploadStatus, setUploadStatus] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const MAX_FILES = 10;
  const MAX_BYTES = 25 * 1024 * 1024;

  const addFiles = useCallback((picked: FileList | File[]) => {
    const incoming = Array.from(picked);
    const tooBig = incoming.find((f) => f.size > MAX_BYTES);
    if (tooBig) {
      setAlertMessage(`"${tooBig.name}" exceeds the 25 MB limit.`);
      setAlertOpen(true);
      return;
    }
    setFiles((prev) => {
      const merged = [...prev];
      for (const f of incoming) {
        if (merged.length >= MAX_FILES) break;
        if (!merged.some((m) => m.name === f.name && m.size === f.size)) merged.push(f);
      }
      if (prev.length + incoming.length > MAX_FILES) {
        setAlertMessage(`You can attach up to ${MAX_FILES} files. Extras were ignored.`);
        setAlertOpen(true);
      }
      return merged;
    });
  }, []);

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const scrollToSection = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const showAlert = useCallback((message: string) => {
    setAlertMessage(message);
    setAlertOpen(true);
  }, []);

  const getCounts = useCallback(() => {
    const counts: Record<ActionType, number> = {
      Declaration: 0,
      Volunteering: 0,
      Petition: 0,
      Advocacy: 0,
      Donation: 0,
      Other: 0,
    };
    submissions.forEach((s) => {
      if (counts[s.type as ActionType] !== undefined) {
        counts[s.type as ActionType]++;
      } else {
        counts.Other++;
      }
    });
    return counts;
  }, [submissions]);

  const initChart = useCallback(() => {
    if (!chartRef.current) return;
    const ctx = chartRef.current.getContext("2d");
    if (!ctx) return;

    const counts = getCounts();

    chartInstanceRef.current = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: Object.keys(counts),
        datasets: [
          {
            data: Object.values(counts),
            backgroundColor: Object.keys(counts).map((k) => typeColors[k as ActionType]),
            borderWidth: 1,
            borderColor: "#0a253c",
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        cutout: "72%",
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              boxWidth: 10,
              padding: 15,
              color: "#d1d5db",
              font: {
                family: "Inter",
                size: 11,
              },
            },
          },
        },
      },
    });
  }, [getCounts]);

  const refreshChart = useCallback(() => {
    if (!chartInstanceRef.current) return;
    const counts = getCounts();
    chartInstanceRef.current.data.datasets[0].data = Object.values(counts);
    chartInstanceRef.current.update();
  }, [getCounts]);

  useEffect(() => {
    initChart();
    return () => {
      chartInstanceRef.current?.destroy();
    };
  }, [initChart]);

  useEffect(() => {
    refreshChart();
  }, [submissions, refreshChart]);

  const validateAndGo = (nextStep: number) => {
    if (nextStep === 2 && currentStep === 1) {
      if (!name.trim() || !email.trim()) {
        showAlert("Please input your Name and Email Address before proceeding.");
        return;
      }
    }
    if (nextStep === 3 && currentStep === 2) {
      if (!title.trim() || !desc.trim()) {
        showAlert("Please fill out the Initiative Title and Action Description.");
        return;
      }
    }
    setCurrentStep(nextStep);
  };

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim() || !title.trim() || !desc.trim()) {
      showAlert("Please ensure all steps are fully completed before submitting.");
      return;
    }

    setSubmitting(true);
    setUploadStatus("");
    try {
      let folderLink = "";
      if (files.length > 0) {
        setUploadStatus(`Uploading ${files.length} file${files.length === 1 ? "" : "s"} to Drive...`);
        const fd = new FormData();
        fd.append("submitter", name.trim());
        fd.append("title", title.trim());
        for (const f of files) fd.append("files", f, f.name);
        const result = await uploadFn({ data: fd });
        folderLink = result.folderLink;
      }

      setUploadStatus("Recording submission...");
      await submitFn({
        data: {
          name: name.trim(),
          email: email.trim(),
          org: org.trim(),
          title: title.trim(),
          type,
          desc: desc.trim(),
          link: link.trim(),
          files: folderLink,
        },
      });

      setSubmissions((prev) => [...prev, { name: name.trim(), title: title.trim(), type, desc: desc.trim() }]);
      setSubmitted(true);
      setTimeout(() => scrollToSection("dashboard"), 800);
    } catch (err) {
      console.error(err);
      showAlert("Something went wrong submitting your initiative. Please try again.");
    } finally {
      setSubmitting(false);
      setUploadStatus("");
    }
  };

  const finalCount = submissions.length + 9;
  const percentage = Math.min((finalCount / 20) * 100, 100);

  const latest = submissions[submissions.length - 1];

  return (
    <div
      className="min-h-screen relative overflow-x-hidden"
      style={{
        fontFamily: "'Inter', sans-serif",
        background: "linear-gradient(135deg, #051321 0%, #0a253c 50%, #0d3859 100%)",
        backgroundAttachment: "fixed",
        color: "#f3f4f6",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,700&family=Inter:wght@300;400;500;600;700&display=swap');

        .gold-gradient-text {
          background: linear-gradient(to bottom, #ffe8b5 0%, #dfb560 40%, #a27a2c 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          text-shadow: 0px 2px 10px rgba(162, 122, 44, 0.3);
        }

        .gold-gradient-bg {
          background: linear-gradient(135deg, #fce0a2 0%, #c99e49 50%, #9e7528 100%);
        }

        .gold-gradient-bg-hover:hover {
          background: linear-gradient(135deg, #fff0cf 0%, #dbae57 50%, #b28634 100%);
        }

        .glass-card {
          background: rgba(13, 38, 61, 0.45);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(223, 181, 96, 0.15);
          box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
        }

        .glass-card-hover {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .glass-card-hover:hover {
          transform: translateY(-4px);
          border-color: rgba(223, 181, 96, 0.35);
          box-shadow: 0 12px 40px 0 rgba(223, 181, 96, 0.1);
        }

        .form-input {
          width: 100%;
          background: rgba(5, 19, 33, 0.6);
          border: 1px solid rgba(223, 181, 96, 0.25);
          border-radius: 8px;
          padding: 0.75rem 1rem;
          color: #ffffff;
          outline: none;
          transition: all 0.3s ease;
        }
        .form-input:focus {
          border-color: #f2d08a;
          box-shadow: 0 0 10px rgba(252, 224, 162, 0.2);
          background: rgba(5, 19, 33, 0.8);
        }
        .form-input::placeholder {
          color: rgba(255, 255, 255, 0.35);
        }
      `}</style>

      {/* Background glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[650px] opacity-10 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at top, rgb(56,189,248) 0%, transparent 70%)",
        }}
      />

      {/* Navigation */}
      <nav
        className="sticky top-0 z-50 border-b border-yellow-600/20 backdrop-blur-md"
        style={{ background: "rgba(5, 19, 33, 0.8)" }}
      >
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span
              className="text-lg font-bold uppercase tracking-[0.2em] text-white"
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              Faith<span className="text-[#dfb560]">Not</span>Fear
            </span>
          </div>
          <div className="hidden md:flex space-x-8 text-[11px] font-bold uppercase tracking-widest text-gray-300">
            <button onClick={() => scrollToSection("home")} className="hover:text-white transition-colors">
              Portal Home
            </button>
            <button onClick={() => scrollToSection("submit")} className="hover:text-[#dfb560] transition-colors">
              Submit Action
            </button>
            <button onClick={() => scrollToSection("dashboard")} className="hover:text-white transition-colors">
              Live Impact
            </button>
          </div>
          <button
            onClick={() => scrollToSection("submit")}
            className="gold-gradient-bg text-slate-950 px-5 py-2 rounded-md text-xs font-black uppercase tracking-widest gold-gradient-bg-hover transition-all shadow-lg"
            style={{ boxShadow: "0 4px 14px rgba(100, 75, 20, 0.2)" }}
          >
            Submit Initiative
          </button>
        </div>
      </nav>

      {/* Hero */}
      <header id="home" className="pt-12 pb-20 px-6 max-w-6xl mx-auto text-center relative">
        <div className="flex flex-wrap justify-center items-center gap-6 md:gap-12 opacity-90 mb-10 max-w-xl mx-auto py-2 border-b border-white/10">
          <span className="text-xs tracking-[0.25em] font-light text-slate-300" style={{ fontFamily: "'Montserrat', sans-serif" }}>YALLA!</span>
          <span className="text-xs tracking-[0.25em] font-light text-slate-300" style={{ fontFamily: "'Montserrat', sans-serif" }}>ChaiTech</span>
          <span className="text-xs tracking-[0.25em] font-light text-slate-300" style={{ fontFamily: "'Montserrat', sans-serif" }}>B&apos;NAI BRITH CANADA</span>
        </div>

        <p
          className="text-xs md:text-sm font-semibold tracking-[0.3em] text-white/70 mb-4 uppercase"
          style={{ fontFamily: "'Montserrat', sans-serif" }}
        >
          PRESENT: TACHLIS CONFERENCE II
        </p>

        <div className="mb-6 select-none">
          <h1
            className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-black tracking-[0.18em] leading-none text-white pl-4"
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            FAITH
          </h1>
          <h1
            className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-[0.12em] leading-none mt-2 gold-gradient-text pl-2 uppercase"
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            NOT FEAR
          </h1>
        </div>

        <div className="gold-gradient-bg text-slate-950 max-w-2xl mx-auto py-3 px-6 rounded-md shadow-xl mb-12">
          <p
            className="text-xs sm:text-sm font-black uppercase tracking-[0.18em] text-center"
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            BUILDING JEWISH LEADERSHIP FOR A NEW ERA IN CANADA
          </p>
        </div>

        <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-3xl mx-auto">
          Our attendees are primed to carry your message beyond the hall. Use this portal to supply your primary actionable takeaway—from a petition or pledge, to volunteer programs and critical donations—for the official{" "}
          <span className="font-semibold text-[#f2d08a]">Takeaway Action Guide</span>.
        </p>
      </header>

      {/* Submission Portal */}
      <section id="submit" className="max-w-4xl mx-auto mb-32 px-6">
        <div className="glass-card rounded-2xl p-6 md:p-12 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[3px] gold-gradient-bg" />

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10">
            <div>
              <h3
                className="text-xl sm:text-2xl font-bold uppercase tracking-wider text-white"
                style={{ fontFamily: "'Montserrat', sans-serif" }}
              >
                Initiative Submission
              </h3>
              <p className="text-xs text-[#dfb560] uppercase tracking-widest mt-1">
                For Tachlis Conference Attendees
              </p>
            </div>
            <div className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] bg-slate-950/50 px-4 py-2 rounded-full border border-white/5">
              Step {currentStep} of 3
            </div>
          </div>

          {!submitted ? (
            <form onSubmit={(e) => e.preventDefault()}>
              {/* Step 1 */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest mb-2 text-[#f2d08a]">
                        Full Name
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. Sarah Jenkins"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest mb-2 text-[#f2d08a]">
                        Email Address
                      </label>
                      <input
                        type="email"
                        className="form-input"
                        placeholder="e.g. sarah@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest mb-2 text-[#f2d08a]">
                      Organization / Affiliation (Optional)
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Canadian Leadership Forum"
                      value={org}
                      onChange={(e) => setOrg(e.target.value)}
                    />
                  </div>
                  <div className="pt-6">
                    <button
                      type="button"
                      onClick={() => validateAndGo(2)}
                      className="w-full gold-gradient-bg text-slate-950 py-4 rounded-lg font-black hover:opacity-90 transition-all uppercase tracking-widest text-xs shadow-lg"
                      style={{ boxShadow: "0 4px 14px rgba(100, 75, 20, 0.2)" }}
                    >
                      Next: Action Details
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2 */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest mb-2 text-[#f2d08a]">
                      Initiative Title
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. The Canadian Jewish Heritage Pledge"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest mb-2 text-[#f2d08a]">
                      Action Type
                    </label>
                    <select
                      className="form-input appearance-none cursor-pointer"
                      style={{ backgroundImage: "none" }}
                      value={type}
                      onChange={(e) => setType(e.target.value as ActionType)}
                    >
                      <option value="Declaration" style={{ background: "#051321" }}>
                        Declaration / Pledge
                      </option>
                      <option value="Volunteering" style={{ background: "#051321" }}>
                        Volunteering (In-person/Virtual)
                      </option>
                      <option value="Petition" style={{ background: "#051321" }}>
                        Petition (Signing/Sharing)
                      </option>
                      <option value="Advocacy" style={{ background: "#051321" }}>
                        Advocacy / Letter Writing
                      </option>
                      <option value="Donation" style={{ background: "#051321" }}>
                        Donation / Resource Drive
                      </option>
                      <option value="Other" style={{ background: "#051321" }}>
                        Other Initiative
                      </option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest mb-2 text-[#f2d08a]">
                      Description (Max 4 Sentences)
                    </label>
                    <textarea
                      rows={4}
                      className="form-input resize-none"
                      placeholder="State exactly what action you want attendees to take, why it matters today, and the collective outcome..."
                      value={desc}
                      onChange={(e) => setDesc(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-4 pt-6">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      className="w-1/3 bg-slate-900/50 hover:bg-slate-900 border border-white/20 py-4 rounded-lg font-bold text-slate-300 hover:text-white transition-all uppercase tracking-widest text-xs"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={() => validateAndGo(3)}
                      className="w-2/3 gold-gradient-bg text-slate-950 py-4 rounded-lg font-black hover:opacity-90 transition-all uppercase tracking-widest text-xs shadow-lg"
                      style={{ boxShadow: "0 4px 14px rgba(100, 75, 20, 0.2)" }}
                    >
                      Next: Resources &amp; Links
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3 */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest mb-2 text-[#f2d08a]">
                      Primary Web Link / URL
                    </label>
                    <input
                      type="url"
                      className="form-input"
                      placeholder="https://luma.com/faithnotfear"
                      value={link}
                      onChange={(e) => setLink(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest mb-2 text-[#f2d08a]">
                      Materials &amp; Upload Description
                    </label>
                    <textarea
                      rows={3}
                      className="form-input resize-none"
                      placeholder="Describe any brochures, letter templates, or resource guide PDFs you will be sending via email for inclusion..."
                      value={files}
                      onChange={(e) => setFiles(e.target.value)}
                    />
                  </div>
                  <div className="p-6 bg-[#051321]/80 rounded-xl border border-dashed border-[#dfb560]/40">
                    <h4 className="text-xs font-bold text-[#dfb560] uppercase tracking-widest mb-3">
                      Live Preview
                    </h4>
                    <div className="text-sm italic text-slate-400">
                      {title ? (
                        <>
                          <div className="text-white font-bold mb-1 text-base tracking-wide">{title}</div>
                          <div className="text-xs text-[#dfb560] uppercase tracking-wider mb-2 font-semibold">
                            By {name || "Your Name"} &bull; {type}
                          </div>
                          <div className="text-xs text-slate-300 leading-relaxed">{desc || "No description provided yet. Enter details in step 2..."}</div>
                        </>
                      ) : (
                        <p>Please fill out form fields to preview your live action entry...</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-4 pt-6">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(2)}
                      className="w-1/3 bg-slate-900/50 hover:bg-slate-900 border border-white/20 py-4 rounded-lg font-bold text-slate-300 hover:text-white transition-all uppercase tracking-widest text-xs"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="w-2/3 bg-white text-slate-950 py-4 rounded-lg font-black hover:bg-slate-100 transition-all uppercase tracking-widest text-xs shadow-xl disabled:opacity-60"
                    >
                      {submitting ? "Submitting..." : "Submit Initiative"}
                    </button>
                  </div>
                </div>
              )}
            </form>
          ) : (
            <div className="text-center py-12 space-y-6">
              <div className="w-16 h-16 bg-[#dfb560]/20 text-[#dfb560] rounded-full flex items-center justify-center mx-auto border border-[#dfb560]/40">
                <span className="text-3xl font-bold">✓</span>
              </div>
              <h3
                className="text-2xl font-bold text-white uppercase tracking-wider"
                style={{ fontFamily: "'Montserrat', sans-serif" }}
              >
                Initiative Received
              </h3>
              <p className="text-slate-300 max-w-md mx-auto text-sm leading-relaxed">
                Thank you, <span className="font-bold text-white">{name.split(" ")[0]}</span>. Your takeaway item has been successfully entered. We will synthesize this into the official Takeaway Action Guide for Tachlis Conference attendees.
              </p>
              <div className="pt-4">
                <button
                  onClick={() => window.location.reload()}
                  className="gold-gradient-bg text-slate-950 px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-md"
                >
                  Submit Another Action
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Dashboard */}
      <section id="dashboard" className="max-w-6xl mx-auto py-24 border-t border-white/10 px-6">
        <div className="text-center mb-16">
          <h3
            className="text-3xl md:text-4xl font-extrabold uppercase tracking-wider text-white"
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            Projected Collective Impact
          </h3>
          <p className="text-[#dfb560] uppercase tracking-widest text-xs font-semibold mt-2">
            Aggregated takeaways from leadership contributors
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-stretch">
          <div className="glass-card rounded-2xl p-6 md:p-8 flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-black uppercase tracking-widest mb-6 text-slate-300 text-center">
                Takeaway Action Type Balance
              </h4>
              <div className="h-[280px] w-full flex items-center justify-center">
                <canvas ref={chartRef} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <div className="glass-card p-6 md:p-8 rounded-2xl relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 left-0 w-full h-[2px] gold-gradient-bg" />
              <div>
                <h4 className="text-xs font-black uppercase tracking-[0.2em] mb-2 text-slate-400">
                  Total Approved Initiatives
                </h4>
                <div className="text-5xl font-black text-white my-3 flex items-baseline gap-2" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                  <span>{finalCount}</span>
                  <span className="text-sm font-bold text-[#dfb560]">/ 20 Target</span>
                </div>
                <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-white/5">
                  <div
                    className="gold-gradient-bg h-full transition-all duration-1000"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
              <p className="text-[11px] text-slate-400 italic mt-4">
                Help us cover 100% of our action areas for Tachlis Conference attendees.
              </p>
            </div>

            <div className="glass-card p-6 md:p-8 rounded-2xl flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-black uppercase tracking-[0.15em] mb-4 text-[#dfb560]">
                  Featured Initiative Spotlight
                </h4>
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <span className="w-2 h-2 bg-[#dfb560] rounded-full animate-pulse" />
                    <span className="font-bold text-xs uppercase tracking-wider text-slate-300">
                      {latest.name}
                    </span>
                  </div>
                  <h5
                    className="text-lg font-bold text-white"
                    style={{ fontFamily: "'Montserrat', sans-serif" }}
                  >
                    {latest.title}
                  </h5>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    {latest.desc.length > 120 ? latest.desc.substring(0, 120) + "..." : latest.desc}
                  </p>
                  <span className="inline-block px-3 py-1 bg-slate-950 text-[10px] font-black uppercase tracking-[0.15em] rounded border border-[#dfb560]/30 text-[#f2d08a]">
                    {latest.type}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Partners */}
      <div className="max-w-6xl mx-auto px-6 pt-12 pb-24 border-t border-white/10 text-center">
        <p
          className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-400 mb-10"
          style={{ fontFamily: "'Montserrat', sans-serif" }}
        >
          Community Partners
        </p>
        <div className="flex flex-wrap justify-center items-center gap-x-12 gap-y-6 text-sm font-bold text-slate-400 opacity-85 uppercase tracking-[0.15em]">
          <span>UNAPOLOGETICALLY JEWISH</span>
          <span>emet talks.</span>
          <span>STOP ANTIZIONISM</span>
          <span>TAFSIK</span>
          <span>DARA</span>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12 text-center text-slate-500 px-6" style={{ background: "rgba(2, 6, 23, 0.7)" }}>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-3">
          Tachlis Conference II &bull; Event Organizing Committee
        </p>
        <div className="flex justify-center space-x-6 text-[11px] font-medium text-slate-400 mb-4">
          <span className="hover:text-[#dfb560] transition-colors cursor-pointer">Privacy Shield</span>
          <span className="hover:text-[#dfb560] transition-colors cursor-pointer">Contact Organizer</span>
          <span className="hover:text-[#dfb560] transition-colors cursor-pointer">Luma Portal</span>
        </div>
        <p className="text-[9px] text-slate-600 max-w-xl mx-auto mt-2 leading-relaxed">
          Portal designed in alignment with official campaign visuals.
        </p>
      </footer>

      {/* Custom Alert Modal */}
      {alertOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md transition-opacity duration-300"
          style={{ background: "rgba(2, 6, 23, 0.8)" }}
          onClick={() => setAlertOpen(false)}
        >
          <div
            className="glass-card max-w-md w-full p-6 rounded-2xl shadow-2xl text-center border-t-4 border-[#dfb560] transform scale-95 transition-transform duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 bg-amber-500/10 text-[#dfb560] rounded-full flex items-center justify-center mx-auto mb-4 border border-[#dfb560]/30">
              <span className="text-xl font-bold">!</span>
            </div>
            <h4
              className="text-lg font-bold text-white mb-2 uppercase tracking-wide"
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              Notice
            </h4>
            <p className="text-sm text-slate-300 mb-6">{alertMessage}</p>
            <button
              onClick={() => setAlertOpen(false)}
              className="w-full gold-gradient-bg text-slate-950 py-2.5 rounded-lg font-black hover:opacity-95 transition-all uppercase tracking-widest text-xs"
            >
              Acknowledge
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
