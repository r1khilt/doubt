import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Platform, StyleSheet, View } from "react-native";
import { T } from "@/theme";

// Launch animation: "doubt" rises in letter by letter, a yellow line strikes it out,
// "Prove them wrong." fades in, then the whole thing zooms away to reveal the app.
const WORD = "doubt".split("");
const native = Platform.OS !== "web";
let played = false; // once per app launch

export function Intro() {
  const [done, setDone] = useState(played);
  const letters = useRef(WORD.map(() => new Animated.Value(0))).current;
  const strike = useRef(new Animated.Value(0)).current;
  const tagline = useRef(new Animated.Value(0)).current;
  const exit = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (played) return;
    played = true;
    Animated.sequence([
      Animated.delay(150),
      Animated.stagger(70, letters.map((v) => Animated.spring(v, { toValue: 1, friction: 6, tension: 90, useNativeDriver: native }))),
      Animated.delay(120),
      Animated.timing(strike, { toValue: 1, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: native }),
      Animated.timing(tagline, { toValue: 1, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: native }),
      Animated.delay(550),
      Animated.timing(exit, { toValue: 1, duration: 450, easing: Easing.in(Easing.cubic), useNativeDriver: native }),
    ]).start(() => setDone(true));
  }, []);

  if (done) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, s.root, { opacity: exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}
    >
      <Animated.View style={{ alignItems: "center", transform: [{ scale: exit.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) }] }}>
        <View style={s.word}>
          {WORD.map((ch, i) => (
            <Animated.Text
              key={i}
              style={[s.letter, {
                opacity: letters[i],
                transform: [{ translateY: letters[i].interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }],
              }]}
            >
              {ch}
            </Animated.Text>
          ))}
          <Animated.View style={[s.strike, { transform: [{ scaleX: strike }] }]} />
        </View>
        <Animated.Text
          style={[s.tagline, {
            opacity: tagline,
            transform: [{ translateY: tagline.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
          }]}
        >
          Prove them wrong.
        </Animated.Text>
      </Animated.View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  root: { backgroundColor: T.bg, alignItems: "center", justifyContent: "center", zIndex: 1000 },
  word: { flexDirection: "row", alignItems: "center" },
  letter: { color: T.fg, fontSize: 64, fontWeight: "600", letterSpacing: -2.5 },
  strike: {
    position: "absolute", left: -6, right: -6, top: "54%", height: 6, borderRadius: 3,
    backgroundColor: T.yellow, transformOrigin: "left center",
  },
  tagline: { marginTop: 14, color: T.muted, fontSize: 17, fontWeight: "500", letterSpacing: -0.2 },
});
