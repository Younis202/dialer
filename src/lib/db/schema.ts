import {
  pgTable,
  serial,
  text,
  integer,
  bigint,
  boolean,
  real,
  primaryKey,
  index,
  uniqueIndex,
  jsonb,
} from "drizzle-orm/pg-core";

export const contacts = pgTable(
  "contacts",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull().default(""),
    phone: text("phone").notNull(),
    email: text("email").default(""),
    company: text("company").default(""),
    country: text("country").default(""),
    tags: text("tags").default(""),
    notes: text("notes").default(""),
    favorite: boolean("favorite").default(false),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
    lastCalledAt: bigint("last_called_at", { mode: "number" }),
    callCount: integer("call_count").default(0),
  },
  (t) => ({
    phoneIdx: index("ix_contacts_phone").on(t.phone),
    nameIdx: index("ix_contacts_name").on(t.name),
  })
);

export const lists = pgTable("lists", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").default("#10e6a5"),
  description: text("description").default(""),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
}, (t) => ({
  nameUnique: uniqueIndex("ux_lists_name").on(t.name),
}));

export const contactLists = pgTable(
  "contact_lists",
  {
    contactId: integer("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
    listId: integer("list_id").notNull().references(() => lists.id, { onDelete: "cascade" }),
  },
  (t) => ({ pk: primaryKey({ columns: [t.contactId, t.listId] }) })
);

export const dispositions = pgTable("dispositions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").default("#64748b"),
  isSuccess: boolean("is_success").default(false),
  sortOrder: integer("sort_order").default(0),
}, (t) => ({
  nameUnique: uniqueIndex("ux_disp_name").on(t.name),
}));

export const calls = pgTable(
  "calls",
  {
    id: serial("id").primaryKey(),
    sid: text("sid"),
    direction: text("direction").default("outbound"),
    fromNumber: text("from_number"),
    toNumber: text("to_number"),
    contactId: integer("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    status: text("status"),
    duration: integer("duration").default(0),
    cost: real("cost").default(0),
    recordingUrl: text("recording_url"),
    startedAt: bigint("started_at", { mode: "number" }).notNull(),
    endedAt: bigint("ended_at", { mode: "number" }),
    dispositionId: integer("disposition_id").references(() => dispositions.id, { onDelete: "set null" }),
    notes: text("notes").default(""),
    transcript: text("transcript").default(""),
    provider: text("provider").default("demo"),
    countryCode: text("country_code").default(""),
    countryName: text("country_name").default(""),
  },
  (t) => ({
    startedIdx: index("ix_calls_started").on(t.startedAt),
    contactIdx: index("ix_calls_contact").on(t.contactId),
  })
);

export const smsMessages = pgTable(
  "sms_messages",
  {
    id: serial("id").primaryKey(),
    sid: text("sid"),
    direction: text("direction"),
    fromNumber: text("from_number"),
    toNumber: text("to_number"),
    body: text("body"),
    status: text("status").default("sent"),
    sentAt: bigint("sent_at", { mode: "number" }).notNull(),
    contactId: integer("contact_id").references(() => contacts.id, { onDelete: "set null" }),
  },
  (t) => ({ sentIdx: index("ix_sms_sent").on(t.sentAt) })
);

export const scheduledCalls = pgTable("scheduled_calls", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").references(() => contacts.id, { onDelete: "set null" }),
  phone: text("phone").notNull(),
  name: text("name").default(""),
  scheduledFor: bigint("scheduled_for", { mode: "number" }).notNull(),
  notes: text("notes").default(""),
  status: text("status").default("pending"),
  notified: boolean("notified").default(false),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export const scripts = pgTable("scripts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  category: text("category").default("general"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export const voicemails = pgTable("voicemails", {
  id: serial("id").primaryKey(),
  fromNumber: text("from_number").notNull().default(""),
  audioUrl: text("audio_url"),
  duration: integer("duration").default(0),
  transcript: text("transcript").default(""),
  read: boolean("read").default(false),
  receivedAt: bigint("received_at", { mode: "number" }).notNull(),
});

export const dnc = pgTable("dnc", {
  id: serial("id").primaryKey(),
  phone: text("phone").notNull(),
  reason: text("reason").default(""),
  addedAt: bigint("added_at", { mode: "number" }).notNull(),
}, (t) => ({
  phoneUnique: uniqueIndex("ux_dnc_phone").on(t.phone),
}));

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value"),
});

export const powerSessions = pgTable("power_sessions", {
  id: serial("id").primaryKey(),
  listId: integer("list_id").references(() => lists.id, { onDelete: "set null" }),
  startedAt: bigint("started_at", { mode: "number" }).notNull(),
  endedAt: bigint("ended_at", { mode: "number" }),
  total: integer("total").default(0),
  completed: integer("completed").default(0),
});

export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
export type List = typeof lists.$inferSelect;
export type Call = typeof calls.$inferSelect;
export type NewCall = typeof calls.$inferInsert;
export type Disposition = typeof dispositions.$inferSelect;
export type SmsMessage = typeof smsMessages.$inferSelect;
export type ScheduledCall = typeof scheduledCalls.$inferSelect;
export type Script = typeof scripts.$inferSelect;
export type Voicemail = typeof voicemails.$inferSelect;
export type Dnc = typeof dnc.$inferSelect;
