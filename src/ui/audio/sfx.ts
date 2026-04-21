/**
 * Procedural SFX using Tone.js — no audio files needed.
 * Generates short synthetic sounds for game actions.
 * All sounds are muted until the user interacts (browser autoplay policy).
 */
type ToneModule = typeof import('tone');
type ToneSynth = import('tone').PolySynth;
type ToneNoiseSynth = import('tone').NoiseSynth;
type ToneMetalSynth = import('tone').MetalSynth;

interface AudioRuntime {
  Tone: ToneModule;
  synth: ToneSynth;
  noiseSynth: ToneNoiseSynth;
  metalSynth: ToneMetalSynth;
}

let initialized = false;
let runtimePromise: Promise<AudioRuntime> | null = null;

function silenceToneLogging(): void {
  if (typeof window === 'undefined') return;
  window.TONE_SILENCE_LOGGING = true;
}

async function loadRuntime(): Promise<AudioRuntime> {
  if (runtimePromise) return runtimePromise;

  silenceToneLogging();
  runtimePromise = import('tone')
    .then((Tone) => ({
      Tone,
      synth: new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.005, decay: 0.15, sustain: 0, release: 0.1 },
        volume: -18,
      }).toDestination(),
      noiseSynth: new Tone.NoiseSynth({
        noise: { type: 'brown' },
        envelope: { attack: 0.01, decay: 0.08, sustain: 0, release: 0.05 },
        volume: -24,
      }).toDestination(),
      metalSynth: new Tone.MetalSynth({
        envelope: { attack: 0.001, decay: 0.12, release: 0.05 },
        harmonicity: 5.1,
        modulationIndex: 16,
        resonance: 4000,
        octaves: 1.5,
        volume: -22,
      }).toDestination(),
    }))
    .catch((error: unknown) => {
      runtimePromise = null;
      throw error;
    });

  return runtimePromise;
}

async function ensureRuntime(): Promise<AudioRuntime | null> {
  let runtime: AudioRuntime;
  try {
    runtime = await loadRuntime();
  } catch {
    return null;
  }

  if (initialized) return runtime;
  try {
    await runtime.Tone.start();
    initialized = true;
    return runtime;
  } catch {
    return null;
  }
}

export async function playDraw(): Promise<void> {
  const runtime = await ensureRuntime();
  if (!runtime) return;
  runtime.synth.triggerAttackRelease('C5', '16n');
}

export async function playPlace(): Promise<void> {
  const runtime = await ensureRuntime();
  if (!runtime) return;
  const now = runtime.Tone.now();
  runtime.synth.triggerAttackRelease('E4', '8n', now);
  runtime.synth.triggerAttackRelease('G4', '16n', now + 0.08);
}

export async function playStrike(): Promise<void> {
  const runtime = await ensureRuntime();
  if (!runtime) return;
  const now = runtime.Tone.now();
  runtime.noiseSynth.triggerAttackRelease('16n', now);
  runtime.metalSynth.triggerAttackRelease('C2', '16n', now + 0.03);
}

export async function playMarket(): Promise<void> {
  const runtime = await ensureRuntime();
  if (!runtime) return;
  const now = runtime.Tone.now();
  runtime.synth.triggerAttackRelease('A4', '16n', now);
  runtime.synth.triggerAttackRelease('D5', '16n', now + 0.1);
}

export async function playEndTurn(): Promise<void> {
  const runtime = await ensureRuntime();
  if (!runtime) return;
  runtime.synth.triggerAttackRelease('G3', '8n');
}

export async function playVictory(): Promise<void> {
  const runtime = await ensureRuntime();
  if (!runtime) return;
  const notes = ['C5', 'E5', 'G5', 'C6'];
  const now = runtime.Tone.now();
  for (let i = 0; i < notes.length; i++) {
    const note = notes[i]!;
    runtime.synth.triggerAttackRelease(note, '8n', now + i * 0.15);
  }
}

export async function playDefeat(): Promise<void> {
  const runtime = await ensureRuntime();
  if (!runtime) return;
  const notes = ['C4', 'Bb3', 'Ab3', 'G3'];
  const now = runtime.Tone.now();
  for (let i = 0; i < notes.length; i++) {
    const note = notes[i]!;
    runtime.synth.triggerAttackRelease(note, '4n', now + i * 0.2);
  }
}
