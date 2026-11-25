# Feature Specification: Notifications for the bakery's staff

**Feature Branch**: `002-staff-notifications`

**Created**: 2026-11-24

**Status**: Draft

**Input**: Owner, 2026-11-24: staff should be notified, in the app and as push notifications on their
devices. Decided with the owner: a notification exists to make someone act, not to report everything;
the first stage covers customers' requests and the next day's baking summary, in the app and as
browser notifications; quiet hours 20:00–04:00 by default; the owner's "assistant is down" alert
breaks quiet hours; native app push waits for a native build. Builds on spec 001 (requests FR-008,
FR-034, FR-041; the baking plan FR-010; roles FR-043–FR-045).

**Amended 2026-11-25** (owner, after testing stage 1): every new order must reach the staff as well,
and while the app is open a notification must slide in from the top of the screen as a banner with
the order's details and a sound, stay about 30 seconds and slide away; tapping it opens the order.
Every staff member gets new orders except the one who entered it. User Story 5, FR-020–FR-026.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Staff hear about a customer's request at once (Priority: P1)

A customer asks the phone assistant to be called back, or to change or cancel an order. Today the
request waits in the "Požadavky" tab until someone happens to open it. With this feature every staff
member who can handle requests sees it straight away — in the app and, where they allowed it, as a
notification on their device — and as soon as one of them handles it, it disappears for everyone.

**Why this priority**: a request is a customer waiting for a person; it is the only event where a
delay costs a customer. It also closes the loop the assistant opens when it says "a colleague will
call you".

**Independent Test**: make a call that ends in a callback request; every signed-in staff account sees
a new notification and a raised counter; one of them marks the request handled; the notification is
gone for all of them.

**Acceptance Scenarios**:

1. **Given** two staff members signed in and a third with device notifications on, **When** the
   assistant records a callback request, **Then** all three get one notification for it, and the
   device notification says only what kind of request it is, never the customer's name or number.
2. **Given** a request notified to three people, **When** one of them marks the request handled,
   **Then** the notification is marked read for all three and no one's counter counts it.
3. **Given** the device notification is tapped, **When** the app opens, **Then** it shows that
   request in "Požadavky".
4. **Given** quiet hours are on for a person, **When** a request arrives at 22:00, **Then** that
   person gets no device notification, and the notification waits in the app.

---

### User Story 2 - The owner gets tomorrow's baking summary when orders close (Priority: P1)

When orders for the next open day close, the owner gets one notification: how many orders there are
for that day and what most needs baking. Tapping it opens the baking plan for that day.

**Why this priority**: the second half of the bakery's problem — "working out what to bake" — happens
exactly at this moment; one message a day replaces dozens about single orders.

**Independent Test**: after the cut-off time, the owner's app shows one summary for the next open day
with the order count and the top products; running the daily job again does not add a second one.

**Acceptance Scenarios**:

1. **Given** orders close at 14:00 the day before, **When** the daily summary runs after 14:00,
   **Then** the owner gets one notification for the next open day: the number of orders and the three
   products with the most to bake.
2. **Given** the summary already went out for that day, **When** the job runs again, **Then** no second
   summary is created.
3. **Given** there are no orders for the next open day, **When** the summary runs, **Then** it still
   goes out, saying there are no orders and only the walk-in estimate is planned — silence would look
   like a failure.
4. **Given** an employee switched the summary on in their own settings, **When** it runs, **Then** they
   get it too; employees do not get it by default.

---

### User Story 3 - Everyone decides what reaches them (Priority: P2)

Each staff member, in either role, opens "Nastavení upozornění" and decides for each kind of
notification whether they want it in the app and on this device, turns device notifications on or off
for the device they are using, and sets their quiet hours.

**Why this priority**: bakers sleep in the day and work at night; without control people switch
notifications off entirely, and then nothing reaches them.

**Independent Test**: an employee turns device notifications on, gets a test notification, sets quiet
hours, turns a kind off, and stops receiving that kind.

**Acceptance Scenarios**:

1. **Given** a staff member presses "Zapnout upozornění v tomto zařízení", **When** they allow it in the
   browser, **Then** this device is registered and a test notification arrives at once.
2. **Given** they refuse the browser's permission, **When** the app learns it, **Then** it says device
   notifications are off and how to allow them later; notifications still appear in the app.
3. **Given** an iPhone or iPad where the app is not added to the home screen, **When** they try to turn
   device notifications on, **Then** the app explains that they must first add it to the home screen.
4. **Given** a staff member signs out on a device, **When** a request arrives later, **Then** that
   device gets nothing.

---

### User Story 4 - The owner is warned about what needs a decision (Priority: P3, stage 2)

The owner is told when a product is close to its daily limit, when staff add an order for a day whose
plan is already closed, and when the phone assistant stops working (for example the model's quota is
used up). The last one is urgent and reaches the owner even in quiet hours.

**Why this priority**: useful, but each is less frequent and less urgent than a waiting customer; it
follows once stage 1 is measured.

**Independent Test**: reserve a product up to 90% of its limit; the owner gets one warning for that
product and day; a failed call start because of the model's quota warns the owner once within an hour.

**Acceptance Scenarios**:

1. **Given** a product's reservations reach the warning share of its daily limit, **When** the order
   is saved, **Then** the owner gets one warning for that product and day, not one per order.
2. **Given** the assistant cannot start calls, **When** it fails repeatedly within an hour, **Then** the
   owner gets one alert in that hour, also during quiet hours.
3. **Given** the plan for tomorrow has closed, **When** a staff member adds an order for tomorrow,
   **Then** the other staff members are told the plan changed.

---

### User Story 5 - Staff see every new order the moment it arrives (Priority: P1, amended 2026-11-25)

While the staff app is open, a new order — by phone, from the web form, or entered by a colleague —
slides in from the top of the screen as a banner with a short sound. The banner shows who ordered,
for which day, what and for how much. It stays about 30 seconds and slides away, or the staff member
taps it and the order opens. The same order also lands in the notification list and, where allowed,
on the person's devices.

**Why this priority**: the owner tested stage 1 and expects the counter staff to notice orders as they
come in, the way a dispatcher notices a new ride; a list that someone must open is not enough.

**Independent Test**: two staff accounts open the app; a customer orders through the web form; within
10 seconds both see a banner with the order's details and hear a sound; one taps it and sees the order;
the banner disappears by itself on the other after about 30 seconds.

**Acceptance Scenarios**:

1. **Given** the owner and an employee have the app open, **When** a customer's phone or web order is
   saved, **Then** each of them sees a banner within 10 seconds with the order number, the customer's
   name, the pickup day, the items and the total, and hears a short sound.
2. **Given** a banner is shown, **When** nobody touches it, **Then** it slides away after about 30
   seconds and the notification stays unread in the list.
3. **Given** a banner is shown, **When** the staff member taps it, **Then** the order opens and the
   notification becomes read; the × closes the banner without opening anything.
4. **Given** an employee enters an order at the counter, **When** it is saved, **Then** the other staff
   members get the banner and the employee who entered it does not.
5. **Given** a staff member turned sound off on this device, or it is within their quiet hours,
   **When** a banner appears, **Then** it appears without sound.
6. **Given** the app was closed while orders came in, **When** it is opened, **Then** no banners replay;
   the orders are in the notification list.

---

### Edge Cases

- A request is handled before a device notification could be sent: no device notification is sent
  for a request that is already handled.
- The same request is recorded twice by mistake (the assistant's tool and the end-of-call check): one
  notification per request, never two.
- Quiet hours cross midnight (20:00–04:00) and the clocks change: quiet hours follow the bakery's local
  time (Prague) on that date.
- A device's notification registration expires or is revoked in the browser: the first permanent
  refusal removes it; further notifications for that person still appear in the app.
- Delivery to the notification service fails briefly: the notification stays in the app, the failure
  is recorded and counted for the owner; nothing is lost silently.
- The daily summary job runs late within its hour, or twice: the summary is still for the right day,
  and only once.
- The next open day is after a closed day or a holiday: the summary is for the next open day.
- A staff account is removed: its notifications and device registrations go with it.
- A notification's target no longer exists (the request was deleted by "Reset demo"): opening it says
  so instead of showing an error.
- Several orders arrive within seconds: banners stack newest on top, at most three visible, the rest
  counted ("+2 další"); each keeps its own 30 seconds.
- The browser blocks sound until the page has been clicked (after a reload): the banner still appears;
  the sound plays from the next one after any click. The sound test in the settings also unlocks it.
- A staff order for a day whose summary already went out causes both a "new order" and a "plan
  changed" notification for the others: they say different things and both stay.
- The app is open in two tabs or on two devices of the same person: the banner may show in each; the
  notification is one and reading it in one place reads it everywhere.

## Requirements _(mandatory)_

### Functional Requirements

**Creation and recipients**

- **FR-001**: A notification MUST be created together with the event that causes it, in the same
  atomic change; if the event is saved, its notifications exist, even if no device could be reached.
- **FR-002**: A customer's request (callback, change, cancel — from the assistant, from the
  end-of-call check, or from the web) MUST notify every staff member allowed to resolve requests, one
  notification per request and person.
- **FR-003**: When a request is marked handled, every notification about it MUST become read for
  everyone; marking it open again MUST NOT bring the notifications back.
- **FR-004**: Once a day, after the order cut-off, the owner MUST get a summary for the next open day:
  the number of orders and the three products with the most to bake, from the same plan the app
  shows; it MUST also go out when there are no orders.
- **FR-005**: The daily summary MUST be created at most once per day and owner, however often or late
  the daily job runs.
- **FR-006**: Notifications MUST go to staff only, never to customers, and only to people whose role
  allows the action the notification leads to.

**In the app**

- **FR-007**: The staff app MUST show a counter of unread notifications on every screen and a list of
  notifications, newest first; the list MUST refresh on its own while the app is open, at most 10
  seconds after a notification is created. _(Amended 2026-11-25: was 30 seconds; the banner of FR-021
  needs it sooner.)_
- **FR-008**: Opening a notification MUST mark it read and open what it is about (the request, the
  day's plan); "mark all read" MUST be available.

**On devices**

- **FR-009**: Device notifications MUST be opt-in per device: switched on by the person, after the
  browser's or the operating system's permission, confirmed by a test notification.
- **FR-010**: A device notification's text MUST NOT contain a customer's name, phone number or order
  contents; it says what kind of thing happened, and the details appear only in the signed-in app.
- **FR-011**: A device that refuses notifications permanently MUST be removed from the person's
  devices; delivery failures MUST be recorded and counted on the owner's "Provoz" screen.
- **FR-012**: Signing out MUST remove that device's registration.
- **FR-013**: On an iPhone or iPad the app MUST explain that device notifications need the app on the
  home screen when it is not there.

**Control**

- **FR-014**: Every staff member, in either role, MUST be able to choose per kind of notification
  whether it reaches them in the app and on their devices. Defaults: requests — in the app and on
  devices for everyone; daily summary — owner on, employees off.
- **FR-015**: Every staff member MUST be able to set quiet hours; the default is 20:00–04:00 bakery
  time. During quiet hours no device notification is sent; notifications still appear in the app.
  Exception: the owner's "assistant is down" alert (FR-019) is sent during quiet hours.

**Retention and privacy**

- **FR-016**: Notifications MUST be deleted 30 days after they were created; device registrations
  when they are removed, refused or the person signs out.

**Stage 2** _(specified now, built after stage 1 is measured)_

- **FR-017**: When reservations of a product reach the warning share of its daily limit for a day, the
  owner MUST get one warning per product and day. The share is a proposed 90%, unmeasured.
- **FR-018**: When staff add an order for a day whose daily summary has already gone out, the other
  staff members MUST be told the plan for that day changed.
- **FR-019**: When the phone assistant cannot start calls (the model's quota, the token service), the
  owner MUST get at most one alert per hour, also during quiet hours.

**Every new order and the banner** _(amended 2026-11-25, User Story 5)_

- **FR-020**: Every new order — phone, web form or staff — MUST notify every staff member allowed to see
  orders, except the staff member who entered it; one notification per order and person. Default: in
  the app and on devices, for both roles; switchable per person (FR-014).
- **FR-021**: While the staff app is open, every new notification, of any kind, MUST appear as a banner
  that slides in from the top of the screen within 10 seconds of being created (at once on a device
  with device notifications on), stays 30 seconds and slides away. The × closes it earlier. Several
  banners stack newest on top, at most three visible, the rest counted.
- **FR-022**: A new order's banner MUST show the order number, the customer's name, the pickup day, the
  items with quantities, the total and the channel. Other kinds show their title and text. Tapping a
  banner MUST open what it is about and mark the notification read. These details are inside the
  signed-in app; FR-010 still governs device notifications.
- **FR-023**: A banner MUST play a short sound, except when the person turned sound off on this device
  or it is within their quiet hours (FR-015). The sound setting MUST be per device, with a button that
  plays a test sound.
- **FR-024**: Banners MUST appear only for notifications created while the app is open; opening the app
  later MUST NOT replay earlier ones — they are in the list.
- **FR-025**: The device notification of a new order MUST say only that a new order arrived, for which
  day and through which channel (FR-010).
- **FR-026**: A banner shown in a tab that the device notification also reached MUST replace that device
  notification, so the person is not told twice on the same screen.
- **FR-027** _(code review, 2026-11-25)_: A device registration MUST be refused unless its address
  is HTTPS at a known browser push service; sending to a device MUST time out; registrations MUST
  be limited per person. The server never sends a request to an address a user chose freely.
- **FR-029** _(2026-11-25)_: Closing a request MUST refresh the closing person's notification
  list at once; the others see it within the polling interval (FR-007).
- **FR-028** _(code review, 2026-11-25)_: A plan notification (daily summary, plan changed) MUST open
  the plan of the day it names — restoring FR-008 ("open what it is about … the day's plan"), which
  research N11's amendment of 2026-11-24 had narrowed to the plan screen's default day.

**Out of scope**

- Notifications in the native mobile app (push through the app stores) — they need a native build;
  the browser path comes first. The banner of FR-021 works in the native app too, without sound until
  the native build adds an audio library.

### Key Entities

- **Notification**: one message for one staff member about one thing: its kind, a short text without
  personal data, what it opens, when it was created, when it was read, whether and when it reached a
  device, and a key that makes it unique per subject and person.
- **Notification preference**: per staff member and kind, whether it reaches them in the app and on
  devices; and the person's quiet hours.
- **Device registration**: a device that agreed to receive notifications for a staff member: how to
  reach it, when it last succeeded, how often it failed.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A customer's request appears in the app of every signed-in staff member within 30 seconds
  of the call ending, and on every opted-in device within 1 minute (outside quiet hours).
- **SC-002**: When a request is handled, it stops counting for every staff member within 30 seconds.
- **SC-003**: Over seven daily runs, each day gets exactly one summary per recipient — none missing,
  none duplicated.
- **SC-004**: No device notification text produced by the system contains a customer's name, phone
  number or order contents (checked by tests over every kind).
- **SC-005**: A staff member can switch any kind of notification off, or set quiet hours, in at most
  three taps from the notification list.
- **SC-006**: Every failed delivery is counted on the owner's "Provoz" screen; none is lost silently.
- **SC-007**: A new order appears as a banner in the open app of every other staff member within 10
  seconds of being saved, with its details, in 10 of 10 test orders.
- **SC-008**: A banner never shows for the staff member who entered the order, and never replays after
  the app is reopened.

## Assumptions

- Staff use the staff app in a browser (computer, Android, or an iPhone/iPad with the app added to
  the home screen); the native app build is not part of this feature.
- Requests, the baking plan, roles and the cut-off are those of spec 001; this feature only tells
  people about them.
- The daily job runs once a day within an hour after the cut-off; a summary arriving up to an hour
  late is acceptable.
- The bakery's time zone is Europe/Prague, as in spec 001.
- The polling interval (10 s since 2026-11-25), the banner time (30 s) and the warning share (FR-017)
  are proposed values, unmeasured, to be revisited with the owner after a week of use.
- The banner's look and behaviour follow the owner's description of 2026-11-25 (slides in from the
  top, about 30 seconds, tap for details, sound).
