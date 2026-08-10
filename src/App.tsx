import { useEffect, useRef, useState } from "react";

import { createBrief, getNextQuestion, getProviderConfig } from "./api.ts";
import {
  SKIPPED_ANSWER,
  type Brief,
  type ProviderConfig,
  type QaItem,
} from "./contracts.ts";
import {
  EMERGENCY_NOTICE,
  MODEL_ALERT_LIMITATION,
  WORRY_QUESTION,
  hasAskedWorryQuestion,
} from "./safety.ts";

type Screen = "welcome" | "interview" | "thinking" | "review" | "building" | "brief" | "urgent";
type CurrentQuestion = Pick<QaItem, "question" | "phaseLabel" | "isWorry">;

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`card ${className}`.trim()}>{children}</section>;
}

function EmergencyNotice() {
  return (
    <aside className="emergency-notice" aria-label="Emergency information">
      <strong>Need help now?</strong> {EMERGENCY_NOTICE}
    </aside>
  );
}

function PrivacyNotice({ config }: { config: ProviderConfig | null }) {
  if (!config) return <p className="privacy-note">Checking this installation's data route…</p>;
  if (config.provider === "mock") {
    return <p className="privacy-note">Demo mode: no external model receives your answers and no API charges are created.</p>;
  }
  return (
    <p className="privacy-note">
      External-model mode: answers are sent to this installation's configured Anthropic API account.
      This application does not write them to a database, but the operator and provider's retention terms still apply.
    </p>
  );
}

function BriefSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="brief-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("welcome");
  const [config, setConfig] = useState<ProviderConfig | null>(null);
  const [answers, setAnswers] = useState<QaItem[]>([]);
  const [current, setCurrent] = useState<CurrentQuestion | null>(null);
  const [answer, setAnswer] = useState("");
  const [brief, setBrief] = useState<Brief | null>(null);
  const [error, setError] = useState("");
  const [urgentReason, setUrgentReason] = useState("");
  const [copied, setCopied] = useState(false);
  const busy = useRef(false);
  const answerRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    void getProviderConfig().then(setConfig).catch((value: unknown) => setError(errorText(value)));
  }, []);

  useEffect(() => {
    if (screen === "interview") answerRef.current?.focus();
  }, [screen, current]);

  const showQuestion = (question: CurrentQuestion) => {
    setCurrent(question);
    setAnswer("");
    setScreen("interview");
  };

  const moveToReview = (source: QaItem[]) => {
    if (!hasAskedWorryQuestion(source)) {
      showQuestion({ question: WORRY_QUESTION, phaseLabel: "The worry", isWorry: true });
      return;
    }
    setAnswers(source);
    setCurrent(null);
    setScreen("review");
  };

  const start = async () => {
    if (busy.current || !config) return;
    busy.current = true;
    setError("");
    setScreen("thinking");
    try {
      const reply = await getNextQuestion([]);
      if (reply.urgent) {
        setUrgentReason(reply.urgentReason);
        setScreen("urgent");
      } else if (reply.done) {
        throw new Error("The interviewer ended before asking a question.");
      } else {
        showQuestion({ question: reply.question, phaseLabel: reply.phaseLabel || "Your story", isWorry: false });
      }
    } catch (value) {
      setError(errorText(value));
      setScreen("welcome");
    } finally {
      busy.current = false;
    }
  };

  const submit = async (skip: boolean) => {
    if (busy.current || !current) return;
    const submitted = skip ? SKIPPED_ANSWER : answer.trim();
    if (!submitted) return;
    const nextAnswers = [...answers, { ...current, answer: submitted }];
    setAnswers(nextAnswers);
    setError("");

    if (current.isWorry && nextAnswers.length >= 3) {
      moveToReview(nextAnswers);
      return;
    }
    if (nextAnswers.length >= 11 && !hasAskedWorryQuestion(nextAnswers)) {
      showQuestion({ question: WORRY_QUESTION, phaseLabel: "The worry", isWorry: true });
      return;
    }

    busy.current = true;
    setScreen("thinking");
    try {
      const reply = await getNextQuestion(nextAnswers);
      if (reply.urgent) {
        setUrgentReason(reply.urgentReason);
        setScreen("urgent");
      } else if (reply.done || nextAnswers.length >= 12) {
        moveToReview(nextAnswers);
      } else {
        showQuestion({ question: reply.question, phaseLabel: reply.phaseLabel || "Your story", isWorry: false });
      }
    } catch (value) {
      setAnswers(answers);
      setError(errorText(value));
      setScreen("interview");
    } finally {
      busy.current = false;
    }
  };

  const finishInterview = () => {
    if (answer.trim()) {
      setError("Submit or skip the answer currently in the box before reviewing your notes.");
      return;
    }
    moveToReview(answers);
  };

  const updateReviewedAnswer = (index: number, value: string) => {
    setAnswers((currentAnswers) =>
      currentAnswers.map((item, itemIndex) => itemIndex === index ? { ...item, answer: value } : item),
    );
  };

  const buildBrief = async () => {
    if (busy.current || answers.length < 3 || answers.some((item) => !item.answer.trim())) return;
    busy.current = true;
    setError("");
    setScreen("building");
    try {
      setBrief(await createBrief(answers));
      setScreen("brief");
    } catch (value) {
      setError(errorText(value));
      setScreen("review");
    } finally {
      busy.current = false;
    }
  };

  const copyBrief = async () => {
    if (!brief) return;
    const sections = [
      brief.topOfMind && `SAY THIS FIRST — what I am most worried about:\n${brief.topOfMind}`,
      `WHY I AM HERE:\n${brief.mainConcern}`,
      brief.timeline.length > 0 && `TIMELINE:\n${brief.timeline.map((item) => `• ${item}`).join("\n")}`,
      brief.symptoms.length > 0 && `WHAT I EXPERIENCE:\n${brief.symptoms.map((item) => `• ${item}`).join("\n")}`,
      brief.impact && `HOW IT AFFECTS MY LIFE:\n${brief.impact}`,
      brief.whatChanged && `WHAT HAS CHANGED:\n${brief.whatChanged}`,
      brief.triedAlready.length > 0 && `WHAT I HAVE TRIED:\n${brief.triedAlready.map((item) => `• ${item}`).join("\n")}`,
      brief.medications && `MEDICINES OR CONDITIONS I MENTIONED:\n${brief.medications}`,
      brief.questionsForDoctor.length > 0 && `QUESTIONS:\n${brief.questionsForDoctor.map((item) => `• ${item}`).join("\n")}`,
      brief.inTheirWords.length > 0 && `MY EXACT WORDS:\n${brief.inTheirWords.map((item) => `• “${item}”`).join("\n")}`,
    ].filter(Boolean);
    try {
      await navigator.clipboard.writeText(sections.join("\n\n"));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      setError("Copy did not work on this device. Press and hold the brief text to select it instead.");
    }
  };

  const reset = () => {
    setScreen("welcome");
    setAnswers([]);
    setCurrent(null);
    setAnswer("");
    setBrief(null);
    setError("");
    setUrgentReason("");
    setCopied(false);
    busy.current = false;
  };

  return (
    <main className="app-shell">
      <header className="masthead">
        <p className="eyebrow">Appointment preparation prototype</p>
        <h1>Doorknob</h1>
        <p>Say the important thing first—not at the door on your way out.</p>
      </header>

      <EmergencyNotice />

      {screen === "welcome" && (
        <>
          <Card>
            <h2>Prepare your own words</h2>
            <p>Doorknob asks a few plain-English questions, then organises your answers into a draft you can review, copy, or read during an appointment.</p>
            <p>It does not diagnose, recommend treatment, or decide whether it is safe to wait for an appointment.</p>
          </Card>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="button primary" onClick={() => void start()} disabled={!config}>Continue—this is appointment preparation</button>
          <button className="button danger-outline" onClick={() => { setUrgentReason(""); setScreen("urgent"); }}>I may need urgent help or I am not sure</button>
          <PrivacyNotice config={config} />
          <p className="limitation">{MODEL_ALERT_LIMITATION}</p>
        </>
      )}

      {screen === "interview" && current && (
        <>
          <p className="phase">{current.phaseLabel} · question {answers.length + 1}</p>
          <Card><p className="question">{current.question}</p></Card>
          <label className="field-label" htmlFor="answer">Your answer</label>
          <textarea id="answer" ref={answerRef} value={answer} onChange={(event) => setAnswer(event.target.value)} maxLength={5_000} rows={5} />
          {error && <p className="error" role="alert">{error}</p>}
          <button className="button primary" onClick={() => void submit(false)} disabled={!answer.trim()}>That is my answer</button>
          <div className="button-row">
            <button className="button secondary" onClick={() => void submit(true)}>Skip this one</button>
            {answers.length >= 3 && <button className="button secondary" onClick={finishInterview}>Review my answers</button>}
          </div>
          <p className="limitation">Doorknob cannot reliably recognise an emergency. Use the emergency information above whenever you are concerned.</p>
        </>
      )}

      {(screen === "thinking" || screen === "building") && (
        <div className="status" role="status" aria-live="polite" aria-busy="true">
          <span aria-hidden="true">{screen === "building" ? "📝" : "💬"}</span>
          <h2>{screen === "building" ? "Creating a draft…" : "Preparing the next question…"}</h2>
          <p>Your answers remain on this page if the request fails.</p>
        </div>
      )}

      {screen === "review" && (
        <>
          <Card>
            <h2>Review your words before anything is generated</h2>
            <p>Edit anything that is inaccurate. Doorknob will organise this material, but you remain the authority on what happened and what matters.</p>
          </Card>
          <div className="review-list">
            {answers.map((item, index) => (
              <label className="review-item" key={`${item.phaseLabel}-${index}`}>
                <span>{index + 1}. {item.question}</span>
                <textarea value={item.answer} onChange={(event) => updateReviewedAnswer(index, event.target.value)} maxLength={5_000} rows={3} />
              </label>
            ))}
          </div>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="button primary" onClick={() => void buildBrief()}>Create my draft brief</button>
          <button className="button secondary" onClick={reset}>Discard these answers</button>
          <PrivacyNotice config={config} />
        </>
      )}

      {screen === "urgent" && (
        <>
          <section className="urgent-panel" role="alert">
            <h2>Please seek human help now</h2>
            {urgentReason && <p>{urgentReason}</p>}
            <p><strong>Call 999</strong> for a life-threatening emergency or if somebody has tried to end their life.</p>
            <p><strong>Use NHS 111</strong> if you need urgent medical help but are not sure what to do.</p>
            <p>For emotional support, Samaritans can be reached free on <strong>116 123</strong>. They are not an emergency service.</p>
          </section>
          <p className="limitation">Doorknob may be overcautious or may miss danger. It cannot clear you to wait for an appointment.</p>
          <button className="button secondary" onClick={reset}>Return to the start</button>
        </>
      )}

      {screen === "brief" && brief && (
        <>
          <Card className="draft-warning">
            <h2>Draft—check before using</h2>
            <p>This is an AI-organised version of your answers, not a medical record or clinical assessment. Correct anything that does not represent you.</p>
          </Card>
          {brief.topOfMind && <section className="top-of-mind"><h2>Say this first</h2><p>{brief.topOfMind}</p></section>}
          <Card>
            <BriefSection title="Why I am here"><p>{brief.mainConcern}</p></BriefSection>
            {brief.timeline.length > 0 && <BriefSection title="Timeline"><ul>{brief.timeline.map((item) => <li key={item}>{item}</li>)}</ul></BriefSection>}
            {brief.symptoms.length > 0 && <BriefSection title="What I experience"><ul>{brief.symptoms.map((item) => <li key={item}>{item}</li>)}</ul></BriefSection>}
            {brief.impact && <BriefSection title="How it affects my life"><p>{brief.impact}</p></BriefSection>}
            {brief.whatChanged && <BriefSection title="What has changed"><p>{brief.whatChanged}</p></BriefSection>}
            {brief.triedAlready.length > 0 && <BriefSection title="What I have tried"><ul>{brief.triedAlready.map((item) => <li key={item}>{item}</li>)}</ul></BriefSection>}
            {brief.medications && <BriefSection title="Medicines or conditions I mentioned"><p>{brief.medications}</p></BriefSection>}
            {brief.questionsForDoctor.length > 0 && <BriefSection title="Questions I want answered"><ol>{brief.questionsForDoctor.map((item) => <li key={item}>{item}</li>)}</ol></BriefSection>}
            {brief.inTheirWords.length > 0 && <BriefSection title="My exact words">{brief.inTheirWords.map((item) => <blockquote key={item}>“{item}”</blockquote>)}</BriefSection>}
          </Card>
          {brief.quoteWarning && <p className="warning" role="status">One or more suggested quotations were omitted because they did not appear exactly in your answers.</p>}
          {error && <p className="error" role="alert">{error}</p>}
          <button className="button primary" onClick={() => void copyBrief()}>{copied ? "✓ Copied" : "Copy my checked brief"}</button>
          <button className="button secondary" onClick={() => setScreen("review")}>Edit my answers and rebuild</button>
          <button className="button secondary" onClick={reset}>Prepare another appointment</button>
        </>
      )}
    </main>
  );
}
