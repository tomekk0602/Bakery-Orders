import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import cs from "./cs.json";

// One translation source (ADR-0015): English keys, Czech text.
void i18n.use(initReactI18next).init({ lng: "cs", fallbackLng: "cs", resources: { cs: { translation: cs } }, interpolation: { escapeValue: false } });

export { i18n };
