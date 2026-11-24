import { Icon } from "./Icon";
const STEPS = [
  {
    icon: "phone",
    title: "Vyberte, nebo zavolejte",
    text: "Pečivo si rezervujete tady na webu, v hovoru s asistentem i u nás v prodejně.",
  },
  {
    icon: "check",
    title: "Potvrďte si objednávku",
    text: "Zkontrolujete pečivo, cenu a den vyzvednutí. Pak dostanete číslo objednávky.",
  },
  {
    icon: "bag",
    title: "Vyzvedněte v pekárně",
    text: "Při vyzvednutí řeknete své jméno nebo číslo objednávky. Zaplatíte na místě.",
  },
] as const;
export function HowToOrder() {
  return (
    <section id="jak-objednat" className="how-section shell" aria-label="Jak objednat">
      <ul>
        {STEPS.map((s) => (
          <li key={s.title}>
            <Icon kind={s.icon} />
            <div>
              <h2>{s.title}</h2>
              <p>{s.text}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
