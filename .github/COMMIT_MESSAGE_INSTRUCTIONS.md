# COMMIT_MESSAGE_INSTRUCTIONS.md

Generate Git commit messages from the staged diff only.

## Output Format

Use Conventional Commits:

```text
<type>(<scope>): <summary>
```

Without scope:

```text
<type>: <summary>
```

With body when needed:

```text
<type>(<scope>): <summary>

- <body item>
- <body item>
```

Return only the commit message. Do not include explanations, alternatives,
labels, comments, or surrounding Markdown code fences.

## Language

Use English only.

## Source of Truth

Use only the staged diff.

Do not invent:

- Reasons
- Intentions
- Tickets or issue IDs
- Business impact
- User impact
- External context

Describe what changed, not why it changed.

## First Line Rules

The first line is required.

Rules:

- Maximum 72 characters.
- Use one allowed type.
- Use a scope only when it improves clarity.
- Use a factual summary.
- Prefer imperative mood.
- Start the summary with a lowercase verb when possible.
- No trailing period.
- No emojis.
- No Markdown formatting.
- Do not mention files unless needed for clarity.

The summary should complete this sentence:

```text
If applied, this commit will <summary>
```

## Allowed Types

Use exactly one of these types:

| Type       | Meaning                                                    |
| ---------- | ---------------------------------------------------------- |
| `feat`     | Adds a new capability                                      |
| `fix`      | Fixes broken behavior                                      |
| `refactor` | Restructures code without behavior change                  |
| `perf`     | Improves performance                                       |
| `test`     | Adds or changes tests only                                 |
| `docs`     | Changes documentation only                                 |
| `build`    | Changes dependencies, build tools, packaging, or lockfiles |
| `ci`       | Changes CI/CD workflows or automation                      |
| `chore`    | Maintenance that fits no better type                       |
| `revert`   | Reverts a previous change                                  |

## Type Selection

Choose the most specific valid type.

Priority:

1. `revert`
2. `feat`
3. `fix`
4. `perf`
5. `refactor`
6. `test`
7. `docs`
8. `ci`
9. `build`
10. `chore`

Use `chore` only when no better type applies.

## Scope Rules

Scope is optional.

Use a scope when the change clearly belongs to a component, module, package,
domain, feature area, layer, or tool.

Rules:

- Use lowercase.
- Use kebab-case.
- Keep it short.
- Prefer existing project terminology.
- Avoid vague scopes such as `misc`, `stuff`, `general`, or `changes`.
- Omit the scope if no clear useful scope exists.

Examples:

```text
feat(auth): add refresh token rotation
fix(api): handle empty pagination results
refactor(user-service): extract profile mapping logic
docs(readme): update setup instructions
```

## Summary Rules

The summary is the text after the colon.

Rules:

- Prefer 50 characters or fewer.
- Never exceed the 72-character first-line limit.
- Be specific and factual.
- Describe the direct result of the staged diff.
- Use imperative mood when natural.
- Start with a lowercase verb when possible.
- No trailing period.
- Avoid vague words like `stuff`, `changes`, `updates`, `cleanup`, or
  `improvements`.

Good:

```text
fix(auth): reject expired access tokens
feat(billing): add invoice export endpoint
refactor(cache): remove duplicated lookup logic
```

Bad:

```text
fix: stuff
feat: update files
chore: various improvements
fix(auth): fixed bug.
```

## Body Rules

Add a body only when the staged diff contains multiple independent changes or
the first line is not enough.

The body must be a bullet list:

```text
- Add token family tracking
- Reject reuse of revoked refresh tokens
- Update tests for invalid token rotation
```

Rules:

- One concrete change per bullet.
- Start each bullet with a capital letter.
- Maximum 72 characters per line.
- Be factual and diff-based.
- Do not repeat the summary.
- Do not explain motivation unless it is shown in the diff.
- Prefer 2 to 5 bullets.
- Omit the body for simple single-purpose changes.

## Breaking Changes

If the staged diff clearly introduces a breaking change, add `!`:

```text
feat(api)!: remove legacy user lookup endpoint
```

The body must include a bullet starting with `BREAKING CHANGE:`:

```text
feat(api)!: remove legacy user lookup endpoint

- BREAKING CHANGE: remove support for legacy user lookup requests
- Replace legacy lookup handling with the account resolver
```

Use `!` only when compatibility is clearly affected.

## Reverts

Use `revert` only when the staged diff clearly reverts a previous change.

```text
revert(auth): revert refresh token rotation
```

Rules:

- Do not invent the original commit hash.
- Do not invent the original summary.
- Add a body only if the revert contains multiple concrete changes.

## Multi-Change Diffs

If multiple independent changes exist, choose the primary type based on the most
important production-relevant change and describe the rest in the body.

Example:

```text
feat(auth): add refresh token rotation

- Add refresh token family tracking
- Reject reuse of revoked refresh tokens
- Update token rotation tests
```

If there is no clear primary change, use the best available type and a concise,
meaningful summary.

## Final Validation

Before returning the commit message, verify:

- It is based only on the staged diff.
- It is English.
- The first line uses Conventional Commits.
- The type is allowed.
- The scope is valid if present.
- The first line is 72 characters or fewer.
- The summary is factual and specific.
- The summary has no trailing period.
- The body is only used when useful.
- Body lines are bullet points and 72 characters or fewer.
- No invented context is included.
- Only the commit message is returned.
