import { StyleSheet, View } from "react-native";
import { Redirect } from "expo-router";
import { ActivityIndicator } from "react-native-paper";
import { useAuth } from "@/auth/auth-context";

/**
 * Entry point: send the user to the app or to login once the stored session has
 * been read.
 *
 * The loading branch renders the same brand background as the splash screen, so
 * the handover from the native splash to React is invisible.
 */
export default function Index() {
  const { status } = useAuth();

  if (status === "loading") {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  return <Redirect href={status === "authenticated" ? "/dashboard" : "/login"} />;
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563EB",
  },
});
