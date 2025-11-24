import QuoteActivity from "../model/QuoteActivity";

export const loader = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const quoteReference = url.searchParams.get('ref');
    
    if (!quoteReference) {
      return new Response(
        JSON.stringify({ success: false, error: "Quote reference is required" }),
        { status: 400 }
      );
    }

    // Find the activity with the stored PDF - search across all activity types
    const activity = await QuoteActivity.findOne({
      quote_reference: quoteReference,
      $or: [
        { 'pdf_file.content': { $exists: true, $ne: null } },
        { 'pdf_file.content.$binary.base64': { $exists: true, $ne: null } }
      ]
    }).sort({ created_at: -1 });

    if (!activity || !activity.pdf_file) {
      return new Response(
        JSON.stringify({ success: false, error: "PDF not found for this quote" }),
        { status: 404 }
      );
    }

    // Handle both binary buffer and MongoDB binary format
    let pdfContent;
    if (activity.pdf_file.content instanceof Buffer) {
      pdfContent = activity.pdf_file.content;
    } else if (activity.pdf_file.content?.$binary?.base64) {
      pdfContent = Buffer.from(activity.pdf_file.content.$binary.base64, 'base64');
    } else {
      return new Response(
        JSON.stringify({ success: false, error: "PDF content format not supported" }),
        { status: 500 }
      );
    }

    // Return the PDF file
    return new Response(pdfContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${activity.pdf_file.filename || 'quote.pdf'}"`,
        'Content-Length': pdfContent.length.toString(),
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