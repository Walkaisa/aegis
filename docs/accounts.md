# Accounts

## Roles

Every account has one of two roles, and roles build on each other: an administrator can do
everything a user can.

| | User | Administrator |
| --- | --- | --- |
| Sign in to applications | The ones it has access to | All of them |
| Manage Aegis | No | Yes |
| Created by | Administrator | Setup or another administrator |

The role can be changed later. Doing so ends all sessions of that account. The last active
administrator can't be deleted, disabled or turned into a user.

## Access to applications

Every application decides on its **Access** tab who may sign in:

- **All accounts**: every active account, the default.
- **Assigned accounts only**: the accounts assigned on the same tab. Assignments can also be managed
  per account on its **Applications** tab.

Administrators may always sign in. When access is restricted or an assignment is removed, affected
accounts are signed out of that application right away and their tokens are revoked. Someone without
access who tries to sign in sees a notice, and the attempt shows up in the audit log.

## Managing accounts

Under **Users** administrators can create accounts with a generated or chosen password, edit names
and email addresses, reset passwords, upload profile pictures, disable and delete accounts.

A disabled account can't sign in anymore, and all of its sessions end immediately.

## Two-factor authentication

Every account can protect its sign-in with a second factor: a six-digit code from an authenticator app
(TOTP, RFC 6238). It is set up under **Settings → My account → Two-factor authentication**, in three
steps: confirm the password, scan the QR code with the app and confirm the first code.

Once it is on, every sign-in asks for a code after the password — in the administration as well as in
every application. Enabling it ends all other sessions of the account, because those were started with
the password alone.

Aegis issues ten **recovery codes** with the setup. Each of them replaces one code from the app exactly
once, for when the phone is gone. They are shown once and can be downloaded; new ones can be created at
any time, which invalidates the previous ones.

If someone loses both their device and their recovery codes, an administrator can reset the second
factor on the account's **Settings** tab. The account then signs in with its password alone again until
it sets up a new authenticator. Administrators can't reset their own second factor this way; they turn
it off in their account settings with password and code.

## Profile pictures

Pictures can be uploaded as PNG, JPEG or WebP and cropped right in the browser. Aegis re-encodes every
upload to a square WebP and removes all metadata such as location data. Applications receive the
picture through the `picture` claim.

## Sessions

One sign-in covers the administration and all applications: an administrator who is signed in can
open an application without entering the password again, and signing out ends both.

**Sessions** shows every signed-in browser with device, IP address and the applications it uses. A
session confirmed with a second factor is marked as such.
Administrators can end a session at any time. On an application's page they can also end the sign-in
of a single session or revoke access for everyone at once.

## Audit log

Every sign-in, every change and every rejected request is recorded with who did it, from which device
and how important it is. Entries are kept for 180 days by default; the retention can be changed on the
audit log page.
