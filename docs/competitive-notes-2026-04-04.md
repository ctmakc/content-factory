# Competitive Notes

Date: 2026-04-04

Short notes from reviewing adjacent open-source prompt/content workflow tools.

## Useful Patterns

- `promptfoo`
  Pattern to borrow: prompt experiments should be explicit test artifacts, not ad hoc files. The useful idea is a prompt matrix with structured evaluation and repeatable runs.

- `Langfuse`
  Pattern to borrow: prompt registry and version history matter. Prompts should be manageable assets with durable names, metadata, and evaluation context.

- `ChainForge`
  Pattern to borrow: side-by-side comparison is not enough by itself; experiments benefit from parameterized prompt variants and clearer response comparison surfaces.

## What We Already Added

- prompt battle catalog
- persistent candidate evaluations
- winner marking
- workspace review flow
- article compare/diff view

## High-Value Next Features

- prompt registry page with named presets and notes
- dataset-backed battle runs instead of single-topic-only battles
- reusable quality gates by project
- experiment export/import
- review queues with ownership / status

## Product Direction

The product should behave less like a generic chat wrapper and more like an internal editorial lab:

- launch controlled runs
- compare artifacts
- score outputs
- choose winners
- feed those decisions back into prompt presets and project workflows
