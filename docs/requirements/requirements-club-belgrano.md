# Requirements Analysis: App Tenis – Club Belgrano

This document analyzes the requirements for the Tennis Club Management App for Club Belgrano, General Belgrano, BS. AS.

## 1. Problem Statement Brief

**Situation:** The Club Belgrano has 5 clay tennis courts (polvo de ladrillo) that require a management system for bookings, payments, and memberships.
**Complication:** Currently, managing different player types (members, non-members), various membership plans (monthly, per match), and manual debt tracking is complex and prone to errors.
**Question:** How can we provide a simple yet robust platform to handle bookings, financial reporting, and administrative control?
**Answer:** A mobile-first web application that allows users to book courts easily while giving administrators full control over confirmed bookings, debts, and monthly parameters.

## 2. Need Hierarchy

### Core Needs (Must Have)
*   **Booking Engine:** 5 courts, 90-minute slots (configurable), single/double types.
*   **Admin Confirmation Flow:** Bookings are "Pending" until an admin confirms them, which then triggers debt/credit usage.
*   **Membership Management:** Monthly active/inactive status, "Abono Libre" (unlimited), and "Abono por Partidos" (5/10 credits).
*   **Pricing Matrix:** Proportional costs based on player type (Member, Non-member) and match type (Single, Double).
*   **Debt & Payment Tracking:** Internal current account (cuenta corriente) for each user/guest.
*   **Administrative Record-keeping:** Blocking courts for tournaments, maintenance, or classes.

### Secondary Needs (Should Have)
*   **Financial Reports:** Monthly revenue, morphing/debtor lists, court usage statistics.
*   **In-App Notifications:** Alerts for confirmation, cancellation, and low credit.
*   **Monthly Parameterization:** Admin sets prices and rules once a month, which remain frozen until the next month.

### Future/Deferred Needs (Could Have)
*   **External Payment Gateways:** Integration with services like Mercado Pago.
*   **Push/Email Notifications.**
*   **Scalability to other sports.**

## 3. Constraint Inventory & Assumption Map

| Constraint | Category | Details |
| :--- | :--- | :--- |
| **Language** | Operational | Code in English, Application in Spanish. |
| **User Base** | Performance | Support for 100–300 concurrent users. |
| **Financial** | Business | No external payment gateway for now (manual marking by admin). |
| **Time Period** | Logic | Membership and parameters are based on "Calendar Month". |

### Assumptions
*   **Assumption:** Administrators have constant access to confirm bookings. (Validated: This is a core part of the ERS).
*   **Assumption:** "90 minutes" is the default duration but can be changed monthly. (Validated).
*   **Assumption:** Users don't need to be registered to request a booking (Guest access). (Validated).

## 4. Scope Definition (V1/MVP)

The MVP will focus on the core booking flow and administrative control.

### In Scope
*   Authentication for Admins and Members.
*   Guest booking flow (name entry).
*   Court calendar (Daily/Weekly/Monthly views).
*   Booking confirmation/cancellation logic.
*   Monthly parameter configuration tool.
*   Debt management dashboard for Admins.
*   "My Matches" and "My Membership" views for Socio.

### Out of Scope for MVP
*   Real-time push notifications.
*   Automatic payment processing.
*   Advanced user profiles (only basic info needed for identification).

## 5. Validated Requirements Document (Summary)

The system will be a web-based platform with two main roles: **Administrator** and **Socio/No Socio**. 
The central logic revolves around the **Calendar Month**, where prices and rules are set at the beginning. 
The **Administrator** acts as a gatekeeper, confirming bookings which in turn triggers the financial logic (discounting credits or generating debt).
The system must handle **Single (2 players)** and **Double (4 players)** matches, calculating costs proportionally for each participant based on their status (Abonado Libre, Abonado x Partidos, Socio Sin Abono, No Socio).
Manual marking of payments by the admin will manage the "Cuenta Corriente".
