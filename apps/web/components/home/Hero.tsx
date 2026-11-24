import Image from "next/image";
import { Icon } from "./Icon";

export function Hero({ name, deadline }: { name: string; deadline: string }) {
  return (
    <>
      <a className="skip-link" href="#pecivo">
        Přejít na nabídku
      </a>
      <nav className="site-nav shell" aria-label="Hlavní navigace">
        <a href="#" className="brand">
          <Icon kind="wheat" />
          <span>{name}</span>
        </a>
        <div className="nav-links">
          <a href="#pecivo">Naše pečivo</a>
          <a href="#jak-objednat">Jak objednat</a>
        </div>
        <a href="#telefon" className="nav-call">
          <Icon kind="phone" />
          <span>Zavolat</span>
        </a>
      </nav>
      <header className="hero shell">
        <div className="hero-copy">
          <p className="eyebrow">Dobré ráno začíná v pekárně</p>
          <h1>
            Čerstvé pečivo.
            <br />
            <em>Rezervované pro vás.</em>
          </h1>
          <p className="hero-description">
            Vyberte si chléb a pečivo, nebo nám zavolejte. Objednávku si vyzvednete v pekárně.
          </p>
          <div className="hero-actions">
            <a href="#telefon" className="button primary">
              <Icon kind="phone" />
              Zavolat do pekárny
            </a>
            <a href="#pecivo" className="button secondary">
              Vybrat pečivo
            </a>
          </div>
          <p className="hero-note">
            <span aria-hidden="true">◷</span> {deadline}
          </p>
        </div>
        <div className="hero-photo">
          <Image
            src="/images/hero.webp"
            alt="Chléb, rohlíky a koláče na světlém pekařském stole"
            width={1600}
            height={1200}
            sizes="(max-width: 760px) 100vw, 52vw"
            preload
          />
          <span className="photo-caption">Na dobré ráno. I na celý den.</span>
        </div>
      </header>
    </>
  );
}
