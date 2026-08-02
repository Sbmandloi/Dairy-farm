import { Platform, StyleSheet, View } from "react-native";
import { Tabs } from "expo-router";
import { Icon, Text, useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radius, spacing } from "@/theme";
import type { AppTheme } from "@/theme";

/**
 * Bottom navigation.
 *
 * Five destinations, chosen by what the farmer actually opens during a working
 * day — the web sidebar's nine entries do not fit a thumb reach, so the five
 * daily ones are tabs and the rest live behind "More". Material 3's pill
 * indicator behind the active icon is drawn here because expo-router's tab bar
 * does not provide one.
 */
export default function TabsLayout() {
  const theme = useTheme<AppTheme>();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTintColor: theme.colors.onSurface,
        headerTitleStyle: { fontWeight: "600" },
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: theme.colors.background },
        tabBarStyle: {
          backgroundColor: theme.colors.elevation.level2,
          borderTopColor: theme.colors.outlineVariant,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: 64 + insets.bottom,
          paddingTop: spacing.sm,
          paddingBottom: insets.bottom,
          elevation: 0,
        },
        tabBarButtonTestID: undefined,
        // Labels are drawn inside tabBarIcon so the pill indicator can sit
        // behind the icon alone, as Material 3 specifies.
        tabBarShowLabel: false,
        // Android ripple is squared off by default on a 64dp bar; the custom
        // item below handles its own press feedback.
        tabBarHideOnKeyboard: Platform.OS === "android",
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Dairy Billing",
          tabBarIcon: (props) => <TabItem {...props} icon="view-dashboard-outline" label="Home" />,
        }}
      />
      <Tabs.Screen
        name="entry"
        options={{
          title: "Daily entry",
          tabBarIcon: (props) => <TabItem {...props} icon="clipboard-edit-outline" label="Entry" />,
        }}
      />
      <Tabs.Screen
        name="billing"
        options={{
          title: "Billing",
          tabBarIcon: (props) => <TabItem {...props} icon="receipt" label="Billing" />,
        }}
      />
      <Tabs.Screen
        name="customers"
        options={{
          title: "Customers",
          tabBarIcon: (props) => <TabItem {...props} icon="account-group-outline" label="People" />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "More",
          tabBarIcon: (props) => <TabItem {...props} icon="dots-horizontal" label="More" />,
        }}
      />
    </Tabs>
  );
}

function TabItem({
  focused,
  icon,
  label,
}: {
  focused: boolean;
  icon: string;
  label: string;
}) {
  const theme = useTheme<AppTheme>();

  return (
    <View style={styles.item}>
      <View
        style={[
          styles.pill,
          focused ? { backgroundColor: theme.colors.secondaryContainer } : null,
        ]}
      >
        <Icon
          source={icon}
          size={22}
          color={focused ? theme.colors.onSecondaryContainer : theme.colors.onSurfaceVariant}
        />
      </View>
      <Text
        variant="labelSmall"
        numberOfLines={1}
        style={{
          color: focused ? theme.colors.onSurface : theme.colors.onSurfaceVariant,
          fontWeight: focused ? "700" : "500",
        }}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  item: { alignItems: "center", justifyContent: "center", width: 72, gap: 2 },
  pill: {
    width: 56,
    height: 30,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
});
