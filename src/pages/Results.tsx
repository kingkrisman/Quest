import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "motion/react";
import { supabase } from "../lib/supabase";
import { liveErrorMessage } from "../lib/live";
import { actions, uid } from "../lib/store";
import { useAuth } from "../contexts/AuthContext";
import { Avatar, Button, PageSpinner } from "../components/ui";
import { I } from "../components/icons";
import { toast } from "../components/Toaster";
import { celebrate, feedback } from "../lib/feedback";
import { spring, springBouncy } from "../lib/motion";
import { cn, generatePin, shuffle } from "../lib/utils";

interface Participant {
  id: string;
  user_id: string;
  display_name: string | null;
  photo_url: string | null;
  score: number;
}
interface Quiz {
  id: string;
  title: string;
  description?: string | null;
  questions: { text: string; options: string[]; correctOptionIndex: number; points?: number; timeLimit?: number }[];
}

const PODIUM = [
  { place: 2, height: "h-24 sm:h-32", color: "#c7c7cc", delay: 0.45 },
  { place: 1, height: "h-36 sm:h-44", color: "#ffcc00", delay: 0.8 },
  { place: 3, height: "h-16 sm:h-24", color: "#d9905a", delay: 0.15 },
];

export function Results() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [participants, setParticipants] = useState<Participant[] | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [hostId, setHostId] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "same" | "scramble">(null);
  const [saved, setSaved] = useState(false);
  const celebrated = useRef(false);

  useEffect(() => {
    if (!sessionId) return;
    (async () => {
      const [{ data: ps }, { data: session }] = await Promise.all([
        supabase.from("participants").select("*").eq("session_id", sessionId).order("score", { ascending: false }),
        supabase.from("sessions").select("quiz_id,host_id").eq("id", sessionId).single(),
      ]);
      setParticipants((ps as Participant[]) || []);
      if (session) {
        setHostId(session.host_id);
        const { data: q } = await supabase.from("quizzes").select("*").eq("id", session.quiz_id).single();
        setQuiz(q as Quiz);
      }
    })();
  }, [sessionId]);

  useEffect(() => {
    if (!participants || celebrated.current || participants.length === 0) return;
    celebrated.current = true;
    const myPlace = participants.findIndex((p) => p.user_id === user.id);
    const t = setTimeout(() => {
      feedback("complete");
      celebrate();
    }, 1200);
    // Placement XP once per game, even across refreshes.
    const rewardKey = `kawe:rewarded:${sessionId}`;
    if (myPlace >= 0 && !localStorage.getItem(rewardKey)) {
      localStorage.setItem(rewardKey, "1");
      actions.addXp(myPlace < 3 ? [50, 30, 20][myPlace] : 10);
    }
    return () => clearTimeout(t);
  }, [participants, user.id, sessionId]);

  const playAgain = async (scramble: boolean) => {
    if (!quiz) return;
    setBusy(scramble ? "scramble" : "same");
    try {
      let quizId = quiz.id;
      if (scramble) {
        const questions = shuffle(quiz.questions).map((q, i) => {
          const order = shuffle(q.options.map((_, k) => k));
          return { ...q, id: String(i + 1), options: order.map((k) => q.options[k]), correctOptionIndex: order.indexOf(q.correctOptionIndex) };
        });
        const { data, error } = await supabase.from("quizzes").insert({ creator_id: user.id, title: quiz.title, description: quiz.description ?? null, questions }).select("id").single();
        if (error) throw error;
        quizId = data.id;
      }
      const { data: session, error } = await supabase.from("sessions").insert({ quiz_id: quizId, host_id: user.id, pin: generatePin(), status: "lobby", current_question_index: -1 }).select("id").single();
      if (error) throw error;
      navigate(`/lobby/${session.id}`);
    } catch (err) {
      toast.error("Couldn't start a new game", { description: liveErrorMessage(err) });
      setBusy(null);
    }
  };

  const saveToLibrary = () => {
    if (!quiz) return;
    const deck = actions.createDeck({
      title: quiz.title,
      description: quiz.description ?? "",
      icon: "rocket",
      items: quiz.questions.map((q) => ({ id: uid(), prompt: q.text, answer: q.options[q.correctOptionIndex], options: q.options, correctIndex: q.correctOptionIndex })),
    });
    setSaved(true);
    toast.success("Saved to Library", { action: { label: "Study", onClick: () => navigate(`/deck/${deck.id}`) } });
  };

  if (!participants) return <PageSpinner />;

  const top = [participants[1], participants[0], participants[2]];
  const rest = participants.slice(3);
  const isHost = hostId === user.id;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-8 pt-10 sm:pt-14 pb-12">
      <div className="text-center">
        <h1 className="t-large text-ink">Final standings</h1>
        <p className="t-subhead text-ink-2 mt-1.5">{quiz?.title ?? "Live game"}</p>
      </div>

      <div className="flex items-end justify-center gap-2 sm:gap-3 mt-12">
        {PODIUM.map((slot, i) => {
          const p = top[i];
          if (!p) return <div key={slot.place} className="w-24 sm:w-32" />;
          return (
            <div key={p.id} className="flex flex-col items-center w-24 sm:w-32">
              <motion.div initial={{ opacity: 0, y: 16, scale: 0.8 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ ...springBouncy, delay: slot.delay + 0.3 }} className="flex flex-col items-center mb-3">
                <div className="relative">
                  {slot.place === 1 && <I.crown className="absolute -top-7 left-1/2 -translate-x-1/2 w-7 h-7 text-yellow" />}
                  <Avatar name={p.display_name || "Player"} value={p.photo_url} size={slot.place === 1 ? 72 : 56} />
                </div>
                <p className="t-subhead font-semibold text-ink mt-2 text-center line-clamp-1">{p.display_name || "Player"}</p>
                <p className="t-footnote font-semibold text-ink-2 tabular-nums">{p.score.toLocaleString()}</p>
              </motion.div>
              <motion.div
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ ...spring, duration: 0.7, delay: slot.delay }}
                style={{ transformOrigin: "bottom", background: `linear-gradient(180deg, color-mix(in srgb, ${slot.color} 80%, white), ${slot.color})` }}
                className={cn("w-full rounded-t-2xl grid place-items-start justify-center pt-3 text-white t-title1", slot.height)}
              >
                {slot.place}
              </motion.div>
            </div>
          );
        })}
      </div>

      {rest.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 1.3 }} className="grouped mt-8">
          {rest.map((p, i) => (
            <div key={p.id} className={cn("flex items-center gap-3 px-4 h-12", p.user_id === user.id && "bg-accent/8")}>
              <span className="w-5 t-footnote font-semibold text-ink-2 tabular-nums">{i + 4}</span>
              <Avatar name={p.display_name || "Player"} value={p.photo_url} size={28} />
              <span className="flex-1 t-subhead text-ink truncate">{p.display_name || "Player"}</span>
              <span className="t-subhead font-semibold text-ink tabular-nums">{p.score.toLocaleString()}</span>
            </div>
          ))}
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }} className="flex flex-wrap justify-center gap-2.5 mt-10">
        {isHost && (
          <>
            <Button icon={I.restart} onClick={() => playAgain(false)} loading={busy === "same"} disabled={!!busy}>
              Play Again
            </Button>
            <Button variant="gray" icon={I.shuffle} onClick={() => playAgain(true)} loading={busy === "scramble"} disabled={!!busy}>
              Shuffle & Replay
            </Button>
          </>
        )}
        {quiz && (
          <Button variant="gray" icon={saved ? I.check : I.bookmark} onClick={saveToLibrary} disabled={saved}>
            {saved ? "Saved" : "Save to Library"}
          </Button>
        )}
        <Button variant="plain" onClick={() => navigate("/")}>
          Done
        </Button>
      </motion.div>
    </div>
  );
}
