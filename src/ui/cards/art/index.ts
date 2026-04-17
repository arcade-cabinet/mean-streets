import { bruiserPose } from './poses/bruiser';
import { snitchPose } from './poses/snitch';
import { lookoutPose } from './poses/lookout';
import { ghostPose } from './poses/ghost';
import { enforcerPose } from './poses/enforcer';
import { hustlerPose } from './poses/hustler';
import { fixerPose } from './poses/fixer';
import { medicPose } from './poses/medic';
import { arsonistPose } from './poses/arsonist';
import { sharkPose } from './poses/shark';
import { wheelsmanPose } from './poses/wheelsman';
import { fencePose } from './poses/fence';

import { meleePose } from './weapons/melee';
import { rangedPose } from './weapons/ranged';
import { exoticPose } from './weapons/exotic';
import { explosivePose } from './weapons/explosive';

import { stimulantPose } from './drugs/stimulant';
import { depressantPose } from './drugs/depressant';
import { psychedelicPose } from './drugs/psychedelic';
import { narcoticPose } from './drugs/narcotic';

import { billPose } from './currency/bill';
import { stackPose } from './currency/stack';

export const ARCHETYPE_POSES: Record<string, (color: string) => string> = {
  bruiser: bruiserPose,
  snitch: snitchPose,
  lookout: lookoutPose,
  ghost: ghostPose,
  enforcer: enforcerPose,
  hustler: hustlerPose,
  fixer: fixerPose,
  medic: medicPose,
  arsonist: arsonistPose,
  shark: sharkPose,
  wheelsman: wheelsmanPose,
  fence: fencePose,
};

export const WEAPON_ART: Record<string, (color: string) => string> = {
  melee: meleePose,
  ranged: rangedPose,
  exotic: exoticPose,
  explosive: explosivePose,
};

export const DRUG_ART: Record<string, (color: string) => string> = {
  stimulant: stimulantPose,
  depressant: depressantPose,
  psychedelic: psychedelicPose,
  narcotic: narcoticPose,
};

export const CURRENCY_ART: Record<string, (color: string) => string> = {
  bill: billPose,
  stack: stackPose,
};
