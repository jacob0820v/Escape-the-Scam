import { useReducer, useCallback, useRef, useMemo, useEffect } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Radar,
  Lock,
  ArrowRight,
  Loader2,
  CheckCircle2,
  XCircle,
  Wifi,
  Fingerprint,
  Timer,
  ListChecks,
} from "lucide-react";

/* =====================================================================
   CONFIG
   ===================================================================== */

const SUPABASE_FUNCTION_URL =
  "https://pdwchvwkshxiityjoanr.supabase.co/functions/v1/escape-the-scam-api";

const SUPABASE_PUBLIC_KEY = "sb_publishable_6noC0K_7UOlOy_8WAUpysA_lw5qpCEx";

const RANKS = [
  {
    level: 1,
    character: "SPIDER-MAN",
    medal: "🥉",
    medalName: "BRONZE",
    title: "SCAM SPOTTER",
    accent: "#FFB020",
    description: "You've taken your first step toward becoming a Scam Shield hero.",
  },
  {
    level: 2,
    character: "HULK",
    medal: "🥈",
    medalName: "SILVER",
    title: "SCAM BUSTER",
    accent: "#9BE8D8",
    description: "Your scam-detection instincts are getting stronger.",
  },
  {
    level: 3,
    character: "IRON MAN",
    medal: "🥇",
    medalName: "GOLD",
    title: "SCAM DEFENDER",
    accent: "#FFD23F",
    description: "Your instincts are becoming seriously sharp.",
  },
  {
    level: 4,
    character: "CAPTAIN AMERICA",
    medal: "🏅",
    medalName: "PLATINUM",
    title: "SCAM GUARDIAN",
    accent: "#5FA8FF",
    description: "Only the toughest scam tactics stand between you and the top.",
  },
  {
    level: 5,
    character: "THOR",
    medal: "💎",
    medalName: "DIAMOND",
    title: "SCAM SHIELD CHAMPION",
    accent: "#00D9A0",
    description: "You've mastered the Scam Shield challenge.",
  },
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_REGEX = /^[6-9]\d{9}$/;

/* =====================================================================
   API HELPER — single fetch wrapper, aborts stale requests
   ===================================================================== */

async function callApi(payload, signal) {
  const response = await fetch(SUPABASE_FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_PUBLIC_KEY}`,
      apikey: SUPABASE_PUBLIC_KEY,
    },
    body: JSON.stringify(payload),
    signal,
  });

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("Invalid response from server.");
  }

  if (!response.ok || !data.success) {
    throw new Error(data.message || "Something went wrong.");
  }
  return data;
}

/* =====================================================================
   REDUCER — one state tree, one dispatch, minimal re-render surface
   ===================================================================== */

const initialState = {
  screen: "landing",
  consent: false,
  playerData: { name: "", email: "", mobile: "" },
  loading: false,
  error: "",
  questions: [],
  currentQuestion: 0,
  score: 0,
  selectedAnswer: null,
  answerSubmitted: false,
  answerCorrect: null,
  answerExplanation: "",
  showRankReveal: false,
  latestRank: null,
};

function reducer(state, action) {
  switch (action.type) {
    case "SET_SCREEN":
      return { ...state, screen: action.screen, error: "" };
    case "SET_CONSENT":
      return { ...state, consent: action.value };
    case "SET_FIELD":
      return {
        ...state,
        playerData: { ...state.playerData, [action.field]: action.value },
      };
    case "SET_LOADING":
      return { ...state, loading: action.value };
    case "SET_ERROR":
      return { ...state, error: action.message, loading: false };
    case "START_GAME_SUCCESS":
      return {
        ...state,
        questions: action.questions,
        currentQuestion: 0,
        score: 0,
        selectedAnswer: null,
        answerSubmitted: false,
        answerCorrect: null,
        answerExplanation: "",
        showRankReveal: false,
        latestRank: null,
        screen: "game",
        loading: false,
        error: "",
      };
    case "SELECT_ANSWER":
      // Fires the instant the person clicks — shows a "verifying" state
      // immediately, before the server confirms correct/incorrect.
      return {
        ...state,
        selectedAnswer: action.index,
        loading: true,
        error: "",
      };
    case "ANSWER_SUCCESS": {
      const rank = action.correct ? RANKS[action.score - 1] : null;
      return {
        ...state,
        selectedAnswer: action.index,
        answerSubmitted: true,
        answerCorrect: action.correct,
        answerExplanation: action.explanation,
        score: action.score,
        latestRank: rank || state.latestRank,
        showRankReveal: Boolean(rank),
        loading: false,
        error: "",
      };
    }
    case "NEXT_QUESTION": {
      const isLast = state.currentQuestion >= state.questions.length - 1;
      if (isLast) return { ...state, screen: "results", showRankReveal: false };
      return {
        ...state,
        currentQuestion: state.currentQuestion + 1,
        selectedAnswer: null,
        answerSubmitted: false,
        answerCorrect: null,
        answerExplanation: "",
        showRankReveal: false,
        error: "",
      };
    }
    case "HIDE_RANK_REVEAL":
      return { ...state, showRankReveal: false };
    case "RESET_GAME":
      return {
        ...initialState,
        playerData: state.playerData, // keep entered details for convenience
      };
    default:
      return state;
  }
}

/* =====================================================================
   SHARED VISUAL PRIMITIVES
   ===================================================================== */

function ScanlineStyles() {
  // One injected stylesheet for every animation used across the app.
  return (
    <style>{`
      @keyframes scam-scan {
        0% { transform: translateY(-100%); }
        100% { transform: translateY(100%); }
      }
      @keyframes scam-pulse-ring {
        0% { box-shadow: 0 0 0 0 rgba(255,176,32,0.45); }
        70% { box-shadow: 0 0 0 14px rgba(255,176,32,0); }
        100% { box-shadow: 0 0 0 0 rgba(255,176,32,0); }
      }
      @keyframes scam-shake {
        10%, 90% { transform: translateX(-1px); }
        20%, 80% { transform: translateX(2px); }
        30%, 50%, 70% { transform: translateX(-4px); }
        40%, 60% { transform: translateX(4px); }
      }
      @keyframes scam-glitch-in {
        0% { opacity: 0; transform: translateY(10px) scale(0.97); filter: blur(2px); }
        60% { opacity: 1; transform: translateY(-2px) scale(1.01); filter: blur(0); }
        100% { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes scam-blink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.25; }
      }
      @keyframes scam-radar {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      @keyframes scam-rise {
        0% { opacity: 0; transform: translateY(14px); }
        100% { opacity: 1; transform: translateY(0); }
      }
      @keyframes scam-float {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-6px); }
      }
      .scam-scanline::after {
        content: "";
        position: absolute;
        inset: 0;
        background: linear-gradient(180deg, rgba(255,176,32,0) 0%, rgba(255,176,32,0.08) 45%, rgba(255,176,32,0.16) 50%, rgba(255,176,32,0.08) 55%, rgba(255,176,32,0) 100%);
        animation: scam-scan 3.2s linear infinite;
        pointer-events: none;
      }
      .scam-shake { animation: scam-shake 0.5s cubic-bezier(.36,.07,.19,.97) both; }
      .scam-rise { animation: scam-rise 0.45s ease both; }
      .scam-glitch-in { animation: scam-glitch-in 0.5s ease both; }
      .scam-blink { animation: scam-blink 1.6s ease-in-out infinite; }
      .scam-radar { animation: scam-radar 4s linear infinite; }
      .scam-float { animation: scam-float 4s ease-in-out infinite; }
      .scam-btn { position: relative; overflow: hidden; }
      .scam-btn::before {
        content: "";
        position: absolute;
        top: 0; left: -60%;
        width: 40%; height: 100%;
        background: linear-gradient(120deg, transparent, rgba(255,255,255,0.35), transparent);
        transform: skewX(-20deg);
        transition: left 0.55s ease;
      }
      .scam-btn:hover::before { left: 130%; }
      .scam-grid-bg {
        background-image:
          linear-gradient(rgba(255,176,32,0.05) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,176,32,0.05) 1px, transparent 1px);
        background-size: 34px 34px;
      }
      @media (prefers-reduced-motion: reduce) {
        .scam-scanline::after, .scam-shake, .scam-rise, .scam-glitch-in, .scam-blink, .scam-radar, .scam-float, .scam-btn::before {
          animation: none !important;
          transition: none !important;
        }
      }
    `}</style>
  );
}

function LiveBadge({ label = "LIVE THREAT SIMULATION" }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1.5">
      <span className="relative flex h-2 w-2">
        <span className="scam-blink absolute inline-flex h-full w-full rounded-full bg-amber-400" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
      </span>
      <span className="font-mono text-[11px] tracking-[0.2em] text-amber-300">{label}</span>
    </div>
  );
}

function PrimaryButton({ children, onClick, disabled, className = "", type = "button" }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`scam-btn font-mono font-bold tracking-wide rounded-xl transition-all duration-200
        bg-amber-400 text-slate-950 hover:bg-amber-300 active:scale-[0.98]
        disabled:opacity-40 disabled:cursor-not-allowed
        focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300
        ${className}`}
    >
      {children}
    </button>
  );
}

/* =====================================================================
   APP
   ===================================================================== */

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const abortRef = useRef(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const currentRank = state.score > 0 ? RANKS[state.score - 1] : null;

  /* ---------------- START GAME ---------------- */

  const startGame = useCallback(async () => {
    const name = state.playerData.name.trim();
    const email = state.playerData.email.trim().toLowerCase();
    const mobile = state.playerData.mobile.trim();

    if (!name || name.length < 2) return dispatch({ type: "SET_ERROR", message: "Please enter a valid name." });
    if (name.length > 100) return dispatch({ type: "SET_ERROR", message: "Name is too long." });
    if (!EMAIL_REGEX.test(email)) return dispatch({ type: "SET_ERROR", message: "Please enter a valid email address." });
    if (!MOBILE_REGEX.test(mobile)) return dispatch({ type: "SET_ERROR", message: "Please enter a valid 10-digit mobile number." });
    if (!state.consent) return dispatch({ type: "SET_ERROR", message: "Consent is required." });

    dispatch({ type: "SET_LOADING", value: true });
    abortRef.current = new AbortController();

    try {
      const data = await callApi(
        { action: "start_game", name, email, mobile, consent: true },
        abortRef.current.signal
      );

      sessionStorage.setItem("player_id", String(data.player_id));
      sessionStorage.setItem("session_id", String(data.session_id));

      dispatch({ type: "START_GAME_SUCCESS", questions: data.questions || [] });
    } catch (err) {
      if (err.name === "AbortError") return;
      console.error("START GAME ERROR:", err);
      dispatch({ type: "SET_ERROR", message: err instanceof Error ? err.message : "Could not start the game." });
    }
  }, [state.playerData, state.consent]);

  /* ---------------- SUBMIT ANSWER ---------------- */

  const handleAnswer = useCallback(
    async (index) => {
      if (state.answerSubmitted || state.loading) return;

      const question = state.questions[state.currentQuestion];
      if (!question) return dispatch({ type: "SET_ERROR", message: "Question not found." });

      const sessionId = sessionStorage.getItem("session_id");
      if (!sessionId) {
        dispatch({ type: "SET_ERROR", message: "Your game session could not be found. Please start again." });
        dispatch({ type: "SET_SCREEN", screen: "landing" });
        return;
      }

      // Show the pick instantly — don't wait on the network for the
      // button to visually respond to the click.
      dispatch({ type: "SELECT_ANSWER", index });
      abortRef.current = new AbortController();

      try {
        // Only the selected index is sent — correctness, score, and rank
        // are computed server-side and never trusted from the client.
        const data = await callApi(
          {
            action: "submit_answer",
            session_id: sessionId,
            level: state.currentQuestion + 1,
            answer: index,
          },
          abortRef.current.signal
        );

        dispatch({
          type: "ANSWER_SUCCESS",
          index,
          correct: Boolean(data.correct),
          explanation: data.explanation || "",
          score: typeof data.score === "number" ? data.score : state.score,
        });
      } catch (err) {
        if (err.name === "AbortError") return;
        console.error("ANSWER SUBMISSION ERROR:", err);
        dispatch({ type: "SET_ERROR", message: err instanceof Error ? err.message : "Could not submit your answer." });
      }
    },
    [state.answerSubmitted, state.loading, state.questions, state.currentQuestion, state.score]
  );

  const handleNextQuestion = useCallback(() => dispatch({ type: "NEXT_QUESTION" }), []);

  const resetGame = useCallback(() => {
    sessionStorage.removeItem("player_id");
    sessionStorage.removeItem("session_id");
    dispatch({ type: "RESET_GAME" });
  }, []);

  const setField = useCallback(
    (field) => (e) => {
      const value = field === "mobile" ? e.target.value.replace(/\D/g, "") : e.target.value;
      dispatch({ type: "SET_FIELD", field, value });
    },
    []
  );

  const goTo = useCallback((screen) => () => dispatch({ type: "SET_SCREEN", screen }), []);

  /* =====================================================================
     SCREEN: LANDING
     ===================================================================== */

  if (state.screen === "landing") {
    return (
      <Shell>
        <div className="w-full max-w-4xl text-center scam-rise">
          <div className="mb-6 flex justify-center">
            <div className="scam-float relative">
              <span className="absolute -inset-3 rounded-full border border-amber-400/30 scam-radar" style={{ borderTopColor: "transparent" }} />
              <div className="relative inline-flex items-center justify-center w-24 h-24 rounded-full bg-amber-400 shadow-2xl shadow-amber-500/30">
                <ShieldCheck className="w-11 h-11 text-slate-950" strokeWidth={2.4} />
              </div>
            </div>
          </div>

          <div className="flex justify-center mb-5">
            <LiveBadge />
          </div>

          <h1 className="text-5xl md:text-7xl font-black tracking-tight font-mono text-white">
            ESCAPE THE <span className="text-amber-400">SCAM</span>
          </h1>

          <h2 className="mt-5 text-2xl md:text-3xl font-bold text-slate-100">Can You Beat the Scam?</h2>

          <p className="max-w-2xl mx-auto mt-5 text-lg md:text-xl leading-relaxed text-slate-300">
            Think you can spot an investment scam before it traps you? Test your scam-spotting
            skills across five escalating alerts and learn how to stay safer online.
          </p>

          <div className="flex flex-wrap justify-center gap-5 mt-10">
            <StatCard icon={<Timer className="w-6 h-6" />} label="DURATION" value="2–3 Minutes" />
            <StatCard icon={<ListChecks className="w-6 h-6" />} label="ALERTS" value="5 Levels" />
            <StatCard icon={<Radar className="w-6 h-6" />} label="CHALLENGE" value="Spot the Scam" />
          </div>

          <PrimaryButton onClick={goTo("instructions")} className="mt-12 px-12 py-4 text-xl shadow-xl shadow-amber-400/30 hover:scale-105">
            <span className="inline-flex items-center gap-2">
              PLAY NOW <ArrowRight className="w-5 h-5" />
            </span>
          </PrimaryButton>

          <p className="mt-8 text-base font-semibold text-slate-400">
            Spot it. Stop it. <span className="text-amber-400">Stay Safe.</span>
          </p>
        </div>
      </Shell>
    );
  }

  /* =====================================================================
     SCREEN: INSTRUCTIONS
     ===================================================================== */

  if (state.screen === "instructions") {
    const rules = [
      { icon: <ListChecks className="w-4 h-4" />, text: <>You will face <strong>5 levels</strong>. Each level becomes more difficult.</> },
      { icon: <Fingerprint className="w-4 h-4" />, text: "Select the answer you believe is correct." },
      { icon: <ShieldCheck className="w-4 h-4" />, text: <>Every correct answer earns you a new <strong>Marvel-inspired rank and medal.</strong></> },
      { icon: <AlertTriangle className="w-4 h-4" />, text: <>If you answer incorrectly, you can <strong>continue or exit the game.</strong></> },
      { icon: <ShieldAlert className="w-4 h-4" />, text: <>Reach Level 5 and score 4 or more correct answers to become Champion.</> },
    ];

    return (
      <Shell>
        <div className="max-w-3xl mx-auto w-full scam-rise">
          <div className="text-center mb-10">
            <ShieldCheck className="w-14 h-14 mx-auto text-amber-400 mb-4" />
            <h1 className="text-4xl md:text-5xl font-black font-mono text-white">HOW TO PLAY</h1>
            <p className="mt-3 text-slate-400">Think fast. Spot the warning signs. Stay safe.</p>
          </div>

          <Card scanline>
            <h2 className="text-2xl font-bold text-amber-400 mb-6 font-mono">Game Rules</h2>

            <div className="space-y-5">
              {rules.map((rule, i) => (
                <div key={i} className="flex gap-4 items-start">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-amber-400/30 bg-amber-400/10 text-amber-400">
                    {rule.icon}
                  </span>
                  <p className="text-slate-200">{rule.text}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 p-5 rounded-2xl bg-amber-400/10 border border-amber-400/30">
              <p className="text-amber-300 font-bold text-lg flex items-center gap-2">
                <ShieldAlert className="w-5 h-5" /> CHAMPION RULE
              </p>
              <p className="mt-2 text-slate-200">
                Get at least <strong>4 out of 5</strong> questions correct to become a Scam Shield Champion.
              </p>
            </div>

            <div className="mt-8">
              <h2 className="text-xl font-bold mb-4 text-white">Consent</h2>
              <label className="flex gap-4 items-start cursor-pointer group">
                <input
                  type="checkbox"
                  checked={state.consent}
                  onChange={(e) => dispatch({ type: "SET_CONSENT", value: e.target.checked })}
                  className="mt-1 w-5 h-5 accent-amber-400"
                />
                <span className="text-slate-300 text-sm leading-relaxed group-hover:text-slate-200">
                  I have read and understood the instructions and consent to participate in the
                  game and to the collection and use of my details for the stated purpose.
                </span>
              </label>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 mt-9">
              <button
                onClick={goTo("landing")}
                className="flex-1 py-4 rounded-xl border border-slate-600 text-slate-300 font-bold hover:bg-slate-800/60 transition font-mono"
              >
                ← BACK
              </button>
              <PrimaryButton onClick={goTo("details")} disabled={!state.consent} className="flex-1 py-4">
                PROCEED →
              </PrimaryButton>
            </div>
          </Card>
        </div>
      </Shell>
    );
  }

  /* =====================================================================
     SCREEN: DETAILS
     ===================================================================== */

  if (state.screen === "details") {
    return (
      <Shell>
        <div className="w-full max-w-xl scam-rise">
          <div className="text-center mb-8">
            <Lock className="w-14 h-14 mx-auto text-amber-400 mb-4" />
            <h1 className="text-4xl font-black font-mono text-white">READY TO PLAY?</h1>
            <p className="mt-3 text-slate-400">Enter your details to start the challenge.</p>
          </div>

          <Card scanline>
            <div className="space-y-5">
              <Field label="Name">
                <input
                  type="text"
                  placeholder="Enter your name"
                  value={state.playerData.name}
                  onChange={setField("name")}
                  className={inputClass}
                />
              </Field>

              <Field label="Email ID">
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={state.playerData.email}
                  onChange={setField("email")}
                  className={inputClass}
                />
              </Field>

              <Field label="Mobile Number">
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="10-digit mobile number"
                  value={state.playerData.mobile}
                  onChange={setField("mobile")}
                  className={inputClass}
                />
              </Field>
            </div>

            {state.error && <ErrorBanner>{state.error}</ErrorBanner>}

            <PrimaryButton onClick={startGame} disabled={state.loading} className="w-full mt-8 py-4 text-lg">
              {state.loading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" /> STARTING...
                </span>
              ) : (
                "START GAME →"
              )}
            </PrimaryButton>
          </Card>
        </div>
      </Shell>
    );
  }

  /* =====================================================================
     SCREEN: GAME
     ===================================================================== */

  if (state.screen === "game") {
    const question = state.questions[state.currentQuestion];

    if (!question) {
      return (
        <Shell>
          <div className="text-center scam-rise">
            <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <p className="text-red-400 text-xl font-bold">Unable to load the question.</p>
            <PrimaryButton onClick={resetGame} className="mt-6 px-8 py-3">
              RETURN TO START
            </PrimaryButton>
          </div>
        </Shell>
      );
    }

    return (
      <Shell wide>
        <div className="max-w-3xl mx-auto w-full">
          {/* HEADER */}
          <div className="flex items-center justify-between mb-8 scam-rise">
            <div>
              <p className="text-sm font-semibold text-amber-400 font-mono tracking-wider">ESCAPE THE SCAM</p>
              <h1 className="text-2xl md:text-3xl font-black text-white">Scam Shield Challenge</h1>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-400 font-mono">LEVEL</p>
              <p className="text-2xl font-black text-white font-mono">{state.currentQuestion + 1} / 5</p>
            </div>
          </div>

          {/* SEGMENTED PROGRESS — "firewall layers" */}
          <div className="grid grid-cols-5 gap-2 mb-5">
            {RANKS.map((_, i) => (
              <div
                key={i}
                className={`h-2.5 rounded-full transition-all duration-500 ${
                  i <= state.currentQuestion ? "bg-amber-400" : "bg-slate-800"
                }`}
              />
            ))}
          </div>

          <div className="flex justify-between items-center mb-8">
            <span className="px-4 py-2 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-400 font-black text-sm font-mono">
              {question.difficulty}
            </span>
            {currentRank && (
              <span className="text-sm font-bold text-slate-400 font-mono">
                {currentRank.medal} {currentRank.character}
              </span>
            )}
          </div>

          {/* SHIELD INDICATOR */}
          <div className="text-center mb-8">
            <div
              className={`inline-flex items-center justify-center w-24 h-24 rounded-full border transition-all duration-500 ${
                state.answerSubmitted && state.answerCorrect
                  ? "bg-emerald-400/20 border-emerald-400 shadow-lg shadow-emerald-400/30 scale-110"
                  : state.answerSubmitted
                  ? "bg-red-400/10 border-red-400/40"
                  : "bg-amber-400/10 border-amber-400/30"
              }`}
              style={!state.answerSubmitted ? { animation: "scam-pulse-ring 2.4s infinite" } : undefined}
            >
              {state.answerSubmitted && state.answerCorrect ? (
                <ShieldCheck className="w-11 h-11 text-emerald-400" />
              ) : state.answerSubmitted ? (
                <ShieldAlert className="w-11 h-11 text-red-400" />
              ) : (
                <ShieldCheck className="w-11 h-11 text-amber-400" />
              )}
            </div>
          </div>

          {/* QUESTION CARD */}
          <Card
            scanline={!state.answerSubmitted}
            className={state.answerSubmitted && !state.answerCorrect ? "scam-shake" : "scam-glitch-in"}
            key={state.currentQuestion}
          >
            <p className="text-sm font-bold text-amber-400 mb-3 font-mono tracking-widest">
              LEVEL {String(state.currentQuestion + 1).padStart(2, "0")}
            </p>

            <h2 className="text-2xl md:text-3xl font-bold leading-relaxed text-white">{question.text}</h2>

            <div className="mt-8 space-y-4">
              {question.options.map((option, index) => {
                const isSelected = index === state.selectedAnswer;
                const isVerifying = isSelected && state.loading && !state.answerSubmitted;

                let optionStyle = "bg-slate-800/70 border-slate-700 hover:border-amber-400 hover:bg-slate-800";

                if (isVerifying) {
                  optionStyle = "bg-amber-400/10 border-amber-400 text-amber-200";
                } else if (state.answerSubmitted) {
                  if (isSelected && state.answerCorrect) optionStyle = "bg-emerald-500/10 border-emerald-400 text-emerald-300";
                  else if (isSelected && !state.answerCorrect) optionStyle = "bg-red-500/10 border-red-400 text-red-300";
                  else optionStyle = "bg-slate-800/40 border-slate-700 opacity-50";
                } else if (state.loading) {
                  optionStyle = "bg-slate-800/40 border-slate-700 opacity-40";
                }

                return (
                  <button
                    key={index}
                    onClick={() => handleAnswer(index)}
                    disabled={state.answerSubmitted || state.loading}
                    className={`scam-btn w-full text-left p-5 rounded-2xl border text-slate-200 font-semibold transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300 ${optionStyle}`}
                  >
                    <div className="flex items-center gap-4">
                      <span className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-700 text-amber-400 font-black shrink-0 font-mono">
                        {isVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : String.fromCharCode(65 + index)}
                      </span>
                      <span>{option}</span>
                      {isVerifying && (
                        <span className="ml-auto text-xs font-mono tracking-widest text-amber-300">SCANNING…</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {state.error && <ErrorBanner>{state.error}</ErrorBanner>}

            {state.answerSubmitted && (
              <div
                className={`mt-6 p-5 rounded-2xl border scam-rise ${
                  state.answerCorrect ? "bg-emerald-500/10 border-emerald-400/30" : "bg-red-500/10 border-red-400/30"
                }`}
              >
                <p className={`font-black text-lg flex items-center gap-2 ${state.answerCorrect ? "text-emerald-400" : "text-red-400"}`}>
                  {state.answerCorrect ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                  {state.answerCorrect ? "Correct!" : "Not quite!"}
                </p>
                <p className="mt-2 text-slate-300">{state.answerExplanation}</p>
              </div>
            )}

            {state.answerSubmitted && !state.answerCorrect && (
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <PrimaryButton onClick={handleNextQuestion} className="py-4">
                  CONTINUE →
                </PrimaryButton>
                <button
                  onClick={resetGame}
                  className="py-4 rounded-xl border border-red-500/50 text-red-400 font-black hover:bg-red-500/10 transition font-mono"
                >
                  EXIT GAME
                </button>
              </div>
            )}

            {state.answerSubmitted && state.answerCorrect && (
              <PrimaryButton onClick={handleNextQuestion} className="w-full mt-6 py-4 text-lg">
                {state.currentQuestion === state.questions.length - 1 ? "SEE RESULTS →" : "NEXT LEVEL →"}
              </PrimaryButton>
            )}
          </Card>

          <div className="mt-6 text-center">
            <p className="text-slate-400 text-sm font-mono">CURRENT SCORE</p>
            <p className="text-2xl font-black text-amber-400 font-mono">{state.score} / 5</p>
          </div>
        </div>

        {/* RANK REVEAL MODAL */}
        {state.showRankReveal && state.latestRank && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md px-6">
            <div className="scam-glitch-in w-full max-w-md text-center bg-slate-900 border border-amber-400/40 rounded-3xl p-8 shadow-2xl shadow-amber-400/20 relative overflow-hidden">
              <div className="scam-scanline absolute inset-0" />
              <p className="text-sm font-black tracking-widest text-amber-400 font-mono relative">RANK UNLOCKED</p>
              <div className="mt-5 text-8xl relative">{state.latestRank.medal}</div>
              <p className="mt-5 text-sm font-bold text-slate-400 font-mono relative">{state.latestRank.medalName} MEDAL</p>
              <h2 className="mt-2 text-4xl font-black relative" style={{ color: state.latestRank.accent }}>
                {state.latestRank.character}
              </h2>
              <p className="mt-3 text-xl font-black text-white relative">{state.latestRank.title}</p>
              <p className="mt-4 text-slate-300 relative">{state.latestRank.description}</p>
              <PrimaryButton onClick={() => dispatch({ type: "HIDE_RANK_REVEAL" })} className="mt-7 w-full py-4 relative">
                CONTINUE →
              </PrimaryButton>
            </div>
          </div>
        )}
      </Shell>
    );
  }

  /* =====================================================================
     SCREEN: RESULTS
     ===================================================================== */

  if (state.screen === "results") {
    const champion = state.score >= 4;
    const finalRank = state.score > 0 ? RANKS[state.score - 1] : null;

    return (
      <Shell>
        <div className="w-full max-w-xl text-center scam-rise">
          <div className="text-7xl mb-6">{champion ? "🏆" : <ShieldCheck className="w-16 h-16 mx-auto text-amber-400" />}</div>

          <h1 className="text-4xl md:text-5xl font-black font-mono text-white">
            {champion ? "SCAM SHIELD CHAMPION!" : "CHALLENGE COMPLETE"}
          </h1>

          <p className="mt-4 text-xl text-slate-300">
            {champion
              ? "Excellent work! You spotted the scam warning signs."
              : "Good attempt! Keep learning how to recognize scams."}
          </p>

          {finalRank && (
            <Card className="mt-8">
              <div className="text-6xl">{finalRank.medal}</div>
              <p className="mt-3 text-sm font-bold text-slate-400 font-mono">YOUR RANK</p>
              <h2 className="mt-1 text-3xl font-black" style={{ color: finalRank.accent }}>
                {finalRank.character}
              </h2>
              <p className="mt-2 text-white font-bold">{finalRank.title}</p>
            </Card>
          )}

          <Card className="mt-8">
            <p className="text-sm font-bold text-slate-400 font-mono">YOUR FINAL SCORE</p>
            <p className="mt-3 text-6xl font-black text-amber-400 font-mono">
              {state.score}
              <span className="text-3xl text-slate-500">/5</span>
            </p>

            <div className="mt-8 h-4 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-400 transition-all duration-700"
                style={{ width: `${(state.score / 5) * 100}%` }}
              />
            </div>

            <p className="mt-6 text-slate-300">
              {champion
                ? "You have earned the Scam Shield Champion badge."
                : "You need 4 or more correct answers to become a Champion."}
            </p>
          </Card>

          <PrimaryButton onClick={resetGame} className="mt-8 px-10 py-4 text-lg">
            PLAY AGAIN
          </PrimaryButton>
        </div>
      </Shell>
    );
  }

  return null;
}

/* =====================================================================
   LAYOUT / SMALL COMPONENTS
   ===================================================================== */

function Shell({ children, wide = false }) {
  return (
    <div className="min-h-screen bg-[#070A12] text-white relative overflow-hidden">
      <ScanlineStyles />
      <div className="scam-grid-bg absolute inset-0 pointer-events-none" />
      <div
        className="absolute -top-40 -right-40 w-96 h-96 rounded-full blur-3xl pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(255,176,32,0.12), transparent 70%)" }}
      />
      <div
        className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full blur-3xl pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(0,217,160,0.10), transparent 70%)" }}
      />
      <div className={`relative flex items-center justify-center px-6 py-12 min-h-screen ${wide ? "" : ""}`}>
        {children}
      </div>
    </div>
  );
}

function Card({ children, scanline = false, className = "" }) {
  return (
    <div
      className={`relative overflow-hidden bg-slate-900/80 backdrop-blur border border-slate-700 rounded-3xl p-7 md:p-9 ${className}`}
    >
      {scanline && <div className="scam-scanline absolute inset-0" />}
      <div className="relative">{children}</div>
    </div>
  );
}

function StatCard({ icon, label, value }) {
  return (
    <div className="w-44 rounded-2xl border border-slate-700 bg-slate-900/70 p-5 hover:border-amber-400/50 transition-colors">
      <div className="text-amber-400">{icon}</div>
      <p className="mt-3 text-sm font-semibold text-slate-400 font-mono">{label}</p>
      <p className="mt-1 text-lg font-bold text-white">{value}</p>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block mb-2 font-semibold text-slate-200">{label}</label>
      {children}
    </div>
  );
}

function ErrorBanner({ children }) {
  return (
    <div className="mt-5 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-start gap-2 scam-rise">
      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

const inputClass =
  "w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/40 transition-colors";
