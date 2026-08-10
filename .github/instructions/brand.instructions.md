---
description:
  "Brand strategy: positioning, voice, and the constraints a palette, typeface, or asset must
  satisfy"
applyTo: "**"
---

# Brand

The brand reference for every surface Qualithm ships — UI copy, docs, marketing, error messages,
assets. Category guides (`content-marketing`, `content-legal`, `content-docs`) specialize this voice
for their content type; they never redefine it. Concrete visual values live in `ui/tokens.json` and
nowhere else — never restate a hex value, font name, or pixel size here or in any other prose file
(Decision qualithm/discussions#172).

## Positioning

Qualithm makes connected products shippable by people who couldn't otherwise build one. The full
strategy is `strategy.instructions.md`; what brand copy must never contradict:

- The builder is a software developer with no embedded or cloud-infra background — or an AI agent
  acting for one. Never address hardware or embedded teams.
- We sell shipped outcomes, not primitives and not a toolbox. The builder who wants full control
  belongs on a hyperscaler; say so rather than competing for them.
- Say "connected products", never "IoT".
- The storage and analytics engine stays behind the curtain. Nobody chooses Qualithm for the
  database; don't pitch it.

## Voice

- **Decide, don't offer.** State the one happy path. Never hand the builder a menu of options — the
  choice was already made on their behalf.
- **Reassure by removing decisions, not by asserting confidence.** "TLS is already configured"
  reassures; "enterprise-grade security" does not.
- **Never perform expertise.** No jargon the reader doesn't need, no caveats that protect the writer
  rather than inform the reader, no "simply".
- **Outcomes, not category.** Lead with what the builder shipped or can now do, not with what class
  of product Qualithm is.
- **Non-expert without condescension.** Assume a competent developer who hasn't done this before,
  not a beginner. Explain the unfamiliar; never explain the obvious.
- **Claims carry numbers.** Source every number from its system of record (`pricing.ts`,
  `tokens.json`, the API) so it can't go stale and can't be invented. A claim with no verifiable
  number is an adjective — cut it.
- **Survive literal parsing.** Agents and non-native speakers read verbatim: no irony, no idiom, no
  metaphor that fails when read literally.
- **Terse.** Cut anything that doesn't change what the reader does.
- **Human and agent surfaces never diverge.** The same words serve docs, UI, CLI, and MCP output; if
  a sentence only works spoken aloud, rewrite it.

## Anti-voice

Never sound like:

- **The enterprise vendor** — "leverage", "best-in-class", "mission-critical", "solutions".
- **The hype launch** — "revolutionary", "game-changing", "blazingly fast", exclamation marks.
- **The toolbox** — feature lists as value; "flexible", "powerful", "configurable" as praise.
- **The insider** — acronyms without expansion, assumed context, cleverness the reader must decode.
- **The apology** — hedging a good default with "just", "only", "basic" instead of stating it.

## Rhetorical devices

Allowed, sparingly:

- Direct address — "you" for the builder; "we" only for decisions Qualithm made on their behalf.
- A question that names the builder's ambition ("What would you build if connecting it were easy?"),
  answered immediately.
- Understatement — a fact stated plainly beats the same fact intensified.

Not allowed:

- Rhetorical questions the text doesn't answer.
- Puns, wordplay on the Qualithm name, personification of the product.
- Superlatives, intensifiers ("very", "really"), exclamation marks.
- False scarcity or urgency.

## Naming

Register follows distance from the builder:

- **Builder-facing** products take literal names: `platform`, `id`, `app`, `docs`.
- **Software-factory** tooling takes the workshop metaphor: `mill`, `millwright`, `wheelhouse`.
- **Engine components** behind the curtain take evocative borrowings: `varv`, `sagitta`,
  `ratatoskr`.

The closer to the builder, the plainer the name. A new builder-facing name must be literal; never
coin a metaphor for something the builder touches.

## Visual surfaces

Any palette, typeface, or asset must:

- Be authored only in `ui/tokens.json` and reach every surface as a generated artifact — product UI,
  email, browser chrome, installed-app identity, social cards. Never hand-copy a value into a
  consumer.
- Stay legible for the non-expert: accessible contrast, readable at the smallest shipped size, no
  meaning carried by colour alone.
- Survive the voice test: an asset that needs adjectives to defend it ("modern", "friendly") is not
  done.

CLI output is deliberately untokenised — no colour or brand treatment in `dx`, `operator-go`, or
`operator-mcp` output (Decision #172 accepts this).

## Litmus

Before trusting the voice on a marketing surface, test it on a non-marketing one:

- SDK error: ~~"We encountered an issue while processing your request"~~ → "claim code expired"
- Deprecation notice: ~~"We're excited to announce improvements to our API"~~ → "`connectWithToken`
  is removed in v2.0. Use `connect`."
