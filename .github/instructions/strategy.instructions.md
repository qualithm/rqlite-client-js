---
description: "Qualithm's product strategy and how the repos serve it, so any change stays aligned"
applyTo: "**"
---

# Strategy

The durable "why" behind everything in the Qualithm codebase, so any change — in any repo — can be
checked against it. It is **not** project state: what's in flight lives on the board and in
Decisions (see `project-context.instructions.md`). It changes rarely.

Structured as a strategy kernel — the challenge (**diagnosis**), our approach to it (**guiding
policy**), and what that commits us to do and not do.

## Ambition

Grow the market for connected products — make people who _wouldn't otherwise_ build one able and
willing to. Not to win existing buyers away from other platforms, but to **expand who gets to
participate at all**. Success is someone shipping a connected product who never could have before,
because they didn't have to become an expert to do it.

## Diagnosis

Building a connected product forces an overwhelming pile of expert decisions — hardware,
connectivity, security, data infrastructure, cost — across domains no one person masters. That
burden, not any competitor, is the obstacle: it keeps most would-be builders from ever starting, and
even the "easy" platforms still assume you already are a hardware or embedded team. The barrier is
expertise, and the barrier is the enemy.

## Guiding policy

Make the hard, risky, easy-to-get-wrong decisions **on the builder's behalf** — opinionated, managed
defaults tuned for cost, security, and low barrier to entry — so shipping a connected product needs
no specialist team. Qualithm holds the opinion so the builder doesn't have to. This is deliberately
a paved road, not a toolbox.

Two proximate objectives keep it concrete:

- **The non-expert developer.** A software developer with no embedded or cloud-infra background
  ships a working connected product over a weekend, writing only application code and touching zero
  infra, security, or connectivity configuration.
- **The agent.** An AI coding agent, told only "add device telemetry to my app", provisions and
  ships it through Qualithm with no human infra/security decisions and no failed configuration
  steps.

## Agent-native

AI agents are first-class builders, not an afterthought — a named pillar, because it is where the
ambition compounds. The same opinionation that lets a non-expert human ship is the single best
predictor of an agent succeeding: every decision removed is a place the agent can no longer go
wrong. A toolbox has a low agent success rate; a paved road has a high one — one design serves both.

- **The intersection to own:** when an agent (or agent-assisted developer) needs to add
  connected-device or telemetry capability to what it is building, Qualithm is the default it
  reaches for — the one option it can wire up end-to-end, safely, without human-expert decisions.
- **The surface:** `operator-mcp` is a first-class product entry point, not internal tooling —
  agent-native provisioning with a uniform result envelope, per-call dry-run, and stable error codes
  so an agent can plan, act, verify, and self-correct. Human and agent surfaces never diverge.
- **The edge we have:** Qualithm is itself built by a factory of autonomous agents, so we learn
  agent ergonomics first-hand and feed them back into the product. We build _with_ agents, so we
  know how to be built _by_ them — an instinct a conventionally-built competitor does not develop.

## What this commits us to

Weigh every change against the guiding policy with one test: **does this reduce the decisions a
non-expert (or their agent) must make, or add them?** Fewer is coherent; more, however powerful, is
not.

Do:

- Choose optimized, safe defaults for cost, security, and accessibility; hide operational and
  economic complexity rather than exposing it.
- Keep surfaces machine-legible — typed SDKs, MCP, structured docs — with one happy path, idempotent
  operations, dry-run, and legible errors so both humans and agents can self-correct.
- Be discoverable where builders and agents reach (npm `@qualithm/*`, MCP registries, guides).

Don't (these non-goals are part of the strategy, not omissions):

- **Expose every knob.** Opinionated, not infinitely configurable. The builder who wants full
  control belongs on a hyperscaler or DIY stack — letting them go is _how_ we stay simple for
  everyone else.
- **Sell primitives.** We sell shipped outcomes, not a box of parts to assemble.
- **Chase the constrained-firmware layer.** Qualithm's devices are software-capable (gateways,
  edge/Linux-class, application) — not 32KB microcontrollers. We don't compete for the bare-metal
  embedded engineer.

## Why this holds

The value exists only when _every_ decision is good _together_ — cost and security and accessibility
and connectivity and data, as one coherent whole. That is hard, and the difficulty is the point: a
competitor cannot half-copy it or bolt one piece on. Growth is a consequence of removing the
barrier, never the goal itself.

The engine behind the economics — the storage and analytics stack — stays behind the curtain. It is
_how_ we can afford to make good decisions on the builder's behalf, not the pitch. Nobody chooses
Qualithm for the database; they choose it because they shipped without becoming an expert.

## What Qualithm is

The product surfaces an agent may touch, named by what they do for the builder, not by their
internals:

- **Connect** — `device-sdk-js`, `mqtt-wire-js`: get any software-capable device sending data over
  standard MQTT-over-TLS, provisioned with certificates.
- **Store and query** — the telemetry data platform (`varv-rs`, `sagitta-rs`, the
  `arrow-flight-client-js` / `kafka-client-js` / `rqlite-client-js` clients, and the `logql-syntax`
  / `traceql-syntax` / `ratatoskr-go` parsers): where device data lands and becomes queryable.
  Means, not message — see "Why this holds".
- **Use and control** — `platform` (API), `app` (dashboard), `id` (auth), and `operator-go` /
  `operator-mcp` (the human and agent control surfaces).
- **Reach** — `website`, `docs`.

How Qualithm is _built_ (the software factory — `mill`, `millwright`, `wheelhouse`, `dx` — and
shared `ui` / `cloud`) is means, not product: see `project-context.instructions.md`, not here.

## How components derive from strategy

The strategy doesn't enumerate components — they change; it doesn't. But every component must trace
back to it by **absorbing a decision or operational burden the builder would otherwise carry**. Two
tests decide whether one belongs:

- **Which promise does it uphold** — accessibility, cost, security, or reliability? If you can't
  name one, it doesn't belong.
- **Build or adopt?** Adopt a standard when it already upholds the promise; build only when the
  promise can't be bought — above all the cost/scale curve, which _is_ the product and can't be
  outsourced.

Per-component rationale (why Kubernetes, why rqlite, why build `varv`) lives in Decisions, each
deriving from this policy — not here.

## Where live context lives

Strategy, not status. For what's being worked on, what's `Ready` to pick up, and the decisions new
work builds on, see `project-context.instructions.md` (the Engineering board and Decisions
discussions). Give durable "why" a home here or in a Decision — never leave it only in chat.
