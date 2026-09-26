import { EmailLayout } from "../components/layout";
import { originFacts, type RequestOrigin } from "../components/origin";
import { Button, FactList, Heading, LinkFallback, Panel, Text } from "../components/primitives";
import { formatDateTime, formatDuration } from "../format";
import type { TemplateProps } from "./context";

export interface EmailChangeConfirmData {
	displayName: string;
	/** The new address, which is also the recipient of this message. */
	recipient: string;
	/** The address the account still signs in with. */
	currentEmail: string;
	url: string;
	requestedAt: Date;
	expiresAt: Date;
	origin: RequestOrigin;
}

/** Sent to the address someone wants to move an account to; the change waits for this confirmation. */
export function EmailChangeConfirm({ data, messages, locale, brand }: TemplateProps<EmailChangeConfirmData>) {
	const validity = formatDuration(data.expiresAt.getTime() - data.requestedAt.getTime(), locale);

	return (
		<EmailLayout
			brand={brand}
			locale={locale}
			title={messages.emailChangeConfirm.subject(brand.instanceName)}
			preview={messages.emailChangeConfirm.preview(data.recipient)}
			footer={messages.emailChangeConfirm.footer}
		>
			<Heading>{messages.emailChangeConfirm.heading}</Heading>
			<Text>{messages.common.greeting(data.displayName)}</Text>
			<Text>{messages.emailChangeConfirm.intro(brand.instanceName)}</Text>

			<Button href={data.url}>{messages.emailChangeConfirm.action}</Button>
			<LinkFallback label={messages.common.linkFallback} href={data.url} />

			<Text tone="muted" size="sm">
				{messages.common.expiresIn(validity)} {messages.common.expiresAt(formatDateTime(data.expiresAt, locale))}{" "}
				{messages.common.singleUse}
			</Text>

			<FactList
				items={[
					{ label: messages.fields.currentAddress, value: data.currentEmail },
					{ label: messages.fields.newAddress, value: data.recipient },
					...originFacts({ at: data.requestedAt, origin: data.origin, label: messages.fields.requestedAt }, messages, locale),
				]}
			/>

			<Panel title={messages.emailChangeConfirm.notYouTitle}>
				<Text tone="muted" size="sm" style={{ margin: 0 }}>
					{messages.emailChangeConfirm.notYou}
				</Text>
			</Panel>
		</EmailLayout>
	);
}
