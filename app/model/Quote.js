import mongoose from "mongoose";

const quoteSchema = new mongoose.Schema({
  quote_reference: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  quote_name: String,

  customer_email: String,
  customer_name: String,
  customer_phone: String,

  config_data: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
  },
  calculations_data: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
  },

  email_summary_count: {
    type: Number,
    default: 0,
  },
  pdf_download_count: {
    type: Number,
    default: 0,
  },
  load_count: {
    type: Number,
    default: 0,
  },

  status: {
    type: String,
    enum: ["draft", "quote_ready", "sent_to_customer", "converted", "expired"],
    default: "draft",
  },

  created_at: {
    type: Date,
    default: Date.now,
  },
  updated_at: {
    type: Date,
    default: Date.now,
  },
  expires_at: {
    type: Date,
    required: true,
  },
  converted_at: Date,
});

export const Quote = mongoose.model("Quote", quoteSchema);
