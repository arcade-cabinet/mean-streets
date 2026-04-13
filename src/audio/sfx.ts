import * as Tone from 'tone';

let initialized = false;
let volume = 0.5;
let muted = false;

let impactSynth: Tone.MembraneSynth;
let metalSynth: Tone.MetalSynth;
let noiseSynth: Tone.NoiseSynth;

export function initSFX(): void {
  if (initialized) return;
  impactSynth = new Tone.MembraneSynth({ volume: -10 }).toDestination();
  metalSynth = new Tone.MetalSynth({ volume: -15, envelope: { decay: 0.1 } }).toDestination();
  noiseSynth = new Tone.NoiseSynth({
    volume: -20,
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.1, sustain: 0 },
  }).toDestination();
  initialized = true;
}

export function playSFX(event: string): void {
  if (!initialized || muted) return;

  switch (event) {
    case 'card-place':
      impactSynth.triggerAttackRelease('C2', '16n');
      break;
    case 'attack-hit':
      impactSynth.triggerAttackRelease('G1', '8n');
      break;
    case 'attack-kill':
      impactSynth.triggerAttackRelease('C1', '4n');
      noiseSynth.triggerAttackRelease('8n');
      break;
    case 'attack-miss':
      noiseSynth.triggerAttackRelease('16n');
      break;
    case 'flip':
      metalSynth.triggerAttackRelease('32n');
      break;
    case 'seize':
      impactSynth.triggerAttackRelease('E1', '4n');
      break;
    case 'cash':
      metalSynth.triggerAttackRelease('16n');
      break;
    case 'round-start':
      metalSynth.triggerAttackRelease('8n');
      break;
    case 'strike':
      impactSynth.triggerAttackRelease('C1', '2n');
      break;
    case 'victory':
      impactSynth.triggerAttackRelease('C3', '8n', Tone.now());
      impactSynth.triggerAttackRelease('E3', '8n', Tone.now() + 0.2);
      impactSynth.triggerAttackRelease('G3', '4n', Tone.now() + 0.4);
      break;
    case 'defeat':
      impactSynth.triggerAttackRelease('C1', '1n');
      break;
  }
}

export function setSFXVolume(level: number): void {
  volume = Math.max(0, Math.min(1, level / 100));
  if (impactSynth) impactSynth.volume.value = Tone.gainToDb(volume) - 10;
  if (metalSynth) metalSynth.volume.value = Tone.gainToDb(volume) - 15;
  if (noiseSynth) noiseSynth.volume.value = Tone.gainToDb(volume) - 20;
}

export function toggleSFXMute(): void {
  muted = !muted;
}

export function isSFXMuted(): boolean {
  return muted;
}
