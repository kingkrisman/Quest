import { useRef, useState } from "react";
import { actions, levelInfo, useStore } from "../lib/store";
import { Avatar, Button, Dialog, Group, PageHeader, Row, Segmented, Switch } from "../components/ui";
import { COLORS, I, colorVar } from "../components/icons";
import { toast } from "../components/Toaster";
import { feedback } from "../lib/feedback";

const GOALS = [
  { xp: 20, label: "Casual" },
  { xp: 50, label: "Regular" },
  { xp: 100, label: "Serious" },
  { xp: 200, label: "Intense" },
];

export function Profile() {
  const { profile, settings, xp } = useStore();
  const [name, setName] = useState(profile.name);
  const [confirmReset, setConfirmReset] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const lvl = levelInfo(xp);

  const saveName = () => {
    const clean = name.trim().slice(0, 32);
    if (!clean) return setName(profile.name);
    if (clean !== profile.name) {
      actions.updateProfile({ name: clean });
      toast.success("Name updated");
    }
  };

  const exportData = () => {
    const url = URL.createObjectURL(new Blob([actions.exportData()], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `kawe-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Backup downloaded");
  };

  const importData = async (file?: File) => {
    if (!file) return;
    try {
      actions.importData(await file.text());
      toast.success("Backup restored");
    } catch (err) {
      toast.error("Couldn't restore that file", { description: err instanceof Error ? err.message : undefined });
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-8 pt-8 sm:pt-12 pb-12">
      <PageHeader title="Settings" />

      <div className="space-y-7">
        {/* Profile card */}
        <div className="grouped">
          <div className="flex flex-col items-center text-center px-4 pt-6 pb-5">
            <Avatar name={name || profile.name} color={profile.color} size={84} />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              aria-label="Display name"
              className="mt-3 w-full max-w-xs text-center t-title2 bg-transparent outline-none rounded-lg focus:bg-fill"
            />
            <p className="t-footnote text-ink-2 mt-0.5">
              Level {lvl.level} · {xp.toLocaleString()} XP · Guest on this device
            </p>
            <div className="flex flex-wrap justify-center gap-2.5 mt-4">
              {COLORS.filter((c) => c !== "gray").map((c) => (
                <button
                  key={c}
                  aria-label={`${c} avatar`}
                  onClick={() => actions.updateProfile({ color: c })}
                  className="press w-7 h-7 rounded-full"
                  style={{ background: colorVar(c), boxShadow: profile.color === c ? `0 0 0 2px var(--c-surface), 0 0 0 4px ${colorVar(c)}` : undefined }}
                />
              ))}
            </div>
          </div>
        </div>

        <Group header="Appearance">
          <Row
            icon={I.monitor}
            color="blue"
            title="Theme"
            trailing={
              <Segmented
                value={settings.theme}
                onChange={(theme) => actions.updateSettings({ theme })}
                options={[
                  { value: "system", label: "Auto" },
                  { value: "light", icon: I.sun, ariaLabel: "Light" },
                  { value: "dark", icon: I.moon, ariaLabel: "Dark" },
                ]}
              />
            }
          />
        </Group>

        <Group header="Sounds & Haptics">
          <Row
            icon={I.sound}
            color="pink"
            title="Sound Effects"
            trailing={
              <Switch
                label="Sound effects"
                checked={settings.sound}
                onChange={(sound) => {
                  actions.updateSettings({ sound });
                  if (sound) setTimeout(() => feedback("correct"), 0);
                }}
              />
            }
          />
          <Row icon={I.haptics} color="gray" title="Haptics" subtitle="On supported phones" trailing={<Switch label="Haptics" checked={settings.haptics} onChange={(haptics) => actions.updateSettings({ haptics })} />} />
        </Group>

        <Group header="Daily Goal" footer="Your Study ring closes when you hit this much XP in a day.">
          {GOALS.map((g) => (
            <Row
              key={g.xp}
              title={g.label}
              subtitle={`${g.xp} XP a day`}
              onClick={() => actions.updateSettings({ dailyGoal: g.xp })}
              trailing={settings.dailyGoal === g.xp ? <I.check className="w-5 h-5 text-accent" /> : undefined}
            />
          ))}
        </Group>

        <Group header="Focus Timer">
          <Row
            icon={I.meditate}
            color="orange"
            title="Focus Length"
            trailing={
              <select value={settings.focusMinutes} onChange={(e) => actions.updateSettings({ focusMinutes: Number(e.target.value) })} aria-label="Focus length" className="bg-transparent t-body text-ink-2 text-right outline-none">
                {[15, 20, 25, 30, 45, 50, 60, 90].map((m) => (
                  <option key={m} value={m}>
                    {m} min
                  </option>
                ))}
              </select>
            }
          />
          <Row
            icon={I.coffee}
            color="green"
            title="Break Length"
            trailing={
              <select value={settings.breakMinutes} onChange={(e) => actions.updateSettings({ breakMinutes: Number(e.target.value) })} aria-label="Break length" className="bg-transparent t-body text-ink-2 text-right outline-none">
                {[3, 5, 10, 15, 20].map((m) => (
                  <option key={m} value={m}>
                    {m} min
                  </option>
                ))}
              </select>
            }
          />
        </Group>

        <Group header="Data" footer="Everything is stored on this device. Download a backup to move it or keep it safe.">
          <Row icon={I.export} color="blue" title="Download Backup" onClick={exportData} />
          <Row icon={I.import} color="indigo" title="Restore Backup" onClick={() => fileRef.current?.click()} />
        </Group>

        <Group>
          <Row title="Reset Everything" destructive onClick={() => setConfirmReset(true)} />
        </Group>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          onChange={(e) => {
            void importData(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>

      <Dialog open={confirmReset} onClose={() => setConfirmReset(false)} title="Reset everything?">
        <p className="t-subhead text-ink-2">This deletes your decks, progress, XP, streaks and awards on this device. Download a backup first if you might want them back.</p>
        <div className="grid grid-cols-2 gap-2 mt-6">
          <Button variant="gray" onClick={() => setConfirmReset(false)}>
            Cancel
          </Button>
          <Button
            color="red"
            onClick={() => {
              actions.resetAll();
              setConfirmReset(false);
              toast.success("Fresh start", { description: "Sample decks restored." });
            }}
          >
            Reset
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
