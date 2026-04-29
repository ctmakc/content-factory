# Eval Product Notes

Date: 2026-04-04

Quick outside references reviewed while shaping `content-factory`:

- Promptfoo: datasets, matrix evals, side-by-side comparisons, CI-friendly config, resumable runs
  - https://github.com/promptfoo/promptfoo
  - https://www.promptfoo.dev/docs/configuration/guide/
- Langfuse: prompt management, tracing, datasets, scores, experiment-oriented workflow
  - https://static.langfuse.com/langfuse_overview_oct_25_24.pdf
- ChainForge: prompt/model comparison, visual experimentation, flow export
  - https://docs.trychainforge.ai/getting_started/
  - https://arxiv.org/abs/2309.09128

What those tools consistently do well:

- Treat prompts as first-class assets, not loose text blobs.
- Tie experiments to datasets/examples instead of one-off manual runs.
- Preserve run history and make comparisons easy to scan.
- Support both human scoring and automated evaluation.
- Export artifacts cleanly so experiments can move between local work, CI, and sharing.

What `content-factory` already has now:

- Local prompt battles and side-by-side review
- Human evaluation with stored scores and winners
- Workspace review desk with run/article diffing
- Experiments workbench for publication tests
- Payload previews and manual export bundles for publishing lanes

Best next product gaps to close:

- Prompt registry with version labels and promotion flow (`draft -> tested -> winner -> default`)
- Dataset/test-case layer for repeatable battles beyond single topics
- Auto-scoring hooks (lint rules, banned phrase checks, structural checks)
- Release snapshots for a full experiment set, not just individual articles
- Publish adapters and rank snapshot jobs once tokens are added
