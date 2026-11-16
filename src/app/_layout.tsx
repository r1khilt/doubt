import { ConvexProvider, ConvexReactClient } from "convex/react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { Intro } from "@/intro";
import { MeProvider, useMe } from "@/me";
import { T as K } from "@/theme";

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL ?? "https://fantastic-dog-485.convex.cloud", { unsavedChangesWarning: false });

// Remount the whole navigator when the active local account changes, so every screen re-renders as that person.
function Root() {
  const { deviceId } = useMe();
  return <Stack key={deviceId} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: K.bg } }} />;
}

export default function RootLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: K.bg }}>
      <ConvexProvider client={convex}>
        <StatusBar style="light" />
        <MeProvider>
          <Root />
        </MeProvider>
      </ConvexProvider>
      <Intro />
    </View>
  );
}
