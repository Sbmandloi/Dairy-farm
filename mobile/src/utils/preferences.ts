import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Small, non-sensitive device preferences.
 *
 * AsyncStorage rather than SecureStore is right here: none of this is a
 * credential, and losing it is a minor annoyance, not a security event.
 *
 * The unit preference exists because some customers are recorded in millilitres
 * ("750 ml") and others in litres. The web app keeps the same per-customer map
 * in localStorage; keeping it on the device rather than in the database matches
 * that, and means the choice never changes what anyone else sees — the value
 * stored is always litres.
 */

const UNIT_PREFS_KEY = "dairy.customerUnits";

export type Unit = "L" | "ml";

export async function loadUnitPrefs(): Promise<Record<string, Unit>> {
  try {
    const raw = await AsyncStorage.getItem(UNIT_PREFS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, Unit>) : {};
  } catch {
    return {};
  }
}

export async function saveUnitPrefs(prefs: Record<string, Unit>): Promise<void> {
  try {
    await AsyncStorage.setItem(UNIT_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // A failed preference write must never block recording milk.
  }
}

/** Litres (what is stored) → what the field shows. */
export function litersToDisplay(liters: string, unit: Unit): string {
  if (!liters) return "";
  const value = parseFloat(liters);
  if (Number.isNaN(value)) return "";
  return unit === "ml" ? String(Math.round(value * 1000)) : liters;
}

/** What the user typed → litres. */
export function displayToLiters(display: string, unit: Unit): string {
  if (!display) return "";
  const value = parseFloat(display);
  if (Number.isNaN(value)) return "";
  return unit === "ml" ? String(value / 1000) : display;
}
