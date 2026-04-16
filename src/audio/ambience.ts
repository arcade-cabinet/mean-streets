import * as Tone from 'tone';

// Only one mood is shipped today ('combat'); keeping the constant as an
// object lets us introduce additional moods later without changing
// callers. Until then, the helpers below take no mood argument — the
// previous `Mood = 'combat'` union parameter was a misleading API
// (accepted a value but always ignored it).
const MOODS = {
  combat: { droneFreq: 'C2', droneVol: -20, noiseVol: -34, lfoFreq: 0.15 },
} as const;

let droneFilter: Tone.Filter;
let drone: Tone.Synth;
let noiseFilter: Tone.Filter;
let noise: Tone.NoiseSynth;
let lfo: Tone.LFO;
let masterGain: Tone.Gain;

let playing = false;
let muted = false;
let preMuteVolume = 80;
export function initAmbience(): void {
  Tone.start();

  masterGain = new Tone.Gain(0.8).toDestination();

  // Drone pad
  droneFilter = new Tone.Filter(200, 'lowpass').connect(masterGain);
  drone = new Tone.Synth({
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 2, decay: 0, sustain: 1, release: 4 },
    volume: MOODS.combat.droneVol,
  }).connect(droneFilter);

  // Noise texture
  noiseFilter = new Tone.Filter(300, 'lowpass').connect(masterGain);
  noise = new Tone.NoiseSynth({
    noise: { type: 'brown' },
    envelope: { attack: 1, decay: 0, sustain: 1, release: 2 },
    volume: MOODS.combat.noiseVol,
  }).connect(noiseFilter);

  // Subtle filter LFO for movement
  lfo = new Tone.LFO({ frequency: MOODS.combat.lfoFreq, min: 150, max: 280 });
  lfo.connect(droneFilter.frequency);
  lfo.start();
}

export function startAmbience(): void {
  if (playing) return;
  const m = MOODS.combat;
  drone.volume.value = m.droneVol;
  noise.volume.value = m.noiseVol;
  lfo.frequency.value = m.lfoFreq;
  drone.triggerAttack(m.droneFreq);
  noise.triggerAttack();
  playing = true;
}

export function stopAmbience(): void {
  if (!playing) return;
  drone.triggerRelease();
  noise.triggerRelease();
  playing = false;
}

export function setMood(): void {
  const m = MOODS.combat;
  const ramp = '+2';
  drone.volume.rampTo(m.droneVol, 2, ramp);
  noise.volume.rampTo(m.noiseVol, 2, ramp);
  lfo.frequency.rampTo(m.lfoFreq, 2, ramp);
  if (playing) drone.triggerAttack(m.droneFreq, ramp);
}

export function setVolume(level: number): void {
  preMuteVolume = Math.max(0, Math.min(100, level));
  if (!muted) masterGain.gain.rampTo(preMuteVolume / 100, 0.1);
}

export function toggleMute(): void {
  muted = !muted;
  masterGain.gain.rampTo(muted ? 0 : preMuteVolume / 100, 0.2);
}

export function isPlaying(): boolean {
  return playing;
}
