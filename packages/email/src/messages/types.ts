/**
 * Every string a message can contain, as typed functions rather than an ICU dictionary: the
 * templates are TypeScript, so the compiler can check the placeholders instead of a format parser
 * discovering a typo at send time.
 */
export interface EmailMessages {
	/** Shared wording: greeting, link fallback, how long a link stays valid, the request origin. */
	common: {
		greeting: (name: string) => string;
		linkFallback: string;
		expiresIn: (duration: string) => string;
		expiresAt: (when: string) => string;
		singleUse: string;
		unknown: string;
		deviceOn: (browser: string, os: string) => string;
	};
	fields: {
		requestedAt: string;
		occurredAt: string;
		ipAddress: string;
		device: string;
		currentAddress: string;
		newAddress: string;
		server: string;
		encryption: string;
		sender: string;
	};
	encryption: {
		starttls: string;
		tls: string;
		none: string;
	};
	passwordReset: {
		subject: (instance: string) => string;
		preview: (duration: string) => string;
		heading: string;
		intro: (instance: string) => string;
		action: string;
		notYouTitle: string;
		notYou: string;
		footer: string;
	};
	passwordChanged: {
		subject: (instance: string) => string;
		preview: (instance: string) => string;
		heading: string;
		intro: (instance: string) => string;
		sessions: string;
		notYouTitle: string;
		notYou: string;
		footer: string;
	};
	emailChangeConfirm: {
		subject: (instance: string) => string;
		preview: (address: string) => string;
		heading: string;
		intro: (instance: string) => string;
		action: string;
		notYouTitle: string;
		notYou: string;
		footer: string;
	};
	emailChangeNotice: {
		subject: (instance: string) => string;
		preview: (address: string) => string;
		heading: string;
		intro: (instance: string) => string;
		pending: string;
		notYouTitle: string;
		notYou: string;
		footer: string;
	};
	emailTest: {
		subject: (instance: string) => string;
		preview: (instance: string) => string;
		heading: string;
		intro: (instance: string) => string;
		capabilities: string;
		footer: string;
	};
}
