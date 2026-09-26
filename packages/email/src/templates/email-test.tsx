import type { SmtpSecurity } from "@aegis/contracts";
import { EmailLayout } from "../components/layout";
import { FactList, Heading, Text } from "../components/primitives";
import { formatDateTime } from "../format";
import type { TemplateProps } from "./context";

export interface EmailTestData {
	displayName: string;
	recipient: string;
	sentAt: Date;
	server: string;
	security: SmtpSecurity;
	/** The `From` header this instance sends with. */
	sender: string;
}

/** Sent by the delivery test in the e-mail settings; proves the whole path, not just the handshake. */
export function EmailTest({ data, messages, locale, brand }: TemplateProps<EmailTestData>) {
	return (
		<EmailLayout
			brand={brand}
			locale={locale}
			title={messages.emailTest.subject(brand.instanceName)}
			preview={messages.emailTest.preview(brand.instanceName)}
			footer={messages.emailTest.footer}
		>
			<Heading>{messages.emailTest.heading}</Heading>
			<Text>{messages.common.greeting(data.displayName)}</Text>
			<Text>{messages.emailTest.intro(brand.instanceName)}</Text>
			<Text tone="muted" size="sm">
				{messages.emailTest.capabilities}
			</Text>

			<FactList
				items={[
					{ label: messages.fields.server, value: data.server },
					{ label: messages.fields.encryption, value: messages.encryption[data.security] },
					{ label: messages.fields.sender, value: data.sender },
					{ label: messages.fields.occurredAt, value: formatDateTime(data.sentAt, locale) },
				]}
			/>
		</EmailLayout>
	);
}
