# Quickstart: verify notifications (002)

## Prerequisites

- 001 running locally (`npm run dev`, staff app on `:8081`) or the deployment.
- VAPID keys, created by the owner once: `npx web-push generate-vapid-keys`, then in
  `apps/web/.env.local` and in Vercel: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
  `VAPID_SUBJECT=mailto:<owner's address>`. Without them device notifications are off and say so;
  in-app notifications work.
- Two staff accounts signed in (owner and employee), in two browsers or profiles.

## Verify

| #   | Scenario                                                                                   | Expected                                                                                                    | Covers         |
| --- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- | -------------- |
| 1   | `npm test`                                                                                 | core rules (recipients, quiet hours, texts without personal data), repositories, routes, UI green           | FR-001–FR-016  |
| 2   | Call the bakery, ask for a person, give a name                                             | both accounts: bell counter +1 within 30 s; the list shows "Nový požadavek…"; tapping opens it in Požadavky | US1, SC-001    |
| 3   | Mark the request "vyřízeno" in one account                                                 | the other account's counter drops within 30 s                                                               | FR-003, SC-002 |
| 4   | In one account: 🔔 → Upozornění → "Zapnout upozornění v tomto zařízení", allow             | a test notification arrives; repeat 2 → a device notification without the customer's name or number         | FR-009, FR-010 |
| 5   | Set quiet hours to cover now, repeat 2                                                     | no device notification; the app shows it                                                                    | FR-015         |
| 6   | `curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/plan-summary`, twice | the owner gets one summary for the next open day; the second call creates none                              | US2, FR-005    |
| 7   | Sign out on the device with notifications, repeat 2                                        | that device gets nothing                                                                                    | FR-012         |
| 8   | Open the app on an iPhone in Safari without adding it to the home screen                   | the app explains how to turn notifications on                                                               | FR-013         |
| 9   | Provoz (owner)                                                                             | delivery failures counted (0 when all went through)                                                         | FR-011, SC-006 |
| 10  | As staff, add an order for the summary's day (after 6)                                     | the other account gets "Plán na … se změnil"                                                                | FR-018         |
| 11  | As staff, order 36 Kmínový chléb (limit 40) for one day                                    | the owner gets "Kmínový chléb: zbývá 4 ks", once                                                            | FR-017         |

### Amendment 2026-11-25 — new orders and the banner

| #   | Scenario                                                           | Expected                                                                                      | Covers         |
| --- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- | -------------- |
| 12  | Owner and employee have the app open; a customer orders on the web | both: a banner from the top within 10 s with number, name, day, items, total, channel + sound | FR-020–FR-023  |
| 13  | Leave the banner                                                   | it slides away after ~30 s; the notification stays unread in the list                         | FR-021         |
| 14  | Tap a banner                                                       | the order opens; the counter drops by one                                                     | FR-022         |
| 15  | The employee enters an order at the counter                        | the owner gets the banner, the employee does not                                              | FR-020, SC-008 |
| 16  | Turn "Zvuk" off in settings; reload the app after a new order      | banners without sound; nothing replays after the reload                                       | FR-023, FR-024 |
