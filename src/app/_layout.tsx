import { ConvexProvider, ConvexReactClient } from "convex/react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { MeProvider } from "@/me";
import { T as K } from "@/theme";

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL ?? "https://fantastic-dog-485.convex.cloud", { unsavedChangesWarning: false });

export default function RootLayout() {
  return (
    <ConvexProvider client={convex}>
      <StatusBar style="light" />
      <MeProvider>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: K.bg } }} />
      </MeProvider>
    </ConvexProvider>
  );
}
