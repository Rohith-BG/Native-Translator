import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';


export default function App() {
  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Background gradient circles for visual depth */}
      <View style={styles.bgCircle1} />
      <View style={styles.bgCircle2} />

      {/* Main content */}
      <View style={styles.content}>
        {/* App icon placeholder */}
        <View style={styles.iconContainer}>
          <Text style={styles.iconText}>🌐</Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>Native Translator</Text>
        <Text style={styles.subtitle}>Local-first • On-device AI</Text>

        {/* Glass card */}
        <View style={styles.glassCard}>
          <Text style={styles.cardTitle}>👋 Hello World!</Text>
          <Text style={styles.cardDescription}>
            Your private, offline translator powered by Gemma 4 E2B.
            Translate text, voice, images, and documents — all on your device.
          </Text>
        </View>

        {/* Feature pills */}
        <View style={styles.pillRow}>
          <View style={styles.pill}>
            <Text style={styles.pillText}>📝 Text</Text>
          </View>
          <View style={styles.pill}>
            <Text style={styles.pillText}>🎤 Voice</Text>
          </View>
          <View style={styles.pill}>
            <Text style={styles.pillText}>📷 Image</Text>
          </View>
          <View style={styles.pill}>
            <Text style={styles.pillText}>📄 Docs</Text>
          </View>
        </View>

        {/* Status indicator */}
        <View style={styles.statusContainer}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>App scaffold ready • Build verified</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  bgCircle1: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(108, 99, 255, 0.15)',
    top: -50,
    right: -80,
  },
  bgCircle2: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(0, 217, 255, 0.1)',
    bottom: -30,
    left: -60,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 32,
    zIndex: 1,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: 'rgba(108, 99, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  iconText: {
    fontSize: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.5)',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 40,
  },
  glassCard: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 24,
    marginBottom: 32,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  cardDescription: {
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(255, 255, 255, 0.65)',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 40,
  },
  pill: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  pillText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    fontWeight: '600',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00E676',
  },
  statusText: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 13,
  },
});
