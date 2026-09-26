import { EmailLayout } from "../components/layout";
import { originFacts, type RequestOrigin } from "../components/origin";
import { FactList, Heading, Panel, Text } from "../components/primitives";
import type { TemplateProps } from "./context";

export interface PasswordChangedData {
	displayName: string;
	recipient: string;
	changedAt: Date;
	origin: RequestOrigin;
}

/**
 * Sent after a password has actually changed — through a reset link or from the account settings.
 * A notification the owner did not trigger is the earliest sign that an account was taken over.
 */
export function PasswordChanged({ data, messages, locale, brand }: TemplateProps<PasswordChangedData>) {
	return (
		<EmailLayout
			brand={brand}
			locale={locale}
			title={messages.passwordChanged.subject(brand.instanceName)}
			preview={messages.passwordChanged.preview(brand.instanceName)}
			footer={messages.passwordChanged.footer}
		>
			<Heading>{messages.passwordChanged.heading}</Heading>
			<Text>{messages.common.greeting(data.displayName)}</Text>
			<Text>{messages.passwordChanged.intro(brand.instanceName)}</Text>
			<Text tone="muted" size="sm">
				{messages.passwordChanged.sessions}
			</Text>

			<FactList
				items={originFacts({ at: data.changedAt, origin: data.origin, label: messages.fields.occurredAt }, messages, locale)}
			/>

			<Panel title={messages.passwordChanged.notYouTitle}>
				<Text tone="muted" size="sm" style={{ margin: 0 }}>
					{messages.passwordChanged.notYou}
				</Text>
			</Panel>
		</EmailLayout>
	);
}
