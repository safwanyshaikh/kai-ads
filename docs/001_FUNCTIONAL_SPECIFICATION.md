# KAI ADS

# Functional Specification

Version : 1.1

Status : DRAFT — subordinate to `docs/009_KAI_ADS_SUPREME_CONSTITUTION.md`

Owner : Product Architecture

> **Amendment 1 (July 2026, product owner):** the Review Screen and Style
> Selection steps below are SUPERSEDED by the Sprint 006 workflow replacement
> and Supreme Constitution Principle 13 (Zero Friction): the shipped flow is
> Paste/Upload → AI Extraction → Truth Brain → Creative Director → Generate →
> Advertisement Canvas, with every block edited in place on the canvas and a
> manual form appearing ONLY as the exception path when extraction cannot
> ground the required facts. The superseded sections are preserved below for
> historical context.

---

# Purpose

This document defines exactly how KAI Ads behaves.

Claude Code must implement this specification.

Lovable must design according to this specification.

Neither may invent new workflows.

---

# Primary Goal

A recruiter should generate a professional overseas recruitment advertisement in less than 60 seconds.

---

# User Journey

Agency Registration

↓

KAI Approval

↓

Agency Activation

↓

Employee Login

↓

Dashboard

↓

Create Advertisement

↓

AI Analysis

↓

Review

↓

Select Style

↓

Generate Advertisement

↓

Edit Sections

↓

Export

↓

Advertisement Library

---

# Screen 1

Landing Page

Purpose

Introduce KAI Ads.

Actions

Login

Register Agency

Learn More

Pricing

---

# Screen 2

Agency Registration

Fields

Agency Name

Registration Number

Official Website

Official Email

Logo

Secondary Logo (optional)

Submit

Status

Pending Approval

---

# Validation

Registration Number mandatory

Business Email mandatory

Logo mandatory

Official Website mandatory

Reject personal email domains.

---

# Screen 3

Pending Approval

Message

Your agency is under verification.

No platform access until approval.

---

# Screen 4

Login

Methods

Google Workspace

Microsoft 365

Magic Link

No password.

---

# Screen 5

Dashboard

Cards

Create Advertisement

My Advertisements

Credits

Contacts

Agency

Recent Projects

---

# Screen 6

Create Advertisement

Methods

Paste Text

Upload PDF

Upload DOCX

Upload Image

Paste WhatsApp

Paste Email

---

# AI Processing

Extract

Country

Employer

Industry

Positions

Salary

Benefits

Interview

Age

Experience

Language

---

# Review Screen

*(SUPERSEDED — see Amendment 1 in the header. There is no Review form step;
the AI auto-publishes and the recruiter edits exceptions on the Canvas.)*

Every extracted field is editable.

Approve

Generate

Back

---

# Style Selection

Visual

Typography

Newspaper (DTP)

---

# Advertisement Generation

AI generates

Headline

Subheadline

Layout

Images

Summary

Footer

Trust Stamp

---

# Section Editing

Header

Industry

Positions

Benefits

Interview

Footer

Only regenerate selected section.

---

# Export

WhatsApp

Facebook

Instagram

LinkedIn

PDF

---

# Credits

One advertisement equals one credit.

Regenerating one section consumes no additional credit.

Generating a completely new advertisement consumes one credit.

---

# Advertisement Library

Search

Duplicate

Archive

Delete

Export Again

---

# Contact Directory

Saved Contacts

Name

Mobile

Email

WhatsApp

One click selection.

---

# AI Rules

Never hallucinate.

Never invent salary.

Never invent employer.

Never invent dates.

Missing information

↓

Information Required

---

# Success

Advertisement created.

Saved automatically.

Ready for export.

END