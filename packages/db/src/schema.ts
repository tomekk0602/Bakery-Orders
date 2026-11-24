import { sql } from "drizzle-orm";
import {
  boolean,
  date,
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
  uuid,
} from "drizzle-orm/pg-core";

// Tables of data-model.md. Better Auth tables are added with the staff app (Phase 3).

export const orderSource = pgEnum("order_source", ["phone", "web", "staff"]);
export const orderStatus = pgEnum("order_status", ["confirmed", "picked_up", "cancelled"]);
export const requestKind = pgEnum("request_kind", ["callback", "change", "cancel"]);
export const requestOrigin = pgEnum("request_origin", ["agent", "promised_not_recorded", "web"]);
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
  spokenForms: text("spoken_forms").array().notNull().default(sql`'{}'::text[]`),
  priceCzk: integer("price_czk").notNull(),
  dailyLimit: integer("daily_limit"),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const walkInBuffer = pgTable(
  "walk_in_buffer",
  {
    productId: text("product_id").notNull().references(() => product.id),
    weekday: integer("weekday").notNull(),
    quantity: integer("quantity").notNull(),
  },
  (t) => [primaryKey({ columns: [t.productId, t.weekday] })],
);

export const dailyCapacity = pgTable(
  "daily_capacity",
  {
    productId: text("product_id").notNull().references(() => product.id),
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
  number: integer("number").notNull().unique().default(sql`nextval('order_number_seq')`),
  source: orderSource("source").notNull(),
  status: orderStatus("status").notNull().default("confirmed"),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone"),
  pickupDay: date("pickup_day").notNull(),
  totalCzk: integer("total_czk").notNull(),
  promptVersion: text("prompt_version"),
  model: text("model"),
  callId: uuid("call_id").references(() => call.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orderLine = pgTable(
  "order_line",
  {
    orderId: uuid("order_id").notNull().references(() => order.id, { onDelete: "cascade" }),
    productId: text("product_id").notNull().references(() => product.id),
    quantity: integer("quantity").notNull(),
    unitPriceCzk: integer("unit_price_czk").notNull(),
  },
  (t) => [primaryKey({ columns: [t.orderId, t.productId] })],
);

export const orderDraft = pgTable("order_draft", {
  id: uuid("id").primaryKey().defaultRandom(),
  channel: orderSource("channel").notNull(),
  callId: uuid("call_id").references(() => call.id),
  payload: jsonb("payload").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  confirmedOrderId: uuid("confirmed_order_id").references(() => order.id),
});

export const staffRequest = pgTable("staff_request", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: requestKind("kind").notNull(),
  origin: requestOrigin("origin").notNull(),
  customerName: text("customer_name"),
  customerPhone: text("customer_phone"),
  note: text("note").notNull(),
  callId: uuid("call_id").references(() => call.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  doneAt: timestamp("done_at", { withTimezone: true }),
});

export const rateLimit = pgTable(
  "rate_limit",
  {
    key: text("key").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
);
