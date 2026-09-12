# Content Machine — Claude Design UI/UX Prompt

Design a **full high-fidelity enterprise SaaS dashboard UI/UX** for a web application called **Content Machine**, built for **PT TSI Sertifikasi Internasional**.

Content Machine is an **AI-powered Content Operations and SEO Growth System** used to manage website articles, SEO strategy, keyword monitoring, social media content, content scheduling, visual content production, analytics, approvals, and automated reporting.

The interface should feel like a **professional internal enterprise product**, not a generic marketing dashboard.

## Product Goals

The platform should help the marketing and content team:

- Research article trends
- Discover SEO opportunities
- Create and manage website articles for `tsicertification.com`
- Plan editorial strategies
- Manage content calendars
- Track target keywords
- Monitor Google search ranking performance
- Identify SEO improvement opportunities
- Manage Instagram, Facebook, and LinkedIn
- Research social media trends
- Generate social content
- Create single-post flyer visuals
- Schedule articles and social posts
- Review and approve AI-generated content
- Analyze content and social performance
- Generate automated Telegram / WhatsApp reports
- Continuously improve SEO performance based on real data

---

## Visual Direction

Create a UI that feels:

- Modern
- Corporate
- Premium
- Enterprise-grade
- Data-driven
- Clean
- Professional
- Highly readable
- Minimal but not empty
- Information-dense without feeling cluttered

Avoid playful startup aesthetics.

The product should visually resemble a combination of:

- Modern analytics SaaS
- Enterprise content management system
- SEO intelligence platform
- Editorial operating system
- AI workflow dashboard

Use a **desktop-first responsive layout**.

---

## Color System

Primary visual theme:

**White + Navy Blue**

Suggested design tokens:

- Primary Navy: `#0F2747`
- Secondary Navy: `#163B69`
- Primary Blue: `#2D6CDF`
- Soft Blue: `#EAF2FF`
- Background: `#F6F8FB`
- Surface: `#FFFFFF`
- Border: `#DCE4EE`
- Primary Text: `#17202D`
- Secondary Text: `#667085`
- Success: `#1F9D68`
- Warning: `#F2A93B`
- Danger: `#D64545`

The interface must remain primarily **white / light mode**.

Navy should be used for:

- Navigation
- Strong headings
- Primary actions
- Selected states
- Key charts

Blue should be used as an accent.

Do not overuse gradients.

---

## Typography

Use a modern SaaS typography system such as:

**Inter, Geist, SF Pro, or Plus Jakarta Sans.**

Hierarchy:

- Page Title: 28–32px, Semibold
- Section Heading: 18–22px, Semibold
- Card Heading: 15–17px, Semibold
- Body: 14–16px
- Table Text: 13–14px
- Metadata: 12–13px

Use strong contrast between:

**Primary information → supporting information → metadata.**

---

## Layout Architecture

Use:

- Fixed or collapsible left sidebar
- Top utility navigation
- Wide main workspace
- 12-column grid
- Modular card system
- Consistent 8px spacing system
- Large whitespace between major sections
- Tight spacing inside data-heavy tables
- Sticky table headers where appropriate
- Right-side contextual drawer for detail views

Recommended spacing:

- 8px micro spacing
- 16px component spacing
- 24px card spacing
- 32px section spacing
- 40–48px major page spacing

---

## Main Navigation

Create a left sidebar containing:

1. Dashboard
2. Content Planner
3. Articles
4. Social Media
5. SEO Intelligence
6. Analytics
7. Approval Queue
8. Reports
9. Media Library
10. Workflow Logs
11. Settings

Bottom section:

- Help
- Documentation
- User profile

Top navigation should contain:

- Breadcrumb
- Global search
- Date range selector
- Notifications
- Quick Create button
- User avatar

Quick Create should allow:

- New Article
- New Social Post
- New Campaign
- New Content Idea

---

# 1. Main Dashboard

Page title:

**Content Machine**

Subtitle:

**Content, SEO & Social Intelligence**

Top KPI section should contain:

- Organic Traffic
- SEO Visibility
- Keywords in Top 10
- Organic Leads
- Articles Published
- Scheduled Content
- Social Engagement
- Pending Approvals

Each KPI card should include:

- Primary metric
- Percentage change
- Trend direction
- Comparison period
- Optional mini sparkline

Example:

**Organic Traffic**

28,421

↑ 18.4% vs previous period

### SEO Visibility Trend

Use a line chart showing 30 / 90 / 180-day performance.

Provide controls:

- 30D
- 90D
- 6M
- 1Y

### AI Opportunities

Example items:

- 🔥 ISO 42001 requirements gaining visibility
- 🔥 ISO 27001 fintech keyword approaching Page 1
- ⚠ ISO 9001 article losing ranking
- ⚠ Low CTR detected on ISO certification keyword

Each recommendation should include:

- Category
- Priority
- Insight
- Recommended action
- CTA

Example CTA:

**Review Opportunity**

### Keyword Movements

Show:

- Keyword
- Current Rank
- Previous Rank
- Movement
- Search Intent
- Landing Page

Example:

- ISO 27001 Certification — #5 → #9 — ↑ 4
- ISO 14001 — #8 → #13 — ↑ 5
- ISO 9001 — #11 → #7 — ↓ 4

Use clear visual indicators:

- Green = increasing
- Red = decreasing
- Gray = stable

### Top Performing Content

Include:

- Article title
- Traffic
- Keyword position
- CTR
- Leads
- Performance change

### Content Requiring Attention

Example reasons:

- Ranking declining
- Low CTR
- Content outdated
- Keyword cannibalization
- Missing internal links

### Upcoming Content

Compact editorial schedule with:

- Publish date
- Content title
- Channel
- Owner
- Status

### Recent Agent Activity

Timeline examples:

- Research Agent discovered 12 keywords
- SEO Agent flagged 3 declining articles
- Content Agent generated draft
- Article approved by Marketing Manager
- LinkedIn post scheduled

---

# 2. Content Planner

Design a complete editorial workspace.

Top filters:

- Date
- Campaign
- Content Type
- Platform
- Status
- Priority
- Topic Cluster

Provide view switcher:

**Calendar / Kanban / List**

Calendar view should display:

- Article
- Instagram
- Facebook
- LinkedIn

Use compact channel icons.

Content items should display:

- Title
- Category
- Channel
- Status
- Priority

Kanban workflow:

**Ideas**

↓

**Researching**

↓

**Brief Ready**

↓

**Drafting**

↓

**Review**

↓

**Approved**

↓

**Scheduled**

↓

**Published**

Use draggable cards.

Each card includes:

- Title
- Keyword
- Campaign
- Platform
- Owner
- Due date
- AI status

### AI Topic Recommendations

Each recommendation includes:

- Keyword
- Search intent
- Current visibility
- Opportunity score
- Business relevance
- Recommended content type

Example:

**ISO 27001 for Fintech**

Opportunity Score: 92

Intent: Commercial Investigation

Business Relevance: High

Recommendation:

Create dedicated long-form article.

CTA:

**Create Content Brief**

---

# 3. Article Management

Create a data-heavy article management interface.

Table columns:

- Article
- Primary Keyword
- Topic Cluster
- Status
- Author
- SEO Score
- Ranking
- Organic Traffic
- Leads
- Publish Date
- Actions

Provide:

- Search
- Sorting
- Advanced filters
- Bulk actions

Clicking an article opens a right-side drawer.

Drawer tabs:

- Overview
- SEO
- Social
- Analytics
- History

### Article Overview

Include:

- Title
- URL
- Content status
- Campaign
- Primary keyword
- Secondary keywords
- Author
- Created date
- Publish date
- AI-generated summary

### Content Quality

Show circular or progress indicators for:

- SEO Score
- Readability
- Brand Compliance
- Content Completeness
- Internal Linking

Provide actions:

- Edit
- Generate Revision
- Send for Approval
- Schedule

---

# 4. Social Media

Create a social media command center.

Platform tabs:

- All
- Instagram
- Facebook
- LinkedIn

Top account summary cards:

- Instagram Followers
- LinkedIn Followers
- Facebook Followers
- Total Engagement
- Scheduled Posts

### Social Content Calendar

Show posts by platform.

### Scheduled Posts

Card layout with visual thumbnail.

Each card:

- Post preview
- Caption preview
- Platform
- Scheduled date
- Campaign
- Status

Provide post details:

- Caption
- Hashtags
- CTA
- Related Article
- Content Objective
- Target Audience

### AI Social Trend Intelligence

Examples:

- Trending sustainability topic
- ISO 42001 discussion increasing
- Cybersecurity awareness trending on LinkedIn

Recommended action:

**Create Social Content**

---

# 5. SEO Intelligence

This should be one of the most important and sophisticated screens.

Page title:

**SEO Intelligence**

Subtitle:

**Organic visibility, keyword performance and optimization opportunities**

Top KPI cards:

- Organic Traffic
- SEO Visibility
- Average Position
- Keywords Top 3
- Keywords Top 10
- Indexed Pages
- Organic CTR
- SEO Health Score

### Organic Visibility

Line chart with comparison.

Filters:

- 30 Days
- 90 Days
- 6 Months
- 12 Months

Optional comparison:

- Previous Period

## Keyword Tracker

Large enterprise table.

Columns:

- Keyword
- Current Position
- Previous Position
- Movement
- Estimated SERP Page
- Search Intent
- Landing Page
- Clicks
- Impressions
- CTR
- Opportunity Score
- Status

Example:

| Keyword | Current | Previous | Page |
|---|---:|---:|---|
| ISO 27001 Certification | 5.2 | 8.6 | Page 1 |
| ISO 42001 Indonesia | 13.8 | 22.4 | Page 2 |
| ISO 9001 Certification | 11.1 | 7.9 | Page 2 |

Status chips:

- Rising
- Dropping
- Stable
- Opportunity
- At Risk

### Keyword Distribution

Visualize:

- Top 3
- Position 4–10
- Position 11–20
- Position 21–50
- Position 51+

Use horizontal stacked bars or a clean histogram.

### SEO Opportunities

Card examples:

**Move ISO 42001 to Page 1**

Current position: 13.8

Impressions: 4,280

Opportunity: High

Suggested Action:

Update content + strengthen internal links.

### Keyword Cannibalization

Warning-style panel.

Example:

Keyword:

ISO 27001

Competing URLs:

- `/iso-27001`
- `/article/what-is-iso-27001`
- `/article/iso-27001-guide`

Recommendation:

Define primary landing page and reposition supporting articles.

### Technical SEO Health

Cards for:

- Index Issues
- Broken Links
- Missing Metadata
- Duplicate Titles
- Slow Pages
- Missing Alt Text
- Canonical Issues
- Schema Issues

Each should display:

- Count
- Severity
- Trend

## SEO Action Center

Create an operational SEO task list.

Columns:

- Priority
- Issue
- Keyword
- URL
- Recommended Action
- Impact
- Status

Example:

P1

Ranking Decline

ISO 9001

`/article/iso-9001`

Refresh content

High

Open

Use priority hierarchy:

- 🔴 P1 Critical
- 🟠 P2 Important
- 🟡 P3 Improvement

Create buttons:

- Optimize with AI
- Create Task
- View Analysis

---

# 6. Analytics

Create a unified content analytics workspace.

Top metrics:

- Organic Sessions
- Social Traffic
- Conversions
- CTA Clicks
- Leads
- Content Engagement

### Acquisition Overview

- Organic Search
- Direct
- Social
- Referral

### Content Performance

Table:

- Content
- Traffic
- Engagement
- Keywords Ranking
- Conversions
- Leads
- Performance Trend

### Conversion Funnel

Search Impression

↓

Search Click

↓

Landing Page

↓

Engaged Session

↓

CTA Click

↓

Form / WhatsApp

↓

Lead

Visualize conversion rates between each stage.

### Social Performance

Platforms:

- Instagram
- Facebook
- LinkedIn

Metrics:

- Reach
- Impressions
- Engagement
- Clicks
- Followers
- CTR

### Campaign Performance

- Campaign Name
- Content Created
- Traffic
- Engagement
- Leads
- Conversion Rate

---

# 7. Approval Queue

Create a human-in-the-loop content approval workspace.

Left side:

Pending approval list.

Right side:

Large content preview.

Show:

- Article / social preview
- AI QA score
- SEO score
- Brand compliance
- Sources checked
- Potential risks
- Content metadata

Provide prominent actions:

- Approve
- Request Revision
- Reject

### Approval Timeline

- Draft generated
- AI QA completed
- SEO review completed
- Submitted for approval
- Approved / Rejected

---

# 8. Reports

Create an executive reporting center.

Sections:

- Daily Report
- Weekly Report
- Monthly Report

Each report card should show:

- Status
- Report period
- Generated date
- Delivery channels

Delivery indicators:

- Telegram ✓
- WhatsApp ✓
- Email optional

### AI Executive Summary

Example:

Organic traffic increased 18% this week.

7 keywords entered Google's first page.

ISO 42001 content generated the highest organic growth.

ISO 9001 cluster requires attention due to declining rankings.

Recommended focus next week:

- ISO 27001 for Financial Services
- ISO 42001 Requirements
- ISO 14001 Update

---

# 9. Media Library

Use a clean grid layout.

Categories:

- Flyer
- Article Image
- Social Media
- Templates
- Brand Assets

Provide:

- Search
- Filter
- Tags
- Upload button

Asset card should display:

- Thumbnail
- File name
- Type
- Dimensions
- Usage
- Created date

---

# 10. Workflow Logs

Design a technical but readable automation monitoring screen.

Columns:

- Workflow
- Trigger
- Status
- Started
- Duration
- Agent
- Result

Statuses:

- Success
- Running
- Failed
- Waiting for Approval

Expandable rows should show:

- Execution details
- n8n workflow reference
- Input
- Output
- Error
- Retry attempt

Prominent actions:

- Retry
- View Details

---

# 11. Settings

Create settings categories:

## Brand

- Brand tone
- Company information
- Visual guidelines
- CTA rules

## SEO

- Tracked keywords
- Priority clusters
- Competitors
- SEO goals
- Target countries

## Social Accounts

- Instagram
- Facebook
- LinkedIn

## Automation

- n8n connection
- Cron schedules
- Workflow triggers
- Retry logic

## AI

- AI model
- Knowledge base
- Prompt templates
- Agent behavior

## Approval Rules

- Auto approval
- Manual approval
- High-risk content
- Publishing restrictions

## Reporting

- Telegram
- WhatsApp
- Daily report
- Weekly report
- Monthly report

---

# Design System Components

Create a coherent reusable component library containing:

- Buttons
- Icon buttons
- Input
- Search
- Dropdown
- Multi-select
- Date picker
- Tabs
- Status chips
- Badges
- KPI cards
- Insight cards
- Recommendation cards
- Tables
- Pagination
- Charts
- Calendar
- Kanban
- Modals
- Drawers
- Toast notifications
- Empty states
- Skeleton loading states
- Error states
- Tooltips
- Confirmation dialogs

---

# UI Hierarchy

Strictly follow this hierarchy:

## Level 1 — Strategic Information

- Page title
- Primary metrics
- Main performance chart
- Critical AI insights

## Level 2 — Operational Information

- Tables
- Content schedule
- Keyword performance
- Recommendations
- Tasks

## Level 3 — Supporting Information

- Metadata
- Status
- Tags
- Helper text
- Secondary metrics

Important information must have stronger:

- Contrast
- Spacing
- Visual weight
- Positioning

Do not rely only on colors to communicate meaning.

---

# UX Principles

The dashboard must prioritize:

**Clarity over decoration**

**Action over passive analytics**

**Insights over raw metrics**

**Context over isolated numbers**

**Human control over blind AI automation**

A user should always understand:

1. What happened?
2. Why did it happen?
3. Is it good or bad?
4. What should be done next?
5. Can AI execute the recommended action?

---

# AI UX Pattern

AI should feel integrated into the product rather than appearing as a generic chatbot.

Use contextual AI features such as:

- AI Recommendation
- AI Opportunity
- AI SEO Analysis
- AI Content Brief
- AI Suggested Action
- AI Performance Summary

Example AI recommendation card:

**High SEO Opportunity**

ISO 42001 Requirements

Current Position: 13.8

Impressions: 4,280

Potential Impact: High

Recommendation:

Expand the existing article, improve internal links and add a FAQ section.

Actions:

- Optimize with AI
- Review Analysis

---

# Interaction Design

Demonstrate states for:

- Hover
- Active
- Selected
- Disabled
- Loading
- Empty
- Error
- Success

Tables should support:

- Sorting
- Filtering
- Search
- Pagination
- Column configuration
- Expandable rows

Use right-side drawers for contextual detail instead of constantly navigating to another page.

Use modal dialogs only for focused actions.

---

# Responsive Behavior

Desktop is the primary platform.

Target widths:

- Desktop: 1440px
- Large desktop: 1920px
- Tablet: 1024px

On smaller screens:

- Collapse sidebar
- Convert large tables into scrollable layouts
- Stack dashboard cards
- Preserve primary actions
- Avoid hiding critical information

---

# Accessibility

Follow WCAG-friendly standards.

Ensure:

- Strong contrast
- Readable font sizes
- Clear focus states
- Keyboard navigation
- Descriptive icons
- Buttons always include labels when meaning is ambiguous
- Status is never communicated only through color

---

# Final Deliverable

Create a **complete multi-screen high-fidelity dashboard design system and product UI** for Content Machine.

The result should feel like a production-ready enterprise application combining:

**Content Operations + SEO Intelligence + Social Media Management + Analytics + AI Automation.**

The visual experience should be:

**White, Navy Blue, Clean, Corporate, Premium, Structured, Data-Driven and Highly Usable.**

Prioritize strong **UI hierarchy, UX clarity, data visualization, operational workflows, SEO intelligence and contextual AI recommendations**.

The final design should be detailed enough to serve as a direct reference for frontend implementation.
