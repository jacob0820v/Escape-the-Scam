import { useState } from "react";

const SUPABASE_FUNCTION_URL =
  "https://pdwchvwkshxiityjoanr.supabase.co/functions/v1/escape-the-scam-api";

const SUPABASE_PUBLIC_KEY =
  "sb_publishable_6noC0K_7UOlOy_8WAUpysA_lw5qpCEx";

// =========================================================
// RANK SYSTEM
// =========================================================

const ranks = [
  {
    level: 1,
    character: "SPIDER-MAN",
    medal: "🥉",
    medalName: "BRONZE",
    title: "SCAM SPOTTER",
    color: "text-orange-400",
    description:
      "You have taken your first step toward becoming a Scam Shield hero.",
  },
  {
    level: 2,
    character: "HULK",
    medal: "🥈",
    medalName: "SILVER",
    title: "SCAM BUSTER",
    color: "text-slate-300",
    description:
      "Your scam-detection skills are getting stronger.",
  },
  {
    level: 3,
    character: "IRON MAN",
    medal: "🥇",
    medalName: "GOLD",
    title: "SCAM DEFENDER",
    color: "text-yellow-400",
    description:
      "Your instincts are becoming seriously sharp.",
  },
  {
    level: 4,
    character: "CAPTAIN AMERICA",
    medal: "🏅",
    medalName: "PLATINUM",
    title: "SCAM GUARDIAN",
    color: "text-blue-400",
    description:
      "Only the toughest scam challenges stand between you and the top.",
  },
  {
    level: 5,
    character: "THOR",
    medal: "💎",
    medalName: "DIAMOND",
    title: "SCAM SHIELD CHAMPION",
    color: "text-cyan-400",
    description:
      "You have mastered the Scam Shield challenge.",
  },
];

// =========================================================
// API HELPER
// =========================================================

async function callApi(payload) {
  const response = await fetch(SUPABASE_FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_PUBLIC_KEY}`,
      apikey: SUPABASE_PUBLIC_KEY,
    },
    body: JSON.stringify(payload),
  });

  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error("Invalid response from server.");
  }

  if (!response.ok || !data.success) {
    throw new Error(
      data.message || "Something went wrong."
    );
  }

  return data;
}

// =========================================================
// APP
// =========================================================

function App() {
  const [screen, setScreen] = useState("landing");

  const [consent, setConsent] = useState(false);

  const [playerData, setPlayerData] = useState({
    name: "",
    email: "",
    mobile: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [questions, setQuestions] = useState([]);

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [score, setScore] = useState(0);

  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [answerSubmitted, setAnswerSubmitted] = useState(false);

  const [answerCorrect, setAnswerCorrect] = useState(null);
  const [answerExplanation, setAnswerExplanation] = useState("");

  const [showRankReveal, setShowRankReveal] = useState(false);
  const [latestRank, setLatestRank] = useState(null);

  // =========================================================
  // START GAME
  // =========================================================

  const startGame = async () => {
    setError("");

    const name = playerData.name.trim();
    const email = playerData.email.trim().toLowerCase();
    const mobile = playerData.mobile.trim();

    if (!name || name.length < 2) {
      setError("Please enter a valid name.");
      return;
    }

    if (name.length > 100) {
      setError("Name is too long.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    const mobileRegex = /^[6-9]\d{9}$/;

    if (!mobileRegex.test(mobile)) {
      setError(
        "Please enter a valid 10-digit mobile number."
      );
      return;
    }

    if (!consent) {
      setError("Consent is required.");
      return;
    }

    setLoading(true);

    try {
      const data = await callApi({
        action: "start_game",
        name,
        email,
        mobile,
        consent: true,
      });

      // Store only identifiers needed by this browser session.
      sessionStorage.setItem(
        "player_id",
        String(data.player_id)
      );

      sessionStorage.setItem(
        "session_id",
        String(data.session_id)
      );

      // The server sends questions WITHOUT correct answers.
      setQuestions(data.questions || []);

      setCurrentQuestion(0);
      setScore(0);

      setSelectedAnswer(null);
      setAnswerSubmitted(false);
      setAnswerCorrect(null);
      setAnswerExplanation("");

      setShowRankReveal(false);
      setLatestRank(null);

      setScreen("game");
    } catch (err) {
      console.error("START GAME ERROR:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Could not start the game."
      );
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // SUBMIT ANSWER
  // =========================================================

  const handleAnswer = async (index) => {
    if (answerSubmitted || loading) {
      return;
    }

    const question = questions[currentQuestion];

    if (!question) {
      setError("Question not found.");
      return;
    }

    const sessionId =
      sessionStorage.getItem("session_id");

    if (!sessionId) {
      setError(
        "Your game session could not be found. Please start again."
      );
      setScreen("landing");
      return;
    }

    setLoading(true);

    try {
      // IMPORTANT:
      // We send ONLY the selected answer.
      //
      // We DO NOT send:
      // correct_answer
      // score
      // winner
      //
      // The Edge Function calculates those values.

      const data = await callApi({
        action: "submit_answer",
        session_id: sessionId,
        level: currentQuestion + 1,
        answer: index,
      });

      setSelectedAnswer(index);
      setAnswerSubmitted(true);

      setAnswerCorrect(Boolean(data.correct));

      setAnswerExplanation(
        data.explanation || ""
      );

      const newScore =
        typeof data.score === "number"
          ? data.score
          : score;

      setScore(newScore);

      // =====================================================
      // RANK REVEAL
      // =====================================================

      if (data.correct) {
        const newRank = ranks[newScore - 1];

        if (newRank) {
          setLatestRank(newRank);
          setShowRankReveal(true);
        }
      }
    } catch (err) {
      console.error(
        "ANSWER SUBMISSION ERROR:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Could not submit your answer."
      );
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // NEXT QUESTION
  // =========================================================

  const handleNextQuestion = () => {
    setShowRankReveal(false);
    setError("");

    if (
      currentQuestion <
      questions.length - 1
    ) {
      setCurrentQuestion(
        (previous) => previous + 1
      );

      setSelectedAnswer(null);
      setAnswerSubmitted(false);
      setAnswerCorrect(null);
      setAnswerExplanation("");

      return;
    }

    setScreen("results");
  };

  // =========================================================
  // EXIT GAME
  // =========================================================

  const exitGame = () => {
    setShowRankReveal(false);

    setSelectedAnswer(null);
    setAnswerSubmitted(false);

    setAnswerCorrect(null);
    setAnswerExplanation("");

    setCurrentQuestion(0);
    setScore(0);

    setQuestions([]);

    setError("");

    sessionStorage.removeItem("player_id");
    sessionStorage.removeItem("session_id");

    setScreen("landing");
  };

  // =========================================================
  // RESET / PLAY AGAIN
  // =========================================================

  const playAgain = () => {
    setCurrentQuestion(0);
    setScore(0);

    setQuestions([]);

    setSelectedAnswer(null);
    setAnswerSubmitted(false);

    setAnswerCorrect(null);
    setAnswerExplanation("");

    setShowRankReveal(false);
    setLatestRank(null);

    setError("");

    sessionStorage.removeItem("player_id");
    sessionStorage.removeItem("session_id");

    setScreen("landing");
  };

  // =========================================================
  // LANDING
  // =========================================================

  if (screen === "landing") {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-6">
        <div className="w-full max-w-4xl text-center">

          <div className="mb-6">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-cyan-400 shadow-lg shadow-cyan-400/30">
              <span className="text-5xl">
                🛡️
              </span>
            </div>
          </div>

          <h1 className="text-5xl md:text-7xl font-black tracking-tight">
            ESCAPE THE{" "}
            <span className="text-cyan-400">
              SCAM
            </span>
          </h1>

          <h2 className="mt-5 text-2xl md:text-3xl font-bold">
            Can You Beat the Scam?
          </h2>

          <p className="max-w-2xl mx-auto mt-5 text-lg md:text-xl leading-relaxed text-slate-200">
            Think you can spot an investment scam before it traps you?
            Test your scam-spotting skills and learn how to stay safer online.
          </p>

          <div className="flex flex-wrap justify-center gap-5 mt-10">

            <div className="w-44 rounded-2xl border border-slate-700 bg-slate-900 p-5">
              <div className="text-3xl">⏱️</div>
              <p className="mt-3 text-sm font-semibold text-slate-400">
                DURATION
              </p>
              <p className="mt-1 text-lg font-bold">
                2–3 Minutes
              </p>
            </div>

            <div className="w-44 rounded-2xl border border-slate-700 bg-slate-900 p-5">
              <div className="text-3xl">❓</div>
              <p className="mt-3 text-sm font-semibold text-slate-400">
                QUESTIONS
              </p>
              <p className="mt-1 text-lg font-bold">
                5 Levels
              </p>
            </div>

            <div className="w-44 rounded-2xl border border-slate-700 bg-slate-900 p-5">
              <div className="text-3xl">🛡️</div>
              <p className="mt-3 text-sm font-semibold text-slate-400">
                CHALLENGE
              </p>
              <p className="mt-1 text-lg font-bold">
                Spot the Scam
              </p>
            </div>

          </div>

          <button
            onClick={() =>
              setScreen("instructions")
            }
            className="
              mt-12
              px-12
              py-4
              rounded-2xl
              bg-cyan-400
              text-slate-950
              text-xl
              font-black
              tracking-wide
              shadow-xl
              shadow-cyan-400/30
              hover:bg-cyan-300
              hover:scale-105
              active:scale-95
              transition-all
              duration-200
            "
          >
            PLAY NOW →
          </button>

          <p className="mt-8 text-base font-semibold text-slate-400">
            Spot it. Stop it.{" "}
            <span className="text-cyan-400">
              Stay Safe.
            </span>
          </p>

        </div>
      </div>
    );
  }

  // =========================================================
  // INSTRUCTIONS
  // =========================================================

  if (screen === "instructions") {
    return (
      <div className="min-h-screen bg-slate-950 text-white px-6 py-12">
        <div className="max-w-3xl mx-auto">

          <div className="text-center mb-10">
            <div className="text-6xl mb-4">
              🛡️
            </div>

            <h1 className="text-4xl md:text-5xl font-black">
              HOW TO PLAY
            </h1>

            <p className="mt-3 text-slate-300">
              Think fast. Spot the warning signs. Stay safe.
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-7 md:p-9">

            <h2 className="text-2xl font-bold text-cyan-400 mb-6">
              Game Rules
            </h2>

            <div className="space-y-5">

              <div className="flex gap-4">
                <span className="text-cyan-400 font-black text-xl">
                  01
                </span>
                <p className="text-slate-200">
                  You will face <strong>5 levels</strong>.
                  Each level becomes more difficult.
                </p>
              </div>

              <div className="flex gap-4">
                <span className="text-cyan-400 font-black text-xl">
                  02
                </span>
                <p className="text-slate-200">
                  Select the answer you believe is correct.
                </p>
              </div>

              <div className="flex gap-4">
                <span className="text-cyan-400 font-black text-xl">
                  03
                </span>
                <p className="text-slate-200">
                  Every correct answer earns you a new
                  <strong> Marvel-inspired rank and medal.</strong>
                </p>
              </div>

              <div className="flex gap-4">
                <span className="text-cyan-400 font-black text-xl">
                  04
                </span>
                <p className="text-slate-200">
                  If you answer incorrectly, you can
                  <strong> continue or exit the game.</strong>
                </p>
              </div>

              <div className="flex gap-4">
                <span className="text-cyan-400 font-black text-xl">
                  05
                </span>
                <p className="text-slate-200">
                  Reach Level 5 and score 4 or more
                  correct answers to become Champion.
                </p>
              </div>

            </div>

            <div className="mt-8 p-5 rounded-2xl bg-cyan-400/10 border border-cyan-400/30">
              <p className="text-cyan-300 font-bold text-lg">
                🏆 CHAMPION RULE
              </p>

              <p className="mt-2 text-slate-200">
                Get at least <strong>4 out of 5</strong>
                questions correct to become a
                Scam Shield Champion.
              </p>
            </div>

            <div className="mt-8">

              <h2 className="text-xl font-bold mb-4">
                Consent
              </h2>

              <label className="flex gap-4 items-start cursor-pointer">

                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) =>
                    setConsent(e.target.checked)
                  }
                  className="mt-1 w-5 h-5 accent-cyan-400"
                />

                <span className="text-slate-300 text-sm leading-relaxed">
                  I have read and understood the instructions and
                  consent to participate in the game and to the
                  collection and use of my details for the stated
                  purpose.
                </span>

              </label>

            </div>

            <div className="flex flex-col sm:flex-row gap-4 mt-9">

              <button
                onClick={() =>
                  setScreen("landing")
                }
                className="
                  flex-1
                  py-4
                  rounded-xl
                  border
                  border-slate-600
                  text-slate-300
                  font-bold
                  hover:bg-slate-800
                  transition
                "
              >
                ← BACK
              </button>

              <button
                disabled={!consent}
                onClick={() =>
                  setScreen("details")
                }
                className="
                  flex-1
                  py-4
                  rounded-xl
                  font-black
                  transition
                  disabled:opacity-40
                  disabled:cursor-not-allowed
                  bg-cyan-400
                  text-slate-950
                  hover:bg-cyan-300
                "
              >
                PROCEED →
              </button>

            </div>

          </div>
        </div>
      </div>
    );
  }

  // =========================================================
  // PLAYER DETAILS
  // =========================================================

  if (screen === "details") {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-6">

        <div className="w-full max-w-xl">

          <div className="text-center mb-8">
            <div className="text-6xl mb-4">
              🛡️
            </div>

            <h1 className="text-4xl font-black">
              READY TO PLAY?
            </h1>

            <p className="mt-3 text-slate-300">
              Enter your details to start the challenge.
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8">

            <div className="space-y-5">

              <div>
                <label className="block mb-2 font-semibold">
                  Name
                </label>

                <input
                  type="text"
                  placeholder="Enter your name"
                  value={playerData.name}
                  onChange={(e) =>
                    setPlayerData({
                      ...playerData,
                      name: e.target.value,
                    })
                  }
                  className="
                    w-full
                    px-4
                    py-3
                    rounded-xl
                    bg-slate-800
                    border
                    border-slate-600
                    text-white
                    placeholder-slate-500
                    focus:outline-none
                    focus:border-cyan-400
                  "
                />
              </div>

              <div>
                <label className="block mb-2 font-semibold">
                  Email ID
                </label>

                <input
                  type="email"
                  placeholder="Enter your email"
                  value={playerData.email}
                  onChange={(e) =>
                    setPlayerData({
                      ...playerData,
                      email: e.target.value,
                    })
                  }
                  className="
                    w-full
                    px-4
                    py-3
                    rounded-xl
                    bg-slate-800
                    border
                    border-slate-600
                    text-white
                    placeholder-slate-500
                    focus:outline-none
                    focus:border-cyan-400
                  "
                />
              </div>

              <div>
                <label className="block mb-2 font-semibold">
                  Mobile Number
                </label>

                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="10-digit mobile number"
                  value={playerData.mobile}
                  onChange={(e) =>
                    setPlayerData({
                      ...playerData,
                      mobile: e.target.value.replace(
                        /\D/g,
                        ""
                      ),
                    })
                  }
                  className="
                    w-full
                    px-4
                    py-3
                    rounded-xl
                    bg-slate-800
                    border
                    border-slate-600
                    text-white
                    placeholder-slate-500
                    focus:outline-none
                    focus:border-cyan-400
                  "
                />
              </div>

            </div>

            {error && (
              <div className="
                mt-5
                p-4
                rounded-xl
                bg-red-500/10
                border
                border-red-500/30
                text-red-400
              ">
                {error}
              </div>
            )}

            <button
              onClick={startGame}
              disabled={loading}
              className="
                w-full
                mt-8
                py-4
                rounded-xl
                bg-cyan-400
                text-slate-950
                font-black
                text-lg
                hover:bg-cyan-300
                disabled:opacity-50
                disabled:cursor-not-allowed
                transition
              "
            >
              {loading
                ? "STARTING..."
                : "START GAME →"}
            </button>

          </div>
        </div>
      </div>
    );
  }

  // =========================================================
  // GAME
  // =========================================================

  if (screen === "game") {
    const question =
      questions[currentQuestion];

    if (!question) {
      return (
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-6">
          <div className="text-center">
            <p className="text-red-400 text-xl font-bold">
              Unable to load the question.
            </p>

            <button
              onClick={exitGame}
              className="
                mt-6
                px-8
                py-3
                rounded-xl
                bg-cyan-400
                text-slate-950
                font-black
              "
            >
              RETURN TO START
            </button>
          </div>
        </div>
      );
    }

    const currentRank =
      score > 0
        ? ranks[score - 1]
        : null;

    return (
      <div className="min-h-screen bg-slate-950 text-white px-6 py-10">

        <div className="max-w-3xl mx-auto">

          {/* HEADER */}

          <div className="flex items-center justify-between mb-8">

            <div>
              <p className="text-sm font-semibold text-cyan-400">
                ESCAPE THE SCAM
              </p>

              <h1 className="text-2xl md:text-3xl font-black">
                Scam Shield Challenge
              </h1>
            </div>

            <div className="text-right">

              <p className="text-sm text-slate-400">
                LEVEL
              </p>

              <p className="text-2xl font-black">
                {currentQuestion + 1} / 5
              </p>

            </div>

          </div>

          {/* PROGRESS */}

          <div className="w-full h-3 bg-slate-800 rounded-full mb-5 overflow-hidden">

            <div
              className="
                h-full
                bg-cyan-400
                rounded-full
                transition-all
                duration-500
              "
              style={{
                width:
                  `${((currentQuestion + 1) / 5) * 100}%`,
              }}
            />

          </div>

          {/* DIFFICULTY */}

          <div className="flex justify-between items-center mb-8">

            <span className="
              px-4
              py-2
              rounded-full
              bg-cyan-400/10
              border
              border-cyan-400/30
              text-cyan-400
              font-black
              text-sm
            ">
              {question.difficulty}
            </span>

            {currentRank && (
              <span className="
                text-sm
                font-bold
                text-slate-400
              ">
                {currentRank.medal}{" "}
                {currentRank.character}
              </span>
            )}

          </div>

          {/* SHIELD */}

          <div className="text-center mb-8">

            <div
              className={`
                inline-flex
                items-center
                justify-center
                w-24
                h-24
                rounded-full
                border
                transition-all
                duration-500

                ${
                  answerSubmitted &&
                  answerCorrect
                    ? "bg-green-400/20 border-green-400 shadow-lg shadow-green-400/30 scale-110"
                    : answerSubmitted
                    ? "bg-red-400/10 border-red-400/30"
                    : "bg-cyan-400/10 border-cyan-400/30"
                }
              `}
            >
              <span className="text-5xl">
                🛡️
              </span>
            </div>

          </div>

          {/* QUESTION CARD */}

          <div className="
            bg-slate-900
            border
            border-slate-700
            rounded-3xl
            p-7
            md:p-9
          ">

            <p className="
              text-sm
              font-bold
              text-cyan-400
              mb-3
            ">
              LEVEL{" "}
              {String(
                currentQuestion + 1
              ).padStart(2, "0")}
            </p>

            <h2 className="
              text-2xl
              md:text-3xl
              font-bold
              leading-relaxed
            ">
              {question.text}
            </h2>

            {/* OPTIONS */}

            <div className="mt-8 space-y-4">

              {question.options.map(
                (option, index) => {

                  const isSelected =
                    index === selectedAnswer;

                  let optionStyle =
                    "bg-slate-800 border-slate-700 hover:border-cyan-400 hover:bg-slate-800/80";

                  if (answerSubmitted) {

                    if (
                      isSelected &&
                      answerCorrect
                    ) {
                      optionStyle =
                        "bg-green-500/10 border-green-400 text-green-300";
                    } else if (
                      isSelected &&
                      !answerCorrect
                    ) {
                      optionStyle =
                        "bg-red-500/10 border-red-400 text-red-300";
                    } else {
                      optionStyle =
                        "bg-slate-800 border-slate-700 opacity-60";
                    }
                  }

                  return (
                    <button
                      key={index}
                      onClick={() =>
                        handleAnswer(index)
                      }
                      disabled={
                        answerSubmitted ||
                        loading
                      }
                      className={`
                        w-full
                        text-left
                        p-5
                        rounded-2xl
                        border
                        text-slate-200
                        font-semibold
                        transition-all
                        duration-200
                        ${optionStyle}
                      `}
                    >

                      <div className="flex items-center gap-4">

                        <span className="
                          flex
                          items-center
                          justify-center
                          w-10
                          h-10
                          rounded-full
                          bg-slate-700
                          text-cyan-400
                          font-black
                          shrink-0
                        ">
                          {String.fromCharCode(
                            65 + index
                          )}
                        </span>

                        <span>
                          {option}
                        </span>

                      </div>

                    </button>
                  );
                }
              )}

            </div>

            {/* ERROR */}

            {error && (
              <div className="
                mt-6
                p-4
                rounded-xl
                bg-red-500/10
                border
                border-red-500/30
                text-red-400
              ">
                {error}
              </div>
            )}

            {/* ANSWER FEEDBACK */}

            {answerSubmitted && (

              <div
                className={`
                  mt-6
                  p-5
                  rounded-2xl
                  border

                  ${
                    answerCorrect
                      ? "bg-green-500/10 border-green-400/30"
                      : "bg-red-500/10 border-red-400/30"
                  }
                `}
              >

                <p
                  className={`
                    font-black
                    text-lg

                    ${
                      answerCorrect
                        ? "text-green-400"
                        : "text-red-400"
                    }
                  `}
                >
                  {answerCorrect
                    ? "✅ Correct!"
                    : "❌ Not quite!"}
                </p>

                <p className="mt-2 text-slate-300">
                  {answerExplanation}
                </p>

              </div>

            )}

            {/* WRONG ANSWER BUTTONS */}

            {answerSubmitted &&
              !answerCorrect && (

                <div className="
                  mt-6
                  grid
                  grid-cols-1
                  sm:grid-cols-2
                  gap-4
                ">

                  <button
                    onClick={handleNextQuestion}
                    className="
                      py-4
                      rounded-xl
                      bg-cyan-400
                      text-slate-950
                      font-black
                      hover:bg-cyan-300
                      transition
                    "
                  >
                    CONTINUE →
                  </button>

                  <button
                    onClick={exitGame}
                    className="
                      py-4
                      rounded-xl
                      border
                      border-red-500/50
                      text-red-400
                      font-black
                      hover:bg-red-500/10
                      transition
                    "
                  >
                    EXIT GAME
                  </button>

                </div>
              )}

            {/* CORRECT ANSWER NEXT BUTTON */}

            {answerSubmitted &&
              answerCorrect && (

                <button
                  onClick={handleNextQuestion}
                  className="
                    w-full
                    mt-6
                    py-4
                    rounded-xl
                    bg-cyan-400
                    text-slate-950
                    font-black
                    text-lg
                    hover:bg-cyan-300
                    transition
                  "
                >
                  {currentQuestion ===
                  questions.length - 1
                    ? "SEE RESULTS →"
                    : "NEXT LEVEL →"}
                </button>

              )}

          </div>

          {/* SCORE */}

          <div className="mt-6 text-center">

            <p className="text-slate-400 text-sm">
              CURRENT SCORE
            </p>

            <p className="text-2xl font-black text-cyan-400">
              {score} / 5
            </p>

          </div>

        </div>

        {/* RANK REVEAL */}

        {showRankReveal &&
          latestRank && (

            <div className="
              fixed
              inset-0
              z-50
              flex
              items-center
              justify-center
              bg-black/80
              backdrop-blur-md
              px-6
            ">

              <div className="
                w-full
                max-w-md
                text-center
                bg-slate-900
                border
                border-cyan-400/40
                rounded-3xl
                p-8
                shadow-2xl
                shadow-cyan-400/20
              ">

                <p className="
                  text-sm
                  font-black
                  tracking-widest
                  text-cyan-400
                ">
                  RANK UNLOCKED
                </p>

                <div className="
                  mt-5
                  text-8xl
                ">
                  {latestRank.medal}
                </div>

                <p className="
                  mt-5
                  text-sm
                  font-bold
                  text-slate-400
                ">
                  {latestRank.medalName} MEDAL
                </p>

                <h2 className={`
                  mt-2
                  text-4xl
                  font-black
                  ${latestRank.color}
                `}>
                  {latestRank.character}
                </h2>

                <p className="
                  mt-3
                  text-xl
                  font-black
                  text-white
                ">
                  {latestRank.title}
                </p>

                <p className="
                  mt-4
                  text-slate-300
                ">
                  {latestRank.description}
                </p>

                <button
                  onClick={() =>
                    setShowRankReveal(false)
                  }
                  className="
                    mt-7
                    w-full
                    py-4
                    rounded-xl
                    bg-cyan-400
                    text-slate-950
                    font-black
                    hover:bg-cyan-300
                    transition
                  "
                >
                  CONTINUE →
                </button>

              </div>

            </div>
          )}

      </div>
    );
  }

  // =========================================================
  // RESULTS
  // =========================================================

  if (screen === "results") {

    const champion = score >= 4;

    const finalRank =
      score > 0
        ? ranks[score - 1]
        : null;

    return (
      <div className="
        min-h-screen
        bg-slate-950
        text-white
        flex
        items-center
        justify-center
        px-6
      ">

        <div className="
          w-full
          max-w-xl
          text-center
        ">

          <div className="
            text-7xl
            mb-6
          ">
            {champion
              ? "🏆"
              : "🛡️"}
          </div>

          <h1 className="
            text-4xl
            md:text-5xl
            font-black
          ">
            {champion
              ? "SCAM SHIELD CHAMPION!"
              : "CHALLENGE COMPLETE"}
          </h1>

          <p className="
            mt-4
            text-xl
            text-slate-300
          ">
            {champion
              ? "Excellent work! You spotted the scam warning signs."
              : "Good attempt! Keep learning how to recognize scams."}
          </p>

          {finalRank && (

            <div className="
              mt-8
              p-6
              rounded-3xl
              bg-slate-900
              border
              border-cyan-400/30
            ">

              <div className="text-6xl">
                {finalRank.medal}
              </div>

              <p className="
                mt-3
                text-sm
                font-bold
                text-slate-400
              ">
                YOUR RANK
              </p>

              <h2 className={`
                mt-1
                text-3xl
                font-black
                ${finalRank.color}
              `}>
                {finalRank.character}
              </h2>

              <p className="
                mt-2
                text-white
                font-bold
              ">
                {finalRank.title}
              </p>

            </div>

          )}

          <div className="
            mt-8
            bg-slate-900
            border
            border-slate-700
            rounded-3xl
            p-8
          ">

            <p className="
              text-sm
              font-bold
              text-slate-400
            ">
              YOUR FINAL SCORE
            </p>

            <p className="
              mt-3
              text-6xl
              font-black
              text-cyan-400
            ">
              {score}

              <span className="
                text-3xl
                text-slate-500
              ">
                /5
              </span>

            </p>

            <div className="
              mt-8
              h-4
              bg-slate-800
              rounded-full
              overflow-hidden
            ">

              <div
                className="
                  h-full
                  bg-cyan-400
                  transition-all
                  duration-700
                "
                style={{
                  width:
                    `${(score / 5) * 100}%`,
                }}
              />

            </div>

            <p className="
              mt-6
              text-slate-300
            ">
              {champion
                ? "You have earned the Scam Shield Champion badge."
                : "You need 4 or more correct answers to become a Champion."}
            </p>

          </div>

          <button
            onClick={playAgain}
            className="
              mt-8
              px-10
              py-4
              rounded-xl
              bg-cyan-400
              text-slate-950
              font-black
              text-lg
              hover:bg-cyan-300
              transition
            "
          >
            PLAY AGAIN
          </button>

        </div>

      </div>
    );
  }

  return null;
}

export default App;