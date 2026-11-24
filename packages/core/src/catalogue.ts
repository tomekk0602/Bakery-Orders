export type Product = {
  id: string;
  name: string;
  /** Inflected forms a caller says ("kaiserka", "kaiserky", "kaiserek"), for the speech vocabulary. */
  spokenForms: string[];
  priceCzk: number;
  /** null = no daily limit */
  dailyLimit: number | null;
  active: boolean;
};

export const activeProducts = (catalogue: readonly Product[]): Product[] => catalogue.filter((p) => p.active);
