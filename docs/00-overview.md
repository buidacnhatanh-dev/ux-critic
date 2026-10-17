# 00 · Overview

## What it is

A private tool to review my own designs. I drop in a screenshot, the tool measures what can be measured and evaluates the rest against named UX principles, then marks every note on the screenshot. I can push back on any note and say why, and compare a new version with the previous one.

It has two modes. Live mode runs on my laptop with my own Claude API key. Demo mode is online for my portfolio: anyone can click through prepared sample reviews, with no key and no cost (docs/10).

## Who uses it

Me, a UX designer and frontend developer, reviewing:

* app and web screens I designed (Figma exports)
* screens of things I built (browser screenshots)
* new versions of the same screen after fixing issues

## The core idea: measured and evaluated

| | Measured | Evaluated |
|---|---|---|
| What | Contrast ratio, target size, text size | Clarity, hierarchy, labels, choices, feedback, consistency |
| How | Code reads the pixels | Claude, against a named principle |
| Label in UI | Measured · "Measured from pixels" | Evaluated · "Based on …" · "Confidence: high/medium/low" |
| Can be wrong? | Only if the text or control was found in the wrong place | Yes, so I can push back |

## Principles it checks

Nielsen's 10 heuristics, WCAG 2.2 level AA (the parts visible in a screenshot), Laws of UX, and my own checklist rules. Catalogue with ids: `docs/05-principles.md`.

## Screens (15, see design/)

Main flow: Projects, Project history, New review, Review, Compare versions, My checklist.
States: First use, Connect Claude, Reviewing, Review failed, Evaluation unreadable, No issues found, Form errors, Edit a rule, Delete a project.

## In scope for v1

* Projects with versions, one screenshot per version
* Review pipeline: find text, measure, evaluate, place notes
* Push back with a reason, undo
* Compare two versions of a project
* My checklist: principle sets on or off, own rules (measured or evaluated)
* Evaluation harness that measures how good the reviews are
* Online demo with sample projects, deployed on Vercel

## Not in v1

* Accounts, sharing reviews, a public live mode, mobile layout beyond basic reflow
* Figma plugin or URL capture (screenshots only)
* Several screens per review, flows
* Any single overall score

## Success looks like

* I use it on my own projects, such as NeighborGoods, and fix real issues
* The evaluation harness shows how many planted issues it finds and how many it invents, and those numbers go into the case study
