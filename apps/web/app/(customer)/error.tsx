"use client";
export default function CustomerError({ reset }: { reset: () => void }) {
  return (
    <main className="shell" style={{ paddingBlock: 80 }}>
      <p className="eyebrow">Pekárna U Lípy</p>
      <h1 className="text-3xl">Nabídku se nepodařilo načíst.</h1>
      <p className="my-6">Omlouváme se. Zkuste to prosím za chvíli znovu.</p>
      <button type="button" onClick={reset} className="button primary">
        Zkusit znovu
      </button>
    </main>
  );
}
