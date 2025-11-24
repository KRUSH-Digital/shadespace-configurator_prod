import { QuoteActivity } from "../model/QuoteActivity";

export const action = async ({ request }) => {
  try {
    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({ success: false, error: "Method not allowed." }),
        { status: 405 }
      );
    }

    const data = await request.json();
    if (!data) {
      return new Response(
        JSON.stringify({ success: false, error: "No data provided." }),
        { status: 400 }
      );
    }

    const {
      quoteReference,
      quoteId,
      customerEmail,
      totalPrice,
      currency,
      pdfData, // PDF content as base64 string
      quoteData
    } = data;

    // Store PDF as binary data if provided
    let pdfBuffer = null;
    let pdfSize = 0;
    
    if (pdfData && typeof pdfData === 'string') {
      try {
        const pdfBase64 = pdfData.includes(",") ? pdfData.split(",")[1] : pdfData;
        pdfBuffer = Buffer.from(pdfBase64, 'base64');
        pdfSize = pdfBuffer.length;
        console.log(`PDF download size: ${pdfSize} bytes`);
      } catch (error) {
        console.error('Error processing PDF for download storage:', error);
      }
    }

    const filename = `Quote_${quoteReference || 'unknown'}_${new Date().toISOString().split('T')[0]}.pdf`;

    // Create PDF download activity record with PDF file and quote data
    const pdfActivity = new QuoteActivity({
      quote_reference: quoteReference || 'unknown',
      quote_id: quoteId || quoteReference || 'unknown',
      activity_type: 'pdf_downloaded',
      customer_email: customerEmail,
      customer_ip: request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown',
      user_agent: request.headers.get('user-agent') || 'unknown',
      pdf_file: pdfBuffer ? {
        filename: filename,
        content: pdfBuffer,
        size: pdfSize,
        generated_at: new Date()
      } : undefined,
      quote_data: quoteData || {},
      pdf_generated: true,
      pdf_size: pdfSize,
      pdf_download_count: 1,
      activity_data: {
        total_price: totalPrice,
        currency: currency,
        download_timestamp: new Date().toISOString(),
        pdf_stored: !!pdfBuffer
      }
    });

    await pdfActivity.save();
    console.log('PDF download activity recorded in database with PDF file');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "PDF download tracked successfully.",
        pdf_stored: !!pdfBuffer 
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error("PDF download tracking error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Failed to track PDF download." }),
      { status: 500 }
    );
  }
};