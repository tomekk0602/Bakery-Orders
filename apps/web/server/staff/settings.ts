import "server-only";
import { BakerySettings } from "@bakery/core/contracts";
import { loadSettings, saveSettings, type SaveSettingsResult } from "@bakery/db";
import { db } from "../runtime";

export const bakerySettingsDoc = async (): Promise<BakerySettings> => BakerySettings.parse(await loadSettings(db()));

export const updateBakerySettings = (s: BakerySettings): Promise<SaveSettingsResult> => saveSettings(db(), s);
