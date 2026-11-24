import { useTranslation } from "react-i18next";
import { Text } from "react-native";
import { colors, font, Screen } from "@/shared/ui";

/** Placeholder for a tab whose feature is built in a later step of the staff app pass (tasks.md). */
export function ComingSoonScreen({ titleKey }: { titleKey: string }) {
  const { t } = useTranslation();
  return (
    <Screen title={t(titleKey)}>
      <Text style={{ fontSize: font.body, color: colors.muted }}>{t("common.comingSoon")}</Text>
    </Screen>
  );
}
