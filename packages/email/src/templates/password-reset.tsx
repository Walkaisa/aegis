import { EmailLayout } from "../components/layout";
import { originFacts, type RequestOrigin } from "../components/origin";
import { Button, FactList, Heading, LinkFallback, Panel, Text } from "../components/primitives";
import { formatDateTime, formatDuration } from "../format";
import type { TemplateProps } from "./context";

export interface PasswordResetData {
	displayName: string;
	/** The address this message goes to. */
	recipient: string;
	/** Absolute URL of the reset page, including the one-time token. */
	url: string;
	requestedAt: Date;
	expiresAt: Date;
	origin: RequestOrigin;
}

/** Sent to an account's own address after someone asked for a password reset on the sign-in page. */
export function PasswordReset({ data, messages, locale, brand }: TemplateProps<PasswordResetData>) {
	const validity = formatDuration(data.expiresAt.getTime() - data.requestedAt.getTime(), locale);

	return (
		<EmailLayout
			brand={brand}
			locale={locale}
			title={messages.passwordReset.subject(brand.instanceName)}
			preview={messages.passwordReset.preview(validity)}
			footer={messages.passwordReset.footer}
		>
			<Heading>{messages.passwordReset.heading}</Heading>
			<Text>{messages.common.greeting(data.displayName)}</Text>
			<Text>{messages.passwordReset.intro(brand.instanceName)}</Text>

			<Button href={data.url}>{messages.passwordReset.action}</Button>
			<LinkFallback label={messages.common.linkFallback} href={data.url} />

			<Text tone="muted" size="sm">
				{messages.common.expiresIn(validity)} {messages.common.expiresAt(formatDateTime(data.expiresAt, locale))}{" "}
				{messages.common.singleUse}
			</Text>

			<FactList
				items={originFacts({ at: data.requestedAt, origin: data.origin, label: messages.fields.requestedAt }, messages, locale)}
			/>

			<Panel title={messages.passwordReset.notYouTitle}>
				<Text tone="muted" size="sm" style={{ margin: 0 }}>
					{messages.passwordReset.notYou}
				</Text>
			</Panel>
		</EmailLayout>
	);
}
