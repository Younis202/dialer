"use client";
import { cn } from "@/lib/utils";

const KEYS: Array<{ digit: string; letters?: string }> = [
  { digit: "1", letters: "" },
  { digit: "2", letters: "abc" },
  { digit: "3", letters: "def" },
  { digit: "4", letters: "ghi" },
  { digit: "5", letters: "jkl" },
  { digit: "6", letters: "mno" },
  { digit: "7", letters: "pqrs" },
  { digit: "8", letters: "tuv" },
  { digit: "9", letters: "wxyz" },
  { digit: "*", letters: "" },
  { digit: "0", letters: "+" },
  { digit: "#", letters: "" },
];

const TONES: Record<string, [number, number]> = {
  "1": [697, 1209], "2": [697, 1336], "3": [697, 1477],
  "4": [770, 1209], "5": [770, 1336], "6": [770, 1477],
  "7": [852, 1209], "8": [852, 1336], "9": [852, 1477],
  "*": [941, 1209], "0": [941, 1336], "#": [941, 1477],
};

let audioCtx: AudioContext | null = null;
function playTone(digit: string) {
  if (typeof window === "undefined") return;
  const tone = TONES[digit];
  if (!tone) return;
  if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const ctx = audioCtx!;
  const dur = 0.12;
  const [f1, f2] = tone;
  const make = (freq: number) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.005);
    gain.gain.setValueAtTime(0.08, ctx.currentTime + dur - 0.02);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + dur);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  };
  make(f1);
  make(f2);
}

export function Keypad({ onPress, disabled }: { onPress: (d: string) => void; disabled?: boolean }) {
  const handle = (digit: string) => {
    if (disabled) return;
    playTone(digit);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(8);
    onPress(digit);
  };

  return (
    <div className="grid grid-cols-3 gap-2.5 max-w-[340px] mx-auto w-full">
      {KEYS.map((k) => (
        <button
          key={k.digit}
          type="button"
          className={cn(
            "keypad-key transition-transform active:scale-95",
            disabled && "opacity-40 pointer-events-none"
          )}
          onClick={() => handle(k.digit)}
          aria-label={`Dial ${k.digit}`}
        >
          <span className="leading-none">{k.digit}</span>
          {k.letters && <span className="keypad-letters">{k.letters}</span>}
        </button>
      ))}
    </div>
  );
}
