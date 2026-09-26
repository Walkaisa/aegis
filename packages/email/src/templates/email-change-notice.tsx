import { EmailLayout } from "../components/layout";
import { originFacts, type RequestOrigin } from "../components/origin";
import { FactList, Heading, Panel, Text } from "../components/primitives";
import type { TemplateProps } from "./context";

export interface EmailChangeNoticeData {
	displayName: string;
	/** The current address, which still owns the account until the change is confirmed. */
	recipient: string;
	newEmail: string;
	requestedAt: Date;
	origin: RequestOrigin;
}

/**
 * Sent to the address an account currently uses as soon as a change is requested — early enough
 * for its owner to react while the old address still works.
 */
export function EmailChangeNotice({ data, messages, locale, brand }: TemplateProps<EmailChangeNoticeData>) {
	return (
		<EmailLayout
			brand={brand}
			locale={locale}
			title={messages.emailChangeNotice.subject(brand.instanceName)}
			preview={messages.emailChangeNotice.preview(data.newEmail)}
			footer={messages.emailChangeNotice.footer}
		>
			<Heading>{messages.emailChangeNotice.heading}</Heading>
			<Text>{messages.common.greeting(data.displayName)}</Text>
			<Text>{messages.emailChangeNotice.intro(brand.instanceName)}</Text>

			<FactList
				items={[
					{ label: messages.fields.currentAddress, value: data.recipient },
					{ label: messages.fields.newAddress, value: data.newEmail },
					...originFacts({ at: data.requestedAt, origin: data.origin, label: messages.fields.requestedAt }, messages, locale),
				]}
			/>

			<Text tone="muted" size="sm">
				{messages.emailChangeNotice.pending}
			</Text>

			<Panel title={messages.emailChangeNotice.notYouTitle}>
				<Text tone="muted" size="sm" style={{ margin: 0 }}>
					{messages.emailChangeNotice.notYou}
				</Text>
			</Panel>
		</EmailLayout>
	);
}
