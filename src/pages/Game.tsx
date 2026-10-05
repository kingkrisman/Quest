import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { supabase } from "../lib/supabase";
import { liveErrorMessage } from "../lib/live";
import { useAuth } from "../contexts/AuthContext";
import { Avatar, Button, PageSpinner } from "../components/ui";
import { I } from "../components/icons";
import { toast } from "../components/Toaster";
import { feedback } from "../lib/feedback";
import { spring, springBouncy } from "../lib/motion";
import { cn } from "../lib/utils";

interface Question {
  id: string;
  text: string;
  options: string[];
  correctOptionIndex: number;
  points?: number;
  timeLimit?: number;
}
interface Session {
  id: string;
  host_id: string;
  quiz_id: string;
  status: string;
  current_question_index: number;
  question_start_time: string | null;
}
interface Participant {
  id: string;
  user_id: string;
  display_name: string | null;
  photo_url: string | null;
  score: number;
}
interface Response {
  participant_id: string;
  question_index: number;
  answer_index: number;
  is_correct: boolean;
  points_earned: number;
}

const TILES = [
  { color: "var(--sys-red)", icon: I.triangle },
  { color: "var(--sys-blue)", icon: I.diamond },
  { color: "var(--sys-orange)", icon: I.circle },
  { color: "var(--sys-green)", icon: I.square },
];

/** Postgres `timestamp` (no tz) drops the zone; the app always writes UTC. */
const parseTs = (s: string | null) => (s ? new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : s + "Z").getTime() : Date.now());

/** Only this label re-renders each second. */
function Seconds({ endsAt, stopped }: { endsAt: number; stopped: boolean }) {
  const [left, setLeft] = useState(() => Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
  useEffect(() => {
    if (stopped) return;
    const tick = () => setLeft(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 500);
    return () => clearInterval(t);
  }, [endsAt, stopped]);
  return <span className={cn("t-subhead font-semibold tabular-nums w-7 text-right", left <= 5 && !stopped ? "text-red" : "text-ink-2")}>{left}</span>;
}

function Rankings({ participants, me }: { participants: Participant[]; me: string }) {
  return (
    <div className="grouped">
      <AnimatePresence initial={false}>
        {participants.map((p, i) => (
          <motion.div key={p.id} layout transition={spring} className={cn("flex items-center gap-3 px-3.5 h-12", p.user_id === me && "bg-accent/8")}>
            <span className="w-5 text-center t-footnote font-semibold text-ink-2 tabular-nums">{i === 0 ? <I.crown className="w-4 h-4 text-yellow mx-auto" /> : i + 1}</span>
            <Avatar name={p.display_name || "Player"} value={p.photo_url} size={28} />
            <span className="flex-1 min-w-0 truncate t-subhead text-ink">
              {p.display_name || "Player"}
              {p.user_id === me && <span className="t-caption font-semibold text-accent ml-1.5">You</span>}
            </span>
            <span className="t-subhead font-semibold tabular-nums text-ink">{p.score.toLocaleString()}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function Game() {
  const { sessionId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [session, setSession] = useState<Session | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [responses, setResponses] = useState<Response[]>([]);
  const [myAnswer, setMyAnswer] = useState<{ q: number; index: number; correct: boolean; points: number } | null>(null);
  const [timeUp, setTimeUp] = useState<number | null>(null);
  const [revealed, setRevealed] = useState<number | null>(null);
  const [showSheet, setShowSheet] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const submitting = useRef(false);

  const loadParticipants = useCallback(async () => {
    const { data } = await supabase.from("participants").select("*").eq("session_id", sessionId).order("score", { ascending: false });
    setParticipants((data as Participant[]) || []);
  }, [sessionId]);

  const loadResponses = useCallback(async () => {
    const { data } = await supabase.from("responses").select("participant_id,question_index,answer_index,is_correct,points_earned").eq("session_id", sessionId);
    setResponses((data as Response[]) || []);
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from("sessions").select("*").eq("id", sessionId).single();
      if (cancelled) return;
      if (error || !data) {
        toast.error("That game no longer exists");
        navigate("/");
        return;
      }
      if (data.status === "finished") return navigate(`/results/${sessionId}`, { replace: true });
      setSession(data);
      const { data: quiz } = await supabase.from("quizzes").select("questions").eq("id", data.quiz_id).single();
      if (!cancelled) setQuestions((quiz?.questions as Question[]) || []);
    })();
    loadParticipants();
    loadResponses();

    const channel = supabase
      .channel(`game:${sessionId}:${user.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "sessions", filter: `id=eq.${sessionId}` }, (payload) => {
        const data = payload.new as Session;
        if (data.status === "finished") navigate(`/results/${sessionId}`);
        else setSession(data);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "participants", filter: `session_id=eq.${sessionId}` }, loadParticipants)
      .on("postgres_changes", { event: "*", schema: "public", table: "responses", filter: `session_id=eq.${sessionId}` }, loadResponses)
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [sessionId, user.id, navigate, loadParticipants, loadResponses]);

  const qIndex = session?.current_question_index ?? -1;
  const question = questions[qIndex];
  const limit = question?.timeLimit ?? 20;
  const startedAt = parseTs(session?.question_start_time ?? null);
  const endsAt = startedAt + limit * 1000;

  // One timeout per question marks time-up; no render loop.
  useEffect(() => {
    if (!question) return;
    const ms = endsAt - Date.now();
    if (ms <= 0) return setTimeUp(qIndex);
    const t = setTimeout(() => setTimeUp(qIndex), ms);
    return () => clearTimeout(t);
  }, [question, endsAt, qIndex]);

  const answersThisQ = useMemo(() => responses.filter((r) => r.question_index === qIndex), [responses, qIndex]);
  const everyoneAnswered = participants.length > 0 && answersThisQ.length >= participants.length;
  const isRevealed = revealed === qIndex || timeUp === qIndex || everyoneAnswered;
  const isHost = session?.host_id === user.id;

  useEffect(() => {
    const mine = responses.find((r) => r.participant_id === user.id && r.question_index === qIndex);
    if (mine) setMyAnswer({ q: qIndex, index: mine.answer_index, correct: mine.is_correct, points: mine.points_earned });
    else setMyAnswer((m) => (m?.q === qIndex ? m : null));
  }, [responses, qIndex, user.id]);

  const revealedFor = useRef(-1);
  useEffect(() => {
    if (isRevealed && question && revealedFor.current !== qIndex) {
      revealedFor.current = qIndex;
      if (myAnswer?.q === qIndex) feedback(myAnswer.correct ? "correct" : "wrong");
    }
  }, [isRevealed, question, qIndex, myAnswer]);

  const answer = async (index: number) => {
    if (!question || myAnswer?.q === qIndex || isRevealed || submitting.current) return;
    submitting.current = true;
    const correct = index === question.correctOptionIndex;
    // Faster answers earn more: full points instantly, half at the buzzer.
    const elapsed = Math.min(1, (Date.now() - startedAt) / 1000 / limit);
    const points = correct ? Math.round((question.points ?? 1000) * (1 - elapsed / 2)) : 0;
    setMyAnswer({ q: qIndex, index, correct, points });
    feedback("tap");
    try {
      const { error } = await supabase.from("responses").insert({ session_id: sessionId, participant_id: user.id, question_index: qIndex, answer_index: index, is_correct: correct, points_earned: points });
      if (error) throw error;
      const { data: current } = await supabase.from("participants").select("score").eq("user_id", user.id).eq("session_id", sessionId).single();
      await supabase.from("participants").update({ score: (current?.score ?? 0) + points, last_answer_correct: correct }).eq("user_id", user.id).eq("session_id", sessionId);
    } catch (err) {
      toast.error("Your answer didn't go through", { description: liveErrorMessage(err) });
      setMyAnswer(null);
    } finally {
      submitting.current = false;
    }
  };

  const next = async () => {
    if (!session) return;
    setAdvancing(true);
    const isLast = qIndex >= questions.length - 1;
    const { error } = await supabase.from("sessions").update(isLast ? { status: "finished" } : { current_question_index: qIndex + 1, question_start_time: new Date().toISOString() }).eq("id", session.id);
    if (error) toast.error("Couldn't advance the game", { description: liveErrorMessage(error) });
    setAdvancing(false);
  };

  if (!session || !question) return <PageSpinner />;

  const counts = question.options.map((_, i) => answersThisQ.filter((r) => r.answer_index === i).length);
  const maxCount = Math.max(1, ...counts);
  const myRank = participants.findIndex((p) => p.user_id === user.id) + 1;
  const remainingMs = Math.max(0, endsAt - Date.now());

  return (
    <div className="min-h-dvh flex flex-col">
      <div className="sticky top-0 z-40 bg-bg">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <span className="t-subhead font-semibold text-ink tabular-nums">
            {qIndex + 1}
            <span className="text-ink-2"> of {questions.length}</span>
          </span>
          <div className="flex-1 h-1.5 rounded-full bg-fill overflow-hidden">
            <div
              key={`${qIndex}-${startedAt}`}
              className="h-full w-full rounded-full bg-accent origin-left"
              style={{ ["--from" as string]: remainingMs / (limit * 1000), animation: `countdown ${remainingMs}ms linear forwards`, animationPlayState: isRevealed ? "paused" : "running" }}
            />
          </div>
          <Seconds endsAt={endsAt} stopped={isRevealed} />
          <span className="hidden sm:flex items-center gap-1 t-subhead text-ink-2 tabular-nums">
            <I.users className="w-4 h-4" />
            {answersThisQ.length}/{participants.length}
          </span>
          <button onClick={() => setShowSheet(true)} className="lg:hidden press w-8 h-8 grid place-items-center rounded-full bg-fill text-accent" aria-label="Show rankings">
            <I.medal className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-10 grid lg:grid-cols-[1fr_300px] gap-8">
        <div className="flex flex-col">
          <AnimatePresence mode="wait">
            <motion.div key={qIndex} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8, transition: { duration: 0.14 } }} transition={spring}>
              <h1 className="t-title1 sm:text-[34px] text-ink text-center max-w-3xl mx-auto">{question.text}</h1>
              <div className="grid sm:grid-cols-2 gap-2.5 mt-8 sm:mt-10">
                {question.options.map((opt, i) => {
                  const tile = TILES[i % 4];
                  const mine = myAnswer?.q === qIndex && myAnswer.index === i;
                  const isCorrect = i === question.correctOptionIndex;
                  const dim = (isRevealed && !isCorrect) || (!isRevealed && myAnswer?.q === qIndex && !mine);
                  return (
                    <button
                      key={i}
                      onClick={() => answer(i)}
                      disabled={myAnswer?.q === qIndex || isRevealed}
                      className={cn("press relative overflow-hidden text-left rounded-[4px] p-4 sm:p-5 min-h-20 flex items-center gap-3.5 text-white t-headline transition-opacity duration-300", dim && "opacity-35", mine && !isRevealed && "ring-4 ring-offset-2 ring-offset-bg")}
                      style={{ background: tile.color, ["--tw-ring-color" as string]: tile.color }}
                    >
                      <tile.icon className="w-6 h-6 opacity-80 shrink-0" />
                      <span className="flex-1">{opt}</span>
                      {isRevealed && isCorrect && (
                        <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={springBouncy} className="w-8 h-8 rounded-full bg-white/25 grid place-items-center">
                          <I.check className="w-4 h-4" />
                        </motion.span>
                      )}
                      {isRevealed && mine && !isCorrect && (
                        <span className="w-8 h-8 rounded-full bg-white/25 grid place-items-center">
                          <I.x className="w-4 h-4" />
                        </span>
                      )}
                      {isRevealed && (
                        <>
                          <span className="absolute bottom-0 left-0 h-1 w-full bg-white/50 origin-left transition-transform duration-700 ease-out" style={{ transform: `scaleX(${counts[i] / maxCount})` }} />
                          <span className="absolute top-2 right-3 t-caption font-bold opacity-80">{counts[i]}</span>
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="mt-8 min-h-24 flex flex-col items-center gap-4">
            <AnimatePresence mode="wait">
              {isRevealed && myAnswer?.q === qIndex ? (
                <motion.div key="res" initial={{ opacity: 0, y: 12, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} transition={springBouncy} className={cn("flex items-center gap-3 pl-3 pr-5 h-14 rounded-full", myAnswer.correct ? "bg-green/12" : "bg-red/10")}>
                  {myAnswer.correct ? <I.success className="w-7 h-7 text-green" /> : <I.error className="w-7 h-7 text-red" />}
                  <div className="text-left">
                    <p className={cn("t-headline", myAnswer.correct ? "text-green" : "text-red")}>{myAnswer.correct ? `Correct · +${myAnswer.points}` : "Not this time"}</p>
                    {myRank > 0 && (
                      <p className="t-footnote text-ink-2">
                        You're #{myRank} of {participants.length}
                      </p>
                    )}
                  </div>
                </motion.div>
              ) : isRevealed ? (
                <motion.p key="missed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="t-headline text-ink-2">
                  {timeUp === qIndex ? "Time's up" : "Everyone has answered"}
                </motion.p>
              ) : myAnswer?.q === qIndex ? (
                <motion.p key="locked" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="t-headline text-ink-2">
                  Answer locked in
                </motion.p>
              ) : null}
            </AnimatePresence>

            {isHost &&
              (isRevealed ? (
                <Button size="lg" onClick={next} loading={advancing} icon={I.arrow}>
                  {qIndex >= questions.length - 1 ? "Show Results" : "Next Question"}
                </Button>
              ) : (
                <Button variant="gray" icon={I.eye} onClick={() => setRevealed(qIndex)}>
                  Reveal Answer
                </Button>
              ))}
          </div>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-20">
            <p className="flex items-center gap-1.5 t-footnote font-medium text-ink-2 px-1 mb-2">
              <I.medal className="w-4 h-4" /> Leaderboard
            </p>
            <Rankings participants={participants} me={user.id} />
          </div>
        </aside>
      </div>

      <AnimatePresence>
        {showSheet && (
          <>
            <motion.div className="fixed inset-0 bg-black/35 z-50 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowSheet(false)} />
            <motion.div
              className="fixed bottom-0 inset-x-0 z-50 lg:hidden bg-bg rounded-t-[4px] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] max-h-[75vh] overflow-y-auto"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", duration: 0.4, bounce: 0.1 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0.05, bottom: 0.8 }}
              onDragEnd={(_, info) => (info.offset.y > 80 || info.velocity.y > 400) && setShowSheet(false)}
            >
              <div className="w-9 h-1.25 rounded-full bg-fill-2 mx-auto mb-4" />
              <p className="t-headline text-ink mb-3 px-1">Leaderboard</p>
              <Rankings participants={participants} me={user.id} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
