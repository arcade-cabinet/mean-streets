export type DifficultyIconId =
  | 'difficulty-corner-mercy'
  | 'difficulty-street-code'
  | 'difficulty-heavy-heat'
  | 'difficulty-kingpin-debt'
  | 'difficulty-body-bags'
  | 'difficulty-no-dawn';

export type TutorialIconId =
  | 'tutorial-stack'
  | 'tutorial-reveal'
  | 'tutorial-heat'
  | 'tutorial-seize';

export type SilhouetteIconId = DifficultyIconId | TutorialIconId;

export function silhouetteIconPath(icon: SilhouetteIconId): string {
  return `${import.meta.env.BASE_URL}assets/ui/silhouette-icons/${icon}.png`;
}
