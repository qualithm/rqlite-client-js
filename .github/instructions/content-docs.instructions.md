---
description:
  "Prose documentation style: specializes the brand voice for docs pages and READMEs (not code
  comments, owned per-archetype)"
applyTo: "**"
---

# Content Style: Documentation

Prose documentation: the `docs` repo's pages and every repo's README. This specializes
`brand.instructions.md`'s voice for one content category (Decision qualithm/discussions#200) —
positioning, voice, anti-voice, and rhetorical devices are settled there and are not restated. What
follows is how that voice produces documentation specifically. Agent-authoritative once landed.

Code comments are out of scope: comment style stays owned by each archetype's
`copilot-instructions.md`. This guide never duplicates those rules.

## Principles

- **Task-first.** Organize by what the reader is trying to do, not by what the product is. A heading
  names the task — "Connect a device" — never the abstraction ("Device connectivity").
- **One path.** Document the one happy path. A real choice gets a recommendation, not a menu of
  options (brand: decide, don't offer).
- **Active voice, present tense, second person.** "The gateway rejects the token", "you receive a
  credential" — not "the token is rejected", not "the user receives".
- **One concept per sentence.** If a sentence joins two ideas with "and", split it. If it needs a
  semicolon, split it.
- **Prerequisites before steps.** State what must be true before the first step, in the order the
  reader needs it. No forward references.
- **Samples run as-is.** Every command or code block works when copied verbatim. Placeholders are
  visibly named (`<your-claim-code>`), never silently interpolated.
- **Explain the unfamiliar, never the obvious.** The reader is a competent developer who hasn't done
  this before (brand: non-expert without condescension). Explain what a claim code is; don't explain
  what an environment variable is.
- **Numbers from the system of record.** Limits, defaults, and versions are interpolated from
  `pricing.ts`, config, or the API — never hardcoded into prose where they go stale.

## Anti-patterns

- No "simply", "just", or "easy" (brand anti-voice).
- No "note that", "it is important to", "as mentioned above".
- No hedged instructions ("you may want to", "it might be a good idea") — state the step or cut it.
- No documenting internals the reader can't act on: implementation history, who built what, why a
  section exists.

## READMEs

A README answers two questions in order: what this is, then how to use it. Open with the one-line
description (matching the repo's canonical description — see `project-description.instructions.md`),
then installation and the first working command. Anything else — architecture, contributing process,
roadmap — earns its place only if a new reader's first run needs it.
