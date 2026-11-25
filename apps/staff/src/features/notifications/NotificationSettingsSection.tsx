import type { NotificationSettings } from "@bakery/core/contracts";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, StyleSheet, Switch, Text, View } from "react-native";
import { Button, Card, colors, font, space, TextField } from "@/shared/ui";
import { notificationKeys, useNotificationSettings, useSaveNotificationSettings } from "./api";
import { currentEndpoint, deviceSupport, disableDevice, enableDevice } from "./device";
import { isSoundOn, playChime, setSoundOn, soundSupported } from "./sound";
import { useQueryClient } from "@tanstack/react-query";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** The person's own choices: kinds × (in the app, on devices), quiet hours, this device (FR-012–FR-015). */
export function NotificationSettingsSection() {
  const { t } = useTranslation();
  const settings = useNotificationSettings();
  if (settings.isPending) return <ActivityIndicator color={colors.primary} accessibilityLabel={t("common.loading")} />;
  if (settings.isError) return <Text style={styles.error}>{settings.error.message}</Text>;
  return <SettingsEditor key={JSON.stringify(settings.data)} settings={settings.data} />;
}

function SettingsEditor({ settings }: { settings: NotificationSettings }) {
  const { t } = useTranslation();
  const save = useSaveNotificationSettings();
  const [kinds, setKinds] = useState(settings.kinds);
  const [quiet, setQuiet] = useState(settings.quietHours);
  const quietValid = HHMM.test(quiet.from) && HHMM.test(quiet.to);

  const setKind = (kind: string, field: "inApp" | "push", value: boolean) =>
    setKinds((ks) => ks.map((k) => (k.kind === kind ? { ...k, [field]: value } : k)));

  return (
    <>
      <Text style={styles.heading} accessibilityRole="header">
        {t("notifications.settings")}
      </Text>
      <ThisDevice vapidPublicKey={settings.vapidPublicKey} />
      <Sound />
      <Card>
        <View style={styles.row}>
          <Text style={styles.label} />
          <Text style={styles.column}>{t("notifications.inApp")}</Text>
          <Text style={styles.column}>{t("notifications.push")}</Text>
        </View>
        {kinds
          .filter((k) => k.allowed)
          .map((k) => (
            <View key={k.kind} style={styles.row}>
              <Text style={styles.label}>{t(`notifications.kind.${k.kind}`)}</Text>
              <View style={styles.column}>
                <Switch
                  accessibilityLabel={`${t(`notifications.kind.${k.kind}`)}: ${t("notifications.inApp")}`}
                  value={k.inApp}
                  onValueChange={(v) => setKind(k.kind, "inApp", v)}
                />
              </View>
              <View style={styles.column}>
                <Switch
                  accessibilityLabel={`${t(`notifications.kind.${k.kind}`)}: ${t("notifications.push")}`}
                  value={k.push}
                  onValueChange={(v) => setKind(k.kind, "push", v)}
                />
              </View>
            </View>
          ))}
        {/* the cron time is fixed and does not follow the owner's cut-off (research N8) */}
        <Text style={styles.note}>{t("notifications.summaryHint")}</Text>
      </Card>
      <Card>
        <View style={styles.row}>
          <Text style={styles.label}>{t("notifications.quiet")}</Text>
          <Switch
            accessibilityLabel={t("notifications.quiet")}
            value={quiet.enabled}
            onValueChange={(enabled) => setQuiet((q) => ({ ...q, enabled }))}
          />
        </View>
        {quiet.enabled ? (
          <View style={styles.times}>
            <View style={styles.time}>
              <TextField
                label={t("notifications.quietFrom")}
                value={quiet.from}
                onChangeText={(from) => setQuiet((q) => ({ ...q, from }))}
                placeholder="20:00"
              />
            </View>
            <View style={styles.time}>
              <TextField
                label={t("notifications.quietTo")}
                value={quiet.to}
                onChangeText={(to) => setQuiet((q) => ({ ...q, to }))}
                placeholder="04:00"
              />
            </View>
          </View>
        ) : null}
        <Text style={styles.note}>{t("notifications.quietHint")}</Text>
        {quietValid ? null : <Text style={styles.error}>{t("notifications.quietInvalid")}</Text>}
      </Card>
      {save.error ? <Text style={styles.error}>{save.error.message}</Text> : null}
      {save.isSuccess ? <Text style={styles.ok}>{t("notifications.saved")}</Text> : null}
      <Button
        label={t("notifications.save")}
        busy={save.isPending}
        disabled={!quietValid}
        onPress={() =>
          save.mutate({ kinds: kinds.map(({ kind, inApp, push }) => ({ kind, inApp, push })), quietHours: quiet })
        }
      />
    </>
  );
}

/** The banner's sound on this device, with a test that also unlocks audio in the browser (FR-023). */
function Sound() {
  const { t } = useTranslation();
  const [on, setOn] = useState(isSoundOn);
  if (!soundSupported)
    return (
      <Card>
        <Text style={styles.label}>{t("notifications.sound.title")}</Text>
        <Text style={styles.note}>{t("notifications.sound.unsupported")}</Text>
      </Card>
    );
  return (
    <Card>
      <View style={styles.row}>
        <Text style={styles.label}>{t("notifications.sound.title")}</Text>
        <Switch
          accessibilityLabel={t("notifications.sound.title")}
          value={on}
          onValueChange={(v) => {
            setSoundOn(v);
            setOn(v);
          }}
        />
      </View>
      <Text style={styles.note}>{t("notifications.sound.hint")}</Text>
      <Button label={t("notifications.sound.test")} variant="secondary" onPress={playChime} />
    </Card>
  );
}

/** "Zapnout upozornění v tomto zařízení" with the test notification, or why it cannot be (FR-009, FR-013). */
function ThisDevice({ vapidPublicKey }: { vapidPublicKey: string | null }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const support = deviceSupport();
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "busy" | "test_sent" | "test_failed" | "denied" | "failed">("idle");

  useEffect(() => {
    void currentEndpoint().then(setEndpoint);
  }, []);

  const refresh = async () => {
    setEndpoint(await currentEndpoint());
    await queryClient.invalidateQueries({ queryKey: notificationKeys.settings });
  };

  const turnOn = async (key: string) => {
    setState("busy");
    try {
      const r = await enableDevice(key);
      setState(r.testSent ? "test_sent" : "test_failed");
    } catch (e) {
      setState(e instanceof Error && e.message === "denied" ? "denied" : "failed");
    }
    await refresh();
  };

  const turnOff = async () => {
    setState("busy");
    await disableDevice();
    setState("idle");
    await refresh();
  };

  let content;
  if (support === "ios_home_screen") content = <Text style={styles.note}>{t("notifications.device.iosHint")}</Text>;
  else if (support === "unsupported")
    content = <Text style={styles.note}>{t("notifications.device.unsupported")}</Text>;
  else if (!vapidPublicKey) content = <Text style={styles.note}>{t("notifications.device.serverOff")}</Text>;
  else
    content = (
      <>
        <Text style={styles.note}>{endpoint ? t("notifications.device.on") : t("notifications.device.off")}</Text>
        {endpoint ? (
          <Button
            label={t("notifications.device.disable")}
            variant="secondary"
            busy={state === "busy"}
            onPress={() => void turnOff()}
          />
        ) : (
          <Button
            label={t("notifications.device.enable")}
            busy={state === "busy"}
            onPress={() => void turnOn(vapidPublicKey)}
          />
        )}
        {state === "test_sent" ? <Text style={styles.ok}>{t("notifications.device.testSent")}</Text> : null}
        {state === "test_failed" ? <Text style={styles.error}>{t("notifications.device.testFailed")}</Text> : null}
        {state === "denied" ? <Text style={styles.error}>{t("notifications.device.denied")}</Text> : null}
        {state === "failed" ? <Text style={styles.error}>{t("notifications.device.failed")}</Text> : null}
      </>
    );

  return (
    <Card>
      <Text style={styles.label}>{t("notifications.device.title")}</Text>
      {content}
    </Card>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: font.body + 4, fontWeight: "700", color: colors.text, marginTop: space.md },
  error: { fontSize: font.body, color: colors.danger },
  ok: { fontSize: font.body, color: "#166534" },
  note: { fontSize: font.label, color: colors.muted },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: space.xs },
  label: { flex: 1, fontSize: font.body, color: colors.text },
  column: { width: 84, alignItems: "center", textAlign: "center", fontSize: font.label, color: colors.muted },
  times: { flexDirection: "row", gap: space.md },
  time: { flex: 1 },
});
