import { sqliteTable, text, real } from "drizzle-orm/sqlite-core";

export const postcards = sqliteTable("postcards", {
  id: text("id").primaryKey(),
  message: text("message"),
  senderName: text("sender_name"),
  country: text("country"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  frontImageKey: text("front_image_key").notNull(),
  backImageKey: text("back_image_key"),
  status: text("status", { enum: ["scanned", "arriving", "landed"] })
    .notNull()
    .default("scanned"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export type Postcard = typeof postcards.$inferSelect;
export type NewPostcard = typeof postcards.$inferInsert;
