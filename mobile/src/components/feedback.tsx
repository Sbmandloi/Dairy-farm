import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { StyleSheet } from "react-native";
import { Snackbar, Text, useTheme } from "react-native-paper";
import * as Haptics from "expo-haptics";
import { toUserMessage } from "@/api/errors";
import type { AppTheme } from "@/theme";

/**
 * App-wide transient feedback.
 *
 * One Snackbar host at the root rather than a per-screen one, so a message
 * survives a navigation (saving on a detail screen and popping back still
 * confirms the save) and two screens can never stack overlapping toasts.
 *
 * Haptics are paired with the message because the farmer is often looking at
 * the cow, not the phone — a save that only flashes on screen is a save they
 * cannot confirm without stopping work.
 */

type Tone = "success" | "error" | "info";

interface FeedbackValue {
  success: (message: string) => void;
  error: (error: unknown) => void;
  info: (message: string) => void;
}

const FeedbackContext = createContext<FeedbackValue | null>(null);

interface Message {
  text: string;
  tone: Tone;
  /** Bumped per message so an identical string re-triggers the snackbar. */
  id: number;
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const theme = useTheme<AppTheme>();
  const [message, setMessage] = useState<Message | null>(null);
  const nextId = useRef(0);

  const show = useCallback((text: string, tone: Tone) => {
    nextId.current += 1;
    setMessage({ text, tone, id: nextId.current });
  }, []);

  const value = useMemo<FeedbackValue>(
    () => ({
      success: (text) => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        show(text, "success");
      },
      error: (error) => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        show(toUserMessage(error), "error");
      },
      info: (text) => show(text, "info"),
    }),
    [show]
  );

  const background =
    message?.tone === "error"
      ? theme.colors.errorContainer
      : message?.tone === "success"
        ? theme.dairy.paid.container
        : theme.colors.inverseSurface;

  const foreground =
    message?.tone === "error"
      ? theme.colors.onErrorContainer
      : message?.tone === "success"
        ? theme.dairy.paid.onContainer
        : theme.colors.inverseOnSurface;

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <Snackbar
        // Errors stay long enough to read a sentence; confirmations do not need to.
        key={message?.id}
        visible={message !== null}
        onDismiss={() => setMessage(null)}
        duration={message?.tone === "error" ? 6000 : 3000}
        style={[styles.snackbar, { backgroundColor: background }]}
        action={{ label: "OK", textColor: foreground, onPress: () => setMessage(null) }}
      >
        <Text style={{ color: foreground }}>{message?.text ?? ""}</Text>
      </Snackbar>
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): FeedbackValue {
  const context = useContext(FeedbackContext);
  if (!context) throw new Error("useFeedback must be used inside <FeedbackProvider>");
  return context;
}

const styles = StyleSheet.create({
  snackbar: {
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 12,
  },
});
