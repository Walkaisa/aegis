import { createTranslator } from "next-intl";
import de from "@/messages/de.json";
import en from "@/messages/en.json";

export const MESSAGES = { de, en } as const;

/** The English messages with their placeholders filled in, e.g. `translate("users.created", { name })`. */
export const translate = createTranslator({ locale: "en", messages: en });
