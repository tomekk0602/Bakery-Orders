import { NOTIFICATION_KINDS } from "@bakery/core";
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgSequence,
  pgTable,
  primaryKey,
  text,
  time,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema.ts";

// Tables of data-model.md. Better Auth tables are added with the staff app (Phase 3).

export const orderSource = pgEnum("order_source", ["phone", "web", "staff"]);
export const orderStatus = pgEnum("order_status", ["confirmed", "picked_up", "cancelled"]);
export const requestKind = pgEnum("request_kind", ["callback", "change", "cancel"]);
export const requestOrigin = pgEnum("request_origin", ["agent", "promised_not_recorded", "web"]);
/** How a request ended (spec 001 FR-047, amended 2026-11-25). */
export const requestOutcome = pgEnum("request_outcome", ["handled", "unreachable"]);
/** One step on a request, for its history (FR-048–FR-052; research R33). */
export const requestStep = pgEnum("request_step", [
  "call_started",
  "unanswered",
  "handled",
  "unreachable",
  "reopened",
  "order_cancelled",
]);
export const callMode = pgEnum("call_mode", ["live", "cascade", "cascade_paid"]);
export const callOutcome = pgEnum("call_outcome", ["order", "request", "abandoned", "error", "capped"]);

export const bakerySettings = pgTable("bakery_settings", {
  id: integer("id").primaryKey().default(1),
  name: text("name").notNull(),
  cutoffDaysBefore: integer("cutoff_days_before").notNull(),
  cutoffTime: time("cutoff_time").notNull(),
  closedWeekdays: integer("closed_weekdays").array().notNull(),
  callCapSeconds: integer("call_cap_seconds").notNull(),
});

export const closedDay = pgTable("closed_day", {
  day: date("day").primaryKey(),
  reason: text("reason"),
});

export const product = pgTable("product", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  spokenForms: text("spoken_forms")
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  priceCzk: integer("price_czk").notNull(),
  dailyLimit: integer("daily_limit"),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const walkInBuffer = pgTable(
  "walk_in_buffer",
  {
    productId: text("product_id")
      .notNull()
      .references(() => product.id),
    weekday: integer("weekday").notNull(),
    quantity: integer("quantity").notNull(),
  },
  (t) => [primaryKey({ columns: [t.productId, t.weekday] })],
);

export const dailyCapacity = pgTable(
  "daily_capacity",
  {
    productId: text("product_id")
      .notNull()
      .references(() => product.id),
    day: date("day").notNull(),
    reserved: integer("reserved").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.productId, t.day] })],
);

export const orderNumberSeq = pgSequence("order_number_seq", { startWith: 1001 });

export const call = pgTable("call", {
  id: uuid("id").primaryKey().defaultRandom(),
  callerPhone: text("caller_phone").notNull(),
  ipHash: text("ip_hash").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  mode: callMode("mode").notNull().default("live"),
  outcome: callOutcome("outcome"),
  firstAudioMsP50: integer("first_audio_ms_p50"),
  firstAudioMsMax: integer("first_audio_ms_max"),
  /** every end-of-speech → first-audio sample of the call, for p50/p95 across calls (FR-033) */
  firstAudioMs: integer("first_audio_ms").array(),
  tokensIn: integer("tokens_in"),
  tokensOut: integer("tokens_out"),
  shadowCostUsd: numeric("shadow_cost_usd"),
  promptVersion: text("prompt_version").notNull(),
  model: text("model").notNull(),
  transcript: jsonb("transcript"),
  traceId: text("trace_id"),
});

export const order = pgTable("order", {
  id: uuid("id").primaryKey().defaultRandom(),
  number: integer("number")
    .notNull()
    .unique()
    .default(sql`nextval('order_number_seq')`),
  source: orderSource("source").notNull(),
  status: orderStatus("status").notNull().default("confirmed"),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone"),
  pickupDay: date("pickup_day").notNull(),
  totalCzk: integer("total_czk").notNull(),
  promptVersion: text("prompt_version"),
  model: text("model"),
  callId: uuid("call_id").references(() => call.id),
  /** the staff member who took a staff order (FR-012) */
  createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orderLine = pgTable(
  "order_line",
  {
    orderId: uuid("order_id")
      .notNull()
      .references(() => order.id, { onDelete: "cascade" }),
    productId: text("product_id")
      .notNull()
      .references(() => product.id),
    quantity: integer("quantity").notNull(),
    unitPriceCzk: integer("unit_price_czk").notNull(),
  },
  (t) => [primaryKey({ columns: [t.orderId, t.productId] })],
);

export const orderDraft = pgTable(
  "order_draft",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channel: orderSource("channel").notNull(),
    callId: uuid("call_id").references(() => call.id),
    /** a staff draft belongs to the staff member who prepared it; only they can confirm it (FR-019) */
    createdBy: text("created_by").references(() => user.id, { onDelete: "cascade" }),
    payload: jsonb("payload").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    confirmedOrderId: uuid("confirmed_order_id").references(() => order.id),
    /** a web form draft belongs to whoever holds its token; only its SHA-256 is kept (FR-064, R36) */
    webTokenHash: text("web_token_hash"),
  },
  // exactly one owner: the call, the staff member, or the web form's token (FR-006, FR-019, FR-064)
  (t) => [check("order_draft_one_owner", sql`num_nonnulls(${t.callId}, ${t.createdBy}, ${t.webTokenHash}) = 1`)],
);

export const staffRequest = pgTable(
  "staff_request",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: requestKind("kind").notNull(),
    origin: requestOrigin("origin").notNull(),
    customerName: text("customer_name"),
    customerPhone: text("customer_phone"),
    note: text("note").notNull(),
    callId: uuid("call_id").references(() => call.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    doneAt: timestamp("done_at", { withTimezone: true }),
    outcome: requestOutcome("outcome"),
    /** "Volá …": who started a call and until when it shows (FR-050) */
    claimedBy: text("claimed_by").references(() => user.id, { onDelete: "set null" }),
    claimedUntil: timestamp("claimed_until", { withTimezone: true }),
  },
  // the archive's pages and the nightly clean-up (spec 001 FR-055, FR-057)
  (t) => [index("staff_request_closed").on(t.doneAt, t.id)],
);

export const staffRequestEvent = pgTable(
  "staff_request_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => staffRequest.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    kind: requestStep("kind").notNull(),
    note: text("note"),
    orderId: uuid("order_id").references(() => order.id, { onDelete: "set null" }),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("staff_request_event_history").on(t.requestId, t.at)],
);

export const rateLimit = pgTable(
  "rate_limit",
  {
    key: text("key").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
);

// Staff notifications (spec 002, data-model.md, ADR-0016).

export const notificationKind = pgEnum("notification_kind", NOTIFICATION_KINDS);
export const pushChannel = pgEnum("push_channel", ["web"]);

export const notification = pgTable(
  "notification",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recipientId: text("recipient_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: notificationKind("kind").notNull(),
    /** what it is about, also the dedupe key: request:<id>, summary:<day>, … (FR-002, FR-005) */
    subject: text("subject").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    link: text("link").notNull(),
    /** the recipient's preference when it was created: shown in the app, pushed to devices (FR-014) */
    inApp: boolean("in_app").notNull(),
    push: boolean("push").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    readAt: timestamp("read_at", { withTimezone: true }),
    pushSentAt: timestamp("push_sent_at", { withTimezone: true }),
    pushError: text("push_error"),
  },
  (t) => [
    unique("notification_one_per_subject").on(t.recipientId, t.subject),
    index("notification_inbox").on(t.recipientId, t.readAt, t.createdAt),
  ],
);

export const notificationPreference = pgTable(
  "notification_preference",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: notificationKind("kind").notNull(),
    inApp: boolean("in_app").notNull(),
    push: boolean("push").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.kind] })],
);

export const notificationQuietHours = pgTable("notification_quiet_hours", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  enabled: boolean("enabled").notNull(),
  quietFrom: time("quiet_from").notNull(),
  quietTo: time("quiet_to").notNull(),
});

export const pushSubscription = pgTable("push_subscription", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  channel: pushChannel("channel").notNull().default("web"),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
  failures: integer("failures").notNull().default(0),
});
