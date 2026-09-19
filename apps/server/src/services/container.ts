import type { FastifyBaseLogger } from "fastify";
import type { AppConfig } from "../config.js";
import { Encryptor } from "../crypto/encryption.js";
import { PasswordHasher } from "../crypto/passwords.js";
import type { Database } from "../db/database.js";
import { SecondFactorCookie } from "../http/second-factor-cookie.js";
import { SessionCookie } from "../http/session-cookie.js";
import { OidcRuntime } from "../oidc/runtime.js";
import { AuditLog } from "../repositories/audit.js";
import { AvatarRepository } from "../repositories/avatars.js";
import { ClientAssignmentRepository } from "../repositories/client-assignments.js";
import { ClientLogoRepository } from "../repositories/client-logos.js";
import { ClientRepository } from "../repositories/clients.js";
import { ConsentRepository } from "../repositories/consents.js";
import { KeyRepository } from "../repositories/keys.js";
import { OidcArtifactRepository } from "../repositories/oidc-artifacts.js";
import { RecoveryCodeRepository } from "../repositories/recovery-codes.js";
import { SessionRepository } from "../repositories/sessions.js";
import { SettingsRepository } from "../repositories/settings.js";
import { UserRepository } from "../repositories/users.js";
import { ApplicationAccess } from "./application-access.js";
import { AuthService } from "./auth.js";
import { AvatarService } from "./avatars.js";
import { ClientLogoService } from "./client-logos.js";
import { ClientService } from "./clients.js";
import { KeyService } from "./keys.js";
import { AccessRevoker } from "./revocation.js";
import { SecondFactorChallenges } from "./second-factor-challenges.js";
import { SetupService } from "./setup.js";
import { SignInThrottle } from "./sign-in-throttle.js";
import { TwoFactorService } from "./two-factor.js";
import { UserService } from "./users.js";

export interface AppServices {
	config: AppConfig;
	database: Database;
	log: FastifyBaseLogger;
	encryptor: Encryptor;
	passwords: PasswordHasher;
	settings: SettingsRepository;
	users: UserRepository;
	sessions: SessionRepository;
	clients: ClientRepository;
	consents: ConsentRepository;
	keys: KeyRepository;
	oidcArtifacts: OidcArtifactRepository;
	audit: AuditLog;
	avatars: AvatarRepository;
	clientLogos: ClientLogoRepository;
	clientAssignments: ClientAssignmentRepository;
	recoveryCodes: RecoveryCodeRepository;
	throttle: SignInThrottle;
	/** The session cookie, shared by the administration and application sign-ins. */
	sessionCookie: SessionCookie;
	/** Sign-ins waiting for their second factor, and the cookie that carries them. */
	secondFactorChallenges: SecondFactorChallenges;
	secondFactorCookie: SecondFactorCookie;
	applicationAccess: ApplicationAccess;
	keyService: KeyService;
	auth: AuthService;
	revoker: AccessRevoker;
	twoFactor: TwoFactorService;
	userService: UserService;
	clientService: ClientService;
	avatarService: AvatarService;
	clientLogoService: ClientLogoService;
	oidc: OidcRuntime;
	setup: SetupService;
}

export function createServices(config: AppConfig, database: Database, log: FastifyBaseLogger): AppServices {
	const encryptor = new Encryptor(config.encryptionKey);
	const passwords = new PasswordHasher(config.argon2);
	const settings = new SettingsRepository(database);
	const users = new UserRepository(database);
	const sessions = new SessionRepository(database);
	const clients = new ClientRepository(database);
	const consents = new ConsentRepository(database);
	const keys = new KeyRepository(database);
	const oidcArtifacts = new OidcArtifactRepository(database);
	const audit = new AuditLog(database);
	const avatars = new AvatarRepository(database);
	const clientLogos = new ClientLogoRepository(database);
	const clientAssignments = new ClientAssignmentRepository(database);
	const recoveryCodes = new RecoveryCodeRepository(database);
	const throttle = new SignInThrottle();
	const sessionCookie = new SessionCookie(config.secureCookies);
	const secondFactorChallenges = new SecondFactorChallenges(encryptor);
	const secondFactorCookie = new SecondFactorCookie(config.secureCookies);
	const applicationAccess = new ApplicationAccess({ users, clients, assignments: clientAssignments });
	const keyService = new KeyService(keys, encryptor);
	const revoker = new AccessRevoker(database, { sessions, oidcArtifacts });
	const twoFactor = new TwoFactorService({ database, users, recoveryCodes, passwords, encryptor, settings, revoker, audit });
	const auth = new AuthService({ users, sessions, settings, passwords, audit, throttle, access: applicationAccess, twoFactor });
	const userService = new UserService({ database, users, passwords, revoker, audit });
	const clientService = new ClientService({
		database,
		clients,
		users,
		sessions,
		assignments: clientAssignments,
		access: applicationAccess,
		encryptor,
		revoker,
		audit,
	});
	const avatarService = new AvatarService({ database, users, avatars, audit });
	const clientLogoService = new ClientLogoService({ database, clients, logos: clientLogos, audit });
	const oidc = new OidcRuntime({
		config,
		settings,
		users,
		clients,
		consents,
		sessions,
		oidcArtifacts,
		keyService,
		encryptor,
		audit,
		auth,
		applicationAccess,
		sessionCookie,
		log,
	});
	const setup = new SetupService({
		database,
		settings,
		users,
		keys,
		keyService,
		passwords,
		audit,
		auth,
		oidc,
		log,
		auditRetentionDays: config.auditRetentionDays,
	});

	return {
		config,
		database,
		log,
		encryptor,
		passwords,
		settings,
		users,
		sessions,
		clients,
		consents,
		keys,
		oidcArtifacts,
		audit,
		avatars,
		clientLogos,
		clientAssignments,
		recoveryCodes,
		throttle,
		sessionCookie,
		secondFactorChallenges,
		secondFactorCookie,
		applicationAccess,
		keyService,
		auth,
		revoker,
		twoFactor,
		userService,
		clientService,
		avatarService,
		clientLogoService,
		oidc,
		setup,
	};
}
