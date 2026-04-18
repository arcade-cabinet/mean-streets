/**
 * Procedural SFX using Tone.js — no audio files needed.
 * Generates short synthetic sounds for game actions.
 * All sounds are muted until the user interacts (browser autoplay policy).
 */
import * as Tone from 'tone';

let initialized = false;

async function ensureContext(): Promise<boolean> {
  if (initialized) return true;
  try {
    await Tone.start();
    initialized = true;
    return true;
  } catch {
    return false;
  }
}

const synth = new Tone.Synth({
  oscillator: { type: 'triangle' },
  envelope: { attack: 0.005, decay: 0.15, sustain: 0, release: 0.1 },
  volume: -18,
}).toDestination();

const noiseSynth = new Tone.NoiseSynth({
  noise: { type: 'brown' },
  envelope: { attack: 0.01, decay: 0.08, sustain: 0, release: 0.05 },
  volume: -24,
}).toDestination();

const metalSynth = new Tone.MetalSynth({
  envelope: { attack: 0.001, decay: 0.12, release: 0.05 },
  harmonicity: 5.1,
  modulationIndex: 16,
  resonance: 4000,
  octaves: 1.5,
  volume: -22,
}).toDestination();

export async function playDraw(): Promise<void> {
  if (!await ensureContext()) return;
  synth.triggerAttackRelease('C5', '16n');
}

export async function playPlace(): Promise<void> {
  if (!await ensureContext()) return;
  synth.triggerAttackRelease('E4', '8n');
  setTimeout(() => synth.triggerAttackRelease('G4', '16n'), 80);
}

export async function playStrike(): Promise<void> {
  if (!await ensureContext()) return;
  noiseSynth.triggerAttackRelease('16n');
  setTimeout(() => metalSynth.triggerAttackRelease('C2', '16n'), 30);
}

export async function playMarket(): Promise<void> {
  if (!await ensureContext()) return;
  synth.triggerAttackRelease('A4', '16n');
  setTimeout(() => synth.triggerAttackRelease('D5', '16n'), 100);
}

export async function playEndTurn(): Promise<void> {
  if (!await ensureContext()) return;
  synth.triggerAttackRelease('G3', '8n');
}

export async function playVictory(): Promise<void> {
  if (!await ensureContext()) return;
  const notes = ['C5', 'E5', 'G5', 'C6'];
  for (let i = 0; i < notes.length; i++) {
    setTimeout(() => synth.triggerAttackRelease(notes[i], '8n'), i * 150);
  }
}

export async function playDefeat(): Promise<void> {
  if (!await ensureContext()) return;
  const notes = ['C4', 'Bb3', 'Ab3', 'G3'];
  for (let i = 0; i < notes.length; i++) {
    setTimeout(() => synth.triggerAttackRelease(notes[i], '4n'), i * 200);
  }
}
