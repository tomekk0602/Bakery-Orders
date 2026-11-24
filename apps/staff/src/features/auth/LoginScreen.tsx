import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text } from "react-native";
import { z } from "zod";
import { authClient } from "@/shared/auth/client";
import { Button, colors, font, Screen, TextField } from "@/shared/ui";

const LoginForm = z.object({ email: z.email("login.invalidEmail"), password: z.string().min(1, "login.passwordRequired") });
type LoginForm = z.infer<typeof LoginForm>;

export function LoginScreen() {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  const { control, handleSubmit, formState } = useForm<LoginForm>({ resolver: zodResolver(LoginForm), defaultValues: { email: "", password: "" } });

  const submit = handleSubmit(async ({ email, password }) => {
    setFailed(false);
    const { error } = await authClient.signIn.email({ email, password });
    // On success the session changes and the router guard opens the app.
    if (error) setFailed(true);
  });

  return (
    <Screen title={t("login.title")}>
      <Text style={styles.subtitle}>{t("app.title")}</Text>
      <Controller
        control={control}
        name="email"
        render={({ field, fieldState }) => (
          <TextField label={t("login.email")} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} autoCapitalize="none" autoComplete="email" keyboardType="email-address" error={fieldState.error?.message ? t(fieldState.error.message) : undefined} />
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field, fieldState }) => (
          <TextField label={t("login.password")} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} secureTextEntry autoComplete="current-password" onSubmitEditing={() => void submit()} error={fieldState.error?.message ? t(fieldState.error.message) : undefined} />
        )}
      />
      {failed ? (
        <Text style={styles.failed} accessibilityRole="alert">
          {t("login.failed")}
        </Text>
      ) : null}
      <Button label={t("login.submit")} onPress={() => void submit()} busy={formState.isSubmitting} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: { fontSize: font.body, color: colors.muted },
  failed: { color: colors.danger, fontSize: font.body },
});
