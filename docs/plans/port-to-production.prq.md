# Feature: Port Mean Streets POC to Production TypeScript Stack

**Created**: 2026-04-12
**Version**: 1.0
**Timeframe**: 2-3 days (autonomous batch execution)

## Priority: P0

## Overview

Port the existing single-file React JSX proof-of-concept (`public/public.html`, ~724 lines) of **Mean Streets: Precision Starvation** into a production-grade TypeScript application with proper project structure, documentation, testing, CI/CD, and deployment to GitHub Pages.

The POC was designed through 8 iterative pivots documented in `Gemini-Conversation.md`. The game is mechanically complete: coin toss opener, dealing sequence, Vanguard combat with the Precision Rule, 4 custom suits with unique abilities, overdraw penalties, shield mechanics, starvation victory, and an AI opponent. All game logic, rendering, and interaction is in a single file. This task PORTS that logic faithfully, with no mechanical reinvention.

## Tech Stack Decision

**React + Koota ECS + GSAP + Tone.js** (NOT a game engine like Phaser/PixiJS/LittleJS)

### Why NOT a game engine?

Phaser, PixiJS, and LittleJS all render to `<canvas>`. That means:
- SVG filters (noise, distortion, film grain) — the entire noir aesthetic — are gone
- Tailwind CSS utilities are gone; you code visual styles programmatically
- Native browser text, web fonts, and accessibility are degraded
- Drag-and-drop becomes engine-specific instead of DOM events + GSAP Draggable
- Layout is a CSS/flexbox problem, not a physics engine problem

GSAP Draggable gives inertia, bounds, throw physics, and snapping on DOM elements — exactly what card dragging needs. Card fan layout is arc math computed by Koota systems.

### Why Koota instead of Zustand?

Koota (pmndrs ECS library) models every card as an entity with traits. Reference implementation exists at `~/src/reference-codebases/koota/examples/cards/`.

- **Card identity is intrinsic** — entities, not IDs in arrays
- **Relations model card ownership** — `HeldBy(hand)` with `OrderedCards` for hand ordering, `IsVanguard` tag for active fighter
- **Systems are pure functions** — combat resolution, AI decisions, layout — all testable without React
- **60fps animation without React re-renders** — systems write CSS transforms directly to DOM refs via `syncToDOM` pattern
- **Suit abilities as queryable traits** — `world.query(Card, KnuckleSuit)` vs big switch statements
- **React binds precisely** — `useTrait(card, HP)` re-renders only that card when HP changes; `useQuery(IsVanguard)` re-renders only when vanguard changes

| Concern | Library | Why |
|---------|---------|-----|
| UI Framework | React 19 + TypeScript | Already the POC framework; component model fits card games |
| Build Tool | Vite 6 | Fast dev server, native TS, tree-shaking, static site output |
| Styling | Tailwind CSS 4 | Already used in POC; utility-first fits rapid visual iteration |
| Game State + Logic | Koota (ECS) | Entity-per-card architecture, relations for hand/vanguard, systems for mechanics |
| Animation | GSAP 3.x (free) | Draggable plugin for card drag, FLIP for zone transitions, Timeline for dealing sequences |
| Audio - Music | Tone.js | Synthesized noir jazz loops, beat-synced SFX |
| Audio - SFX | Howler.js | Simple one-shot sounds (card slap, impact, whoosh) |
| Icons | Lucide React | Already used in POC for suit/UI icons |
| Testing | Vitest + @vitest/browser | Unit + browser integration tests |
| Linting | ESLint 9 + typescript-eslint | Type-aware linting |
| Formatting | Prettier | Consistent formatting |

## Tasks

### Phase 1: Project Foundation

- [ ] P0-1: Initialize Vite + React + TypeScript project with all dependencies
- [ ] P0-2: Configure Tailwind CSS 4, PostCSS, and design tokens
- [ ] P0-3: Configure ESLint 9, Prettier, and Vitest with browser plugin
- [ ] P0-4: Create CI workflow (lint, typecheck, test, build on all PRs)
- [ ] P0-5: Create CD workflow (deploy to GitHub Pages on push to main)
- [ ] P0-6: Enable GitHub Pages for the repository

### Phase 2: Core Game Architecture (Koota ECS — Port from POC)

- [ ] P1-1: Define Koota traits (Card, HP, Shield, Suit, Rank, Position, Rotation, Scale, Dragging, IsVanguard, IsFaceDown, IsDealing, Ref) and relations (HeldBy, OrderedCards)
- [ ] P1-2: Define world traits (GamePhase, Turn, Deck, DiscardPile, Notice, CoinState) and createWorld
- [ ] P1-3: Port deck utilities as Koota actions (shuffle, buildDeck, dealCards)
- [ ] P1-4: Port game state machine as system (phase transitions: MENU, COIN_TOSS, DEALING, BATTLE, PROMOTE, VICTORY, GAMEOVER)
- [ ] P1-5: Port combat engine as systems (validatePlay, applyDamage, executeSuitAbility, processOverdraw, checkVanguardDeath, awardKillBounty)
- [ ] P1-6: Build AI opponent with Yuka.js GOAP (goal-oriented action planning, not reactive if/else)
- [ ] P1-7: Create game actions via createActions (playCard, promoteVanguard, passTurn, hustle, startGame)
- [ ] P1-8: Create frame loop component (system pipeline execution order)

### Phase 3: UI Components (Port from POC)

- [ ] P2-1: Port SVG filters component (ragged-edge, grime, metallic)
- [ ] P2-2: Port card rendering component (face-up, face-down, vanguard, hand variants)
- [ ] P2-3: Port coin toss screen with 3D CSS animation
- [ ] P2-4: Port battle layout (opponent zone, the street, player zone)
- [ ] P2-5: Port HUD elements (hand counter, deck counter, discard counter, phase indicator, notice flash)
- [ ] P2-6: Port drag-and-drop interaction (replace pointer events with GSAP Draggable)
- [ ] P2-7: Port menu/victory/gameover overlay screens
- [ ] P2-8: Port dealing animation sequence
- [ ] P2-9: Wire all components into App.tsx and verify full game loop

### Phase 4: Audio System

- [ ] P3-1: Set up Tone.js audio engine with ambient noir loop
- [ ] P3-2: Set up Howler.js SFX system (card play, impact, draw, coin flip, victory, defeat)

### Phase 5: Testing

- [ ] P4-1: Unit tests for game logic (deck building, shuffle, combat rules, precision rule, overdraw)
- [ ] P4-2: Unit tests for AI decision-making
- [ ] P4-3: Browser integration test for full game flow (coin toss through victory/defeat)

### Phase 6: Documentation

- [ ] P5-1: Create root README.md (project overview, screenshots, how to play, how to develop)
- [ ] P5-2: Create CLAUDE.md (agent entry point with project identity, commands, structure)
- [ ] P5-3: Create AGENTS.md (extended operating protocols, architecture patterns)
- [ ] P5-4: Create STANDARDS.md (code quality, brand/design rules, design tokens)
- [ ] P5-5: Create CHANGELOG.md (initial release)
- [ ] P5-6: Create docs/ARCHITECTURE.md (system design, state flow, component tree)
- [ ] P5-7: Create docs/DESIGN.md (game vision, identity, UX principles, what it IS and IS NOT)
- [ ] P5-8: Create docs/LORE.md (world, narrative, flavor, card lore)
- [ ] P5-9: Create docs/TESTING.md (test strategy, coverage goals, how to run)
- [ ] P5-10: Create docs/DEPLOYMENT.md (GitHub Pages, environments, build process)
- [ ] P5-11: Create docs/STATE.md (current project state, what is done, what is next)

### Phase 7: Governance and Config

- [ ] P6-1: Create .github/dependabot.yml
- [ ] P6-2: Create .github/copilot-instructions.md and .cursor/rules referencing CLAUDE.md
- [ ] P6-3: Create .claude/settings.json with hooks

## Dependencies

```
P0-1 -> P0-2, P0-3 (toolchain must exist first)
P0-3 -> P0-4 (CI needs lint/test/build commands)
P0-1 -> P0-5 (CD needs build output)
P0-5 -> P0-6 (Pages needs the workflow to exist)
P1-1 -> P1-2, P1-3, P1-4, P1-5 (types first)
P1-2, P1-3, P1-4, P1-5 -> P1-6 (store aggregates all logic)
P1-6 -> P2-* (UI needs store)
P2-1..P2-8 -> P2-9 (App.tsx wires everything)
P1-6 -> P3-* (audio hooks into game events)
P1-4, P1-5 -> P4-1, P4-2 (test what was built)
P2-9 -> P4-3 (browser test needs full app)
P2-9 -> P5-* (docs describe what exists)
```

## Acceptance Criteria

### P0-1: Initialize project
- `npm run dev` starts Vite dev server with React 19 + TS
- `npm run build` produces `dist/` with static site
- `npm run preview` serves the built site
- All dependencies listed in Tech Stack are installed
- tsconfig.json configured for strict mode

### P0-2: Tailwind + Design Tokens
- Tailwind 4 configured and producing utility classes
- Design tokens defined: color palette (stone/amber/red noir scheme), typography (tracking, weight), spacing, card dimensions
- Tokens exported as CSS custom properties AND Tailwind theme extensions

### P0-3: ESLint + Prettier + Vitest
- `npm run lint` runs ESLint with typescript-eslint
- `npm run format` runs Prettier
- `npm run test` runs Vitest
- `npm run test:browser` runs Vitest with browser plugin
- vitest.config.ts configured for both unit and browser modes

### P0-4: CI workflow
- `.github/workflows/ci.yml` triggers on `pull_request`
- Runs: install, lint, typecheck, test, build
- Uses Node 22, caches node_modules

### P0-5: CD workflow
- `.github/workflows/cd.yml` triggers on `push` to `main`
- Builds and deploys to GitHub Pages
- Uses `actions/configure-pages`, `actions/upload-pages-artifact`, `actions/deploy-pages`

### P0-6: GitHub Pages enabled
- `gh api` confirms Pages is enabled with GitHub Actions as source
- Site is accessible at arcade-cabinet.github.io/mean-streets

### P1-1: Game types
- All types exported from `src/types/` (Card, Suit, Rank, GamePhase, GameState, Player)
- Constants for SUITS, RANKS with descriptions and abilities
- No `any` types; strict TypeScript throughout

### P1-2: Deck utilities
- `buildDeck()` returns shuffled 52-card deck with correct HP assignments
- `shuffle()` implements Fisher-Yates correctly
- `generateId()` produces unique IDs
- Pure functions, no side effects

### P1-3: Game state machine
- All phases represented: MENU, COIN_TOSS, DEALING, BATTLE, PLAYER_PROMOTE, ENEMY_PROMOTE, VICTORY, GAMEOVER
- Phase transitions match POC behavior exactly
- Turn alternation works correctly

### P1-4: Combat engine
- Precision Rule enforced: cannot attack if card rank > enemy HP (except KNUCKLE)
- KNUCKLE ignores precision rule
- SHIV forces enemy draw (can trigger overdraw)
- CROW gives attacker +1 draw
- CHAIN gives +3 shield to own vanguard
- Sacrifice heals vanguard by card rank (capped at maxHp)
- Overdraw penalty: hand > 5 forces first card to become vanguard
- Shield absorbs overdraw penalty
- Kill bounty: +2 cards on vanguard kill
- Starvation victory: kill vanguard when hand is empty = win

### P1-5: AI opponent
- Prefers exact-lethal precision kills
- Targets SHIV plays when player hand is >3 (overdraw weapon)
- Sacrifices lowest card to heal when blocked
- Hustles when low on cards and HP allows
- Promotes highest HP card as new vanguard

### P1-6: Zustand store
- Single store with all game state and actions
- Actions match POC: handleCoinToss, startDealing, playCard, executeDraw, promoteVanguard, passTurn, hustle
- Computed selectors for canAttack, canHustle, isPlayerTurn, etc.

### P2-1 through P2-9: UI Components
- Visual output matches POC appearance (gritty noir, SVG filters, card design)
- Drag and drop works via GSAP Draggable (replaces raw pointer events)
- All animations preserved: deal, shake, coin flip, pulse
- Responsive layout (mobile-first, scales to desktop)
- Full game playable from coin toss to victory/defeat

### P3-1: Audio - Music
- Ambient noir loop plays during battle phase
- Music fades in/out on phase transitions
- User gesture required before audio (Web Audio API policy)

### P3-2: Audio - SFX
- Card play, impact, draw, coin flip, victory, defeat sounds
- Sounds trigger on corresponding game events

### P4-1: Game logic tests
- Greater than 80% coverage of game logic functions
- Tests cover: deck building, precision rule validation, all 4 suit abilities, overdraw penalty, shield absorption, starvation victory condition

### P4-2: AI tests
- Tests verify AI decision priorities
- Edge cases: empty hand, blocked attacks, low HP hustle

### P4-3: Browser test
- At least 1 full-game-loop test that plays through coin toss, dealing, several turns, and resolution

### P5-1 through P5-11: Documentation
- All files use YAML frontmatter (title, updated, status, domain)
- Content is substantive, not stub
- README includes: game description, screenshot, how to play rules summary, development setup, tech stack, deployment info

### P6-1 through P6-3: Governance
- dependabot.yml configured for npm ecosystem, weekly, group minor/patch
- AI tool config files reference CLAUDE.md

## Security: No POC Patterns in Production

The POC cuts corners that are NOT acceptable in the production port:

- **NO innerHTML or unsafe HTML injection** — the POC injects CSS via inline style tags with raw HTML. The port MUST use proper CSS files, CSS modules, or Tailwind classes exclusively. All keyframe animations go in `.css` files.
- **NO raw string interpolation into DOM** — all rendering through React JSX only.
- **NO unvalidated external input** — even though this is a client-only game, sanitize any future user input (player names, etc.)
- **Content Security Policy** — the built site should work with a strict CSP (no `unsafe-inline` for scripts).

## Technical Notes

- The POC file is `public/public.html` (not `poc.html`)
- The Gemini conversation documents 8 major design pivots; the final mechanics in the POC are canonical
- Suit icons in POC use Unicode characters but suit names are custom (KNUCKLE, SHIV, CROW, CHAIN)
- Suit colors: KNUCKLE/CROW are dark (text-stone-900), SHIV/CHAIN are red (text-red-900)
- CSS animations in POC are injected inline and MUST be extracted to proper CSS files in the port
- The POC has a dealing alternation logic that uses tossWinner for deal order
- Card rank values: A=1, 2-10=face value, J=11, Q=12, K=13
- Reference codebases available at ~/src/reference-codebases/ including: phaser, template-react-ts, konva, react-konva, LittleJS

## Risks

- GSAP Draggable may need careful integration with React reconciler (use refs, not state, for drag position)
- Tone.js bundle is ~150KB; consider lazy loading or code splitting
- SVG filter performance on mobile needs testing (feTurbulence is expensive)
- The POC overdraw logic has subtle state update ordering issues with React batching; Zustand should resolve this
- Coin toss 3D CSS animation uses preserve-3d which has inconsistent Safari support; test on WebKit
