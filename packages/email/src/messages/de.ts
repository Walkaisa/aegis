import type { EmailMessages } from "./types";

export const de: EmailMessages = {
	common: {
		greeting: (name) => `Hallo ${name},`,
		linkFallback: "Button funktioniert nicht? Kopiere diesen Link in deinen Browser:",
		expiresIn: (duration) => `Der Link ist ${duration} lang gültig.`,
		expiresAt: (when) => `Er läuft am ${when} ab.`,
		singleUse: "Er lässt sich nur einmal verwenden.",
		unknown: "Unbekannt",
		deviceOn: (browser, os) => `${browser} unter ${os}`,
	},
	fields: {
		requestedAt: "Angefragt",
		occurredAt: "Zeitpunkt",
		ipAddress: "IP-Adresse",
		device: "Gerät",
		currentAddress: "Aktuelle Adresse",
		newAddress: "Neue Adresse",
		server: "Server",
		encryption: "Verschlüsselung",
		sender: "Absender",
	},
	encryption: {
		starttls: "STARTTLS",
		tls: "TLS (implizit)",
		none: "Keine",
	},
	passwordReset: {
		subject: (instance) => `Passwort für ${instance} zurücksetzen`,
		preview: (duration) => `Neues Passwort wählen – der Link ist ${duration} lang gültig.`,
		heading: "Passwort zurücksetzen",
		intro: (instance) => `für dein Konto bei ${instance} wurde ein neues Passwort angefragt. Hier kannst du es festlegen:`,
		action: "Neues Passwort wählen",
		notYouTitle: "Das warst du nicht?",
		notYou: "Dann ignoriere diese Nachricht. Dein Passwort bleibt unverändert und niemand hat Zugriff auf dein Konto erhalten.",
		footer: "Du erhältst diese Nachricht, weil für diese Adresse ein neues Passwort angefragt wurde.",
	},
	passwordChanged: {
		subject: (instance) => `Dein Passwort für ${instance} wurde geändert`,
		preview: (instance) => `Das Passwort deines Kontos bei ${instance} wurde soeben geändert.`,
		heading: "Dein Passwort wurde geändert",
		intro: (instance) =>
			`das Passwort deines Kontos bei ${instance} wurde geändert. Du kannst dich ab sofort mit dem neuen Passwort anmelden.`,
		sessions: "Zur Sicherheit wurden alle anderen Sitzungen deines Kontos beendet.",
		notYouTitle: "Das warst du nicht?",
		notYou: "Dann ist dein Konto möglicherweise kompromittiert. Setze das Passwort sofort zurück und wende dich an eine Administratorin oder einen Administrator dieser Instanz.",
		footer: "Du erhältst diese Nachricht, weil das Passwort des Kontos mit dieser Adresse geändert wurde.",
	},
	emailChangeConfirm: {
		subject: (instance) => `Neue Adresse für ${instance} bestätigen`,
		preview: (address) => `Bestätige ${address}, um die Änderung abzuschließen.`,
		heading: "Neue Adresse bestätigen",
		intro: (instance) =>
			`diese Adresse wurde als neue Anmeldeadresse eines Kontos bei ${instance} eingetragen. Bestätige sie, um die Änderung abzuschließen:`,
		action: "Adresse bestätigen",
		notYouTitle: "Das warst du nicht?",
		notYou: "Dann ignoriere diese Nachricht. Ohne deine Bestätigung ändert sich nichts und diese Adresse wird nirgends verwendet.",
		footer: "Du erhältst diese Nachricht, weil diese Adresse als neue Anmeldeadresse eingetragen wurde.",
	},
	emailChangeNotice: {
		subject: (instance) => `Die Adresse deines Kontos bei ${instance} wird geändert`,
		preview: (address) => `Es wurde eine Änderung auf ${address} angefragt.`,
		heading: "Eine neue Adresse wurde angefragt",
		intro: (instance) => `für dein Konto bei ${instance} wurde eine neue Anmeldeadresse angefragt.`,
		pending:
			"Die Änderung wird erst wirksam, wenn die neue Adresse sie bestätigt. Bis dahin meldest du dich weiterhin mit deiner aktuellen Adresse an.",
		notYouTitle: "Das warst du nicht?",
		notYou: "Ändere jetzt dein Passwort und wende dich an eine Administratorin oder einen Administrator dieser Instanz. Möglicherweise hat jemand Zugriff auf dein Konto.",
		footer: "Du erhältst diese Nachricht, weil du die aktuelle Adresse des Kontos bist.",
	},
	emailTest: {
		subject: (instance) => `Testnachricht von ${instance}`,
		preview: (instance) => `${instance} kann E-Mails versenden – hier ist der Beweis.`,
		heading: "Dein E-Mail-Server funktioniert",
		intro: (instance) =>
			`diese Testnachricht wurde aus den E-Mail-Einstellungen von ${instance} verschickt. Sie ist angekommen, die Verbindung stimmt also.`,
		capabilities: "Passwort-Zurücksetzungen und Adressbestätigungen können jetzt an deine Nutzerinnen und Nutzer zugestellt werden.",
		footer: "Du erhältst diese Nachricht, weil eine Administratorin oder ein Administrator einen Zustelltest ausgeführt hat.",
	},
};
