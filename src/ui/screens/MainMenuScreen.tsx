interface MainMenuScreenProps {
  onNewGame: () => void;
}

export function MainMenuScreen({ onNewGame }: MainMenuScreenProps) {
  return (
    <div className="h-screen bg-stone-950 flex flex-col items-center justify-center gap-6">
      <div className="flex flex-col items-center gap-2">
        <h1
          className="text-amber-500 font-bold tracking-[0.3em] text-6xl uppercase select-none"
          style={{ filter: 'url(#ragged-edge)' }}
        >
          MEAN STREETS
        </h1>
        <p className="text-stone-400 text-sm tracking-widest uppercase">
          A Tactical Turf War
        </p>
      </div>

      <button
        onClick={onNewGame}
        className="bg-amber-700 hover:bg-amber-600 text-stone-900 font-bold px-8 py-3 rounded tracking-widest uppercase transition-all shadow-lg shadow-amber-900/40"
      >
        NEW GAME
      </button>
    </div>
  );
}
