/**
 * The transactional e-mails Aegis sends. Templates are React components rendered to HTML and plain
 * text by `@react-email/render`; the server only ever sees `renderEmail`.
 */
export type { EmailBrand } from "./components/layout";
export type { RequestOrigin } from "./components/origin";
export { type EmailPayload, type RenderContext, type RenderedEmail, renderEmail } from "./render";
export type {
	EmailChangeConfirmData,
	EmailChangeNoticeData,
	EmailTestData,
	PasswordChangedData,
	PasswordResetData,
} from "./templates/index";
