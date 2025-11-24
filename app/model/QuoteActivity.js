import mongoose from 'mongoose';

const quoteActivitySchema = new mongoose.Schema({
  quote_reference: {
    type: String,
    required: true,
    index: true
  },
  quote_id: {
    type: String,
    required: true,
    index: true
  },
  
  activity_type: {
    type: String,
    enum: ['quote_saved', 'email_summary_sent', 'pdf_downloaded', 'quote_loaded', 'quote_converted'],
    required: true
  },
  
  customer_email: String,
  customer_ip: String,
  user_agent: String,
  
  activity_data: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  
  // Store email content
  email_content: {
    subject: String,
    html_content: String,
    text_content: String
  },
  
  // Store PDF file
  pdf_file: {
    filename: String,
    content: Buffer, // Store PDF as binary data
    content_type: { type: String, default: 'application/pdf' },
    size: Number,
    generated_at: { type: Date, default: Date.now }
  },
  
  // Store quote configuration data
  quote_data: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  
  email_recipients: [String], 
  email_subject: String,
  email_sent_successfully: Boolean,
  email_error: String,
  
  pdf_generated: Boolean,
  pdf_size: Number, 
  pdf_download_count: Number,
  
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
});

quoteActivitySchema.index({ quote_reference: 1, created_at: -1 });
quoteActivitySchema.index({ customer_email: 1, created_at: -1 });
quoteActivitySchema.index({ activity_type: 1, created_at: -1 });

const QuoteActivity = mongoose.models.QuoteActivity || mongoose.model('QuoteActivity', quoteActivitySchema);

export default QuoteActivity;