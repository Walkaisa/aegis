import type { Locale } from "@aegis/contracts";
import type { ReactElement } from "react";
import type { EmailBrand } from "./components/layout";
import { type EmailMessages, messagesFor } from "./messages/index";
import { EmailChangeConfirm, type EmailChangeConfirmData } from "./templates/email-change-confirm";
import { EmailChangeNotice, type EmailChangeNoticeData } from "./templates/email-change-notice";
import { EmailTest, type EmailTestData } from "./templates/email-test";
import { PasswordChanged, type PasswordChangedData } from "./templates/password-changed";
import { PasswordReset, type PasswordResetData } from "./templates/password-reset";

/**
 * A message to send, identified by its template. The union keeps every call site honest: the data
 * a template needs is the data it must be given.
 */
export type EmailPayload =
	| { template: "password_reset"; data: PasswordResetData }
	| { template: "password_changed"; data: PasswordChangedData }
	| { template: "email_change_confirm"; data: EmailChangeConfirmData }
	| { template: "email_change_notice"; data: EmailChangeNoticeData }
	| { template: "email_test"; data: EmailTestData };

export interface RenderContext {
	brand: EmailBrand;
	locale: Locale;
}

export interface RenderedEmail {
	subject: string;
	html: string;
	/** The plain-text alternative, derived from the same markup. */
	text: string;
	/** The address the message is written to. */
	recipient: string;
}

interface Rendered {
	subject: string;
	element: ReactElement;
}

function build(payload: EmailPayload, messages: EmailMessages, context: RenderContext): Rendered {
	const props = { messages, locale: context.locale, brand: context.brand };
	const instance = context.brand.instanceName;

	switch (payload.template) {
		case "password_reset":
			return { subject: messages.passwordReset.subject(instance), element: <PasswordReset data={payload.data} {...props} /> };
		case "password_changed":
			return { subject: messages.passwordChanged.subject(instance), element: <PasswordChanged data={payload.data} {...props} /> };
		case "email_change_confirm":
			return {
				subject: messages.emailChangeConfirm.subject(instance),
				element: <EmailChangeConfirm data={payload.data} {...props} />,
			};
		case "email_change_notice":
			return {
				subject: messages.emailChangeNotice.subject(instance),
				element: <EmailChangeNotice data={payload.data} {...props} />,
			};
		case "email_test":
			return { subject: messages.emailTest.subject(instance), element: <EmailTest data={payload.data} {...props} /> };
	}
}

/**
 * `@react-email/render` pulls in React DOM and a formatter, which is a lot to parse for a server
 * that may never send a single message. It is loaded the first time one is rendered and kept.
 */
let renderer: Promise<typeof import("@react-email/render")> | null = null;

function loadRenderer() {
	renderer ??= import("@react-email/render");
	return renderer;
}

/** Renders a message to the subject, HTML body and plain-text alternative it is sent with. */
export async function renderEmail(payload: EmailPayload, context: RenderContext): Promise<RenderedEmail> {
	const messages = messagesFor(context.locale);
	const { subject, element } = build(payload, messages, context);
	const { render, toPlainText } = await loadRenderer();

	// Rendered once; the text part is derived from the same markup, so the two can never drift.
	const html = await render(element, { pretty: false });
	const text = toPlainText(html);

	return { subject, html, text, recipient: payload.data.recipient };
}
