import type { Locale } from "@aegis/contracts";
import type { EmailBrand } from "../components/layout";
import type { EmailMessages } from "../messages/index";

/** What every template receives: its own data plus the instance and language it is written for. */
export interface TemplateProps<TData> {
	data: TData;
	messages: EmailMessages;
	locale: Locale;
	brand: EmailBrand;
}
