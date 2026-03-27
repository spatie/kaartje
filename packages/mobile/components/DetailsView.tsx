import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from "react-native";
import { ArrowLeft } from "lucide-react-native";
import { StyleSheet } from "react-native-unistyles";
import { Button } from "./Button";
import { IconButton } from "./IconButton";

interface DetailsViewProps {
  onBack: () => void;
  onContinue: (message: string, senderName: string, country: string) => void;
  showLocationInput?: boolean;
}

const RECIPIENT = {
  name: "Spatie",
  street: "Kruikstraat 22",
  city: "2018 Antwerp",
  country: "Belgium",
};

export function DetailsView({ onBack, onContinue, showLocationInput }: DetailsViewProps) {
  const [message, setMessage] = useState("");
  const [senderName, setSenderName] = useState("");
  const [country, setCountry] = useState("");

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <IconButton
            icon={<ArrowLeft size={22} color="#ede6db" />}
            variant="ghost"
            size={40}
            onPress={onBack}
          />
          <Text style={styles.headerTitle}>Write your card</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Postcard back preview */}
        <View style={styles.card}>
          <View style={styles.cardLeft}>
            <Text
              style={[styles.cardMessage, !message && styles.cardMessagePlaceholder]}
              numberOfLines={6}
            >
              {message || "Your message here..."}
            </Text>
            {senderName ? <Text style={styles.cardFrom}>From {senderName}</Text> : null}
          </View>
          <View style={styles.cardDivider} />
          <View style={styles.cardRight}>
            <View style={styles.stamp} />
            <View style={styles.addressBlock}>
              <Text style={styles.addressLabel}>TO</Text>
              <Text style={styles.addressLine}>{RECIPIENT.name}</Text>
              <Text style={styles.addressLine}>{RECIPIENT.street}</Text>
              <Text style={styles.addressLine}>{RECIPIENT.city}</Text>
              <Text style={styles.addressLine}>{RECIPIENT.country}</Text>
            </View>
          </View>
        </View>

        {/* Form inputs */}
        <View style={styles.form}>
          <Text style={styles.label}>Message</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={message}
            onChangeText={setMessage}
            placeholder="Write your message..."
            placeholderTextColor="#6b655c"
            multiline
            textAlignVertical="top"
          />

          <Text style={styles.label}>Your name</Text>
          <TextInput
            style={styles.input}
            value={senderName}
            onChangeText={setSenderName}
            placeholder="Your name"
            placeholderTextColor="#6b655c"
          />

          {showLocationInput && (
            <>
              <Text style={styles.label}>Where are you sending from?</Text>
              <TextInput
                style={styles.input}
                value={country}
                onChangeText={setCountry}
                placeholder="Country (e.g. Belgium)"
                placeholderTextColor="#6b655c"
              />
            </>
          )}
        </View>

        <View style={styles.actions}>
          <Button variant="primary" onPress={() => onContinue(message, senderName, country)}>
            Continue
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create((theme, rt) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.night,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingTop: rt.insets.top + theme.space(4),
    paddingBottom: rt.insets.bottom + theme.space(8),
    paddingHorizontal: theme.space(6),
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.space(6),
  },
  headerTitle: {
    fontFamily: theme.fonts.serif,
    fontSize: 20,
    color: theme.colors.ink,
    textAlign: "center",
  },
  headerSpacer: {
    width: 40,
  },

  // Postcard back card
  card: {
    flexDirection: "row",
    aspectRatio: 3 / 2,
    backgroundColor: "#f0ebe3",
    borderRadius: theme.radius.lg,
    overflow: "hidden",
    marginBottom: theme.space(8),
  },
  cardLeft: {
    flex: 1,
    padding: theme.space(4),
    justifyContent: "space-between",
  },
  cardDivider: {
    width: 1,
    backgroundColor: "#c4bdb3",
  },
  cardRight: {
    flex: 1,
    padding: theme.space(4),
    alignItems: "flex-end",
  },
  cardMessage: {
    fontFamily: theme.fonts.sansItalic,
    fontSize: 11,
    color: "#3a3632",
    lineHeight: 16,
  },
  cardMessagePlaceholder: {
    color: "#b0a99e",
  },
  cardFrom: {
    fontFamily: theme.fonts.sansMedium,
    fontSize: 10,
    color: "#6b655c",
  },
  stamp: {
    width: 36,
    height: 44,
    backgroundColor: theme.colors.stamp,
    borderRadius: theme.radius.sm,
    opacity: 0.8,
    marginBottom: theme.space(4),
  },
  addressBlock: {
    alignSelf: "stretch",
  },
  addressLabel: {
    fontFamily: theme.fonts.sansBold,
    fontSize: 8,
    color: "#9b9489",
    letterSpacing: 2,
    marginBottom: theme.space(1),
  },
  addressLine: {
    fontFamily: theme.fonts.sans,
    fontSize: 11,
    color: "#3a3632",
    lineHeight: 16,
  },

  // Form
  form: {
    marginBottom: theme.space(6),
  },
  label: {
    fontFamily: theme.fonts.sansMedium,
    fontSize: 12,
    color: theme.colors.inkFaded,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: theme.space(1),
    marginTop: theme.space(4),
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.space(4),
    fontFamily: theme.fonts.sans,
    fontSize: 16,
    color: theme.colors.ink,
  },
  inputMultiline: {
    minHeight: 120,
  },

  // Actions
  actions: {
    alignItems: "stretch",
  },
}));
