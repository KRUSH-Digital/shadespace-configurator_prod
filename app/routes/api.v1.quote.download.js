
import { QuoteActivity } from "../model/QuoteActivity";

export const action = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const quoteReference = url.searchParams.get('ref');
    
    if (!quoteReference) {
      return new Response(
        JSON.stringify({ success: false, error: "Quote reference is required" }),
        { status: 400 }
      );
    }

    // Find the activity with the stored PDF
    const activity = await QuoteActivity.findOne({
      quote_reference: quoteReference,
      'pdf_file.content': { $exists: true, $ne: null }
    }).sort({ created_at: -1 });

    if (!activity || !activity.pdf_file || !activity.pdf_file.content) {
      return new Response(
        JSON.stringify({ success: false, error: "PDF not found for this quote" }),
        { status: 404 }
      );
    }

    // Return the PDF file
    return new Response(activity.pdf_file.content, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${activity.pdf_file.filename || 'quote.pdf'}"`,
        'Content-Length': activity.pdf_file.size.toString(),
      },
    });
  } catch (error) {
    console.error("PDF download error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Failed to download PDF" }),
      { status: 500 }
    );
  }
};