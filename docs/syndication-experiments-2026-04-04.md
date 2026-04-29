# Syndication Experiment Notes

Date: 2026-04-04

## Core Constraint

Do not design this around a fake idea of "forced indexing everywhere".

- For Google, the Indexing API is officially limited to pages that contain `JobPosting` or `BroadcastEvent` in a `VideoObject`.
- For normal article URLs, the practical official path is the URL Inspection / recrawl workflow for properties you manage.
- That means third-party platforms like Medium are poor candidates for "forced indexing" automation if you do not control the Search Console property.

## Platform Direction

### Better candidates

- `DEV / Forem`
  - official article API
  - documented `canonical_url`
  - easier to automate publication experiments

- `Hashnode`
  - supports canonical/original URL
  - better for republishing experiments where you want canonical control

### Weaker candidate

- `Medium`
  - useful for distribution reach
  - weaker operational control for indexing experiments
  - not a good foundation for automated recrawl / indexing workflow unless the goal is just distribution, not controlled SEO testing

## Product Implication

The `Experiments` module should model this flow:

1. choose article and platform
2. publish or record external publish URL
3. store canonical/original URL if supported
4. store Search Console property only when owned/verified
5. track index status and rank measurements over time
6. compare outcomes by platform, project, and prompt/source article

## Immediate Next Integrations

- DEV / Forem publish adapter
- Hashnode publish adapter
- Search Console property-aware status checks
- rank snapshot logging by query / country / device
