---
title: Store Listing Copy
updated: 2026-04-17
status: draft
domain: product
---

# Mean Streets — Store Listing Draft

Canonical store metadata for Google Play + Apple App Store. Peer
reviewed before each submission (see `docs/RELEASE.md` Step 4).

## Short title (30 chars max)

**Mean Streets: Precision Starvation**

## Subtitle / short description (80 chars)

Gritty tactical 1v1 card brawler. No dice. Every play matters.

## Full description (4000 chars)

> You run a crew of toughs in a city where every block is someone
> else's. Seize turf. Burn through reserves. Last crew standing wins.
>
> Mean Streets: Precision Starvation is a fully-deterministic 1v1 card
> brawler. 100 toughs, 50 weapons, 50 drugs, 10 mythics — five rarity
> tiers from common to mythic. No dice, no coin flips, no luck-spikes.
> The only randomness is draw order — every decision you make is the
> decision that matters.
>
> **Features**
>
> - **Single-lane turf wars**: One active turf per side — reserves
>   promote when your frontline falls. Best of N where N scales with
>   difficulty.
> - **HP + damage tiers**: Wound, crush, or instant-kill. Wounded
>   toughs fight weaker. Every hit matters.
> - **Heat + raids**: Stack too much power, attract police attention.
>   Raids wipe your Black Market before combat even starts.
> - **Black Market + Holding**: Trade mods, heal wounded toughs, risk
>   the cops. Bribe your way out — or lose your crew to lockup.
> - **10 hand-authored Mythics**: Earned by killing enemy mythics, not
>   pulled from packs. Each one warps the game.
> - **Simulation-proven balance**: Every shipped card is locked by an
>   autobalance loop that runs thousands of simulated games.
> - **Cross-platform**: Web, Android, iOS — your collection syncs
>   through local SQLite.
> - **One-hand portrait play**: Designed mobile-first. Tablets and
>   landscape get their own deliberate compositions.
>
> Mean Streets is made by [team name] under the Arcade Cabinet label.

## Keywords / tags

card game, tactical, turn-based, 1v1, pvp, deterministic, strategy,
noir, crew, gang, pixel, indie, hardcore

## Categories

- Google Play: Card / Strategy
- Apple App Store: Games → Card, Games → Strategy

## Screenshots (deliverables per platform)

Per device profile (iPhone 6.7", iPhone 5.5", iPad Pro 12.9",
Android phone, Android 7" tablet, Android 10" tablet):

1. Menu screen — "Mean Streets: Precision Starvation"
2. Card Garage — merge pyramid + priority sliders
3. Single-lane turf — active stacks with HP bars
4. Combat — mid-strike with damage tier indicators
5. Heat meter + Black Market panel open
6. Game Over — war outcome with victory rating

Source fixtures live in `artifacts/visual-review/` (produced by
`pnpm run visual:export:headless`). Final screenshot set is composed
from those fixtures + marketing overlay — see Epic I3 in the
production-polish plan.

## App icon

Single source vector at `branding/icon.svg`. Generated across all
densities via `@capacitor/assets` — see Epic I3.

## Rating

- Google Play: **Teen** (violence, drug references)
- Apple: **12+** (infrequent/mild realistic violence, infrequent/mild
  simulated gambling references — cards are currency, not real money)

### Content rating questionnaire answers (Google Play)

| Question                              | Answer |
| ------------------------------------- | ------ |
| Violence                              | Mild, stylized |
| Sexual content                        | None   |
| Profanity                             | None   |
| Drugs, alcohol, tobacco               | References only (gameplay cards — "drugs" are stat modifiers) |
| Gambling                              | None (no real money) |
| User-generated content                | None   |
| Shares location                       | No     |
| Digital purchases                     | None   |

### IARC questionnaire key points

- "Drugs" in gameplay are stat modifiers (stimulant, sedative,
  hallucinogen, steroid, narcotic). No glamorization, no acquisition
  flow, no real-world branding.
- Violence is abstracted (card-on-card attacks, text outcomes). No
  blood, no gore, no weapon-use instruction.
- No real currency, no purchases of any kind. "Cash" is a gameplay
  card denomination.

## Privacy policy

Hosted at: `https://[project]/privacy-policy` (Epic I3 TBD).

Summary:

- No account system; profile stored locally in SQLite.
- No analytics, no ads, no third-party SDKs at launch.
- No data leaves the device.

## Support contact

- Support email: `support@[project]`
- Web: `https://[project]/support`

## Release notes template

```
Version X.Y.Z

- [category]: [one-line user-facing change]
- [category]: [...]

Balance notes:
- [card id]: [stat] [from] → [to]   (tuned from autobalance)

Thanks for playing — send feedback to support@[project].
```

## Review notes

- The shipped game has no in-app purchases and no ads.
- Account creation is not required; the app functions fully offline.
- "Drugs" in cards are stat modifiers, not purchasable items. Cards
  with names like "Hyper Snap" or "Rush Blend" represent stimulants
  in the fiction of the game — no drug-acquisition flow, no
  drug-use instruction.

## Open questions before first submission

- [ ] Final company / publisher name
- [ ] Real privacy policy URL
- [ ] Real support email
- [ ] Final app icon source (`branding/icon.svg`)
- [ ] Real screenshots (require Epic F visual polish lands first)
- [ ] Real marketing copy pass (current is placeholder)
