import { connectToDatabase, getQuoteActivityModel } from "../../utils/mongodb.js";

export const action = async ({ request }) => {
  try {
    // Connect to database first
    await connectToDatabase();
    const QuoteActivity = getQuoteActivityModel();

    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({ success: false, error: "Method not allowed." }),
        { status: 405 }
      );
    }

    const data = await request.json();
    const { 
      type = 'overview', 
      page = 1, 
      limit = 10,
      activityType,
      dateFrom,
      dateTo 
    } = data;

    const skip = (page - 1) * limit;

    // Build match filter
    const matchFilter = {};
    if (activityType && activityType !== 'all') {
      matchFilter.activity_type = activityType;
    }
    if (dateFrom || dateTo) {
      matchFilter.created_at = {};
      if (dateFrom) matchFilter.created_at.$gte = new Date(dateFrom);
      if (dateTo) matchFilter.created_at.$lte = new Date(dateTo);
    }

    switch (type) {
      case 'overview':
        return await getOverviewStats(QuoteActivity, matchFilter);
      case 'quote_saved':
        return await getDetails(QuoteActivity, 'quote_saved', matchFilter, page, limit, skip);
      case 'email_summary_sent':
        return await getDetails(QuoteActivity, 'email_summary_sent', matchFilter, page, limit, skip);
      case 'pdf_downloaded':
        return await getDetails(QuoteActivity, 'pdf_downloaded', matchFilter, page, limit, skip);
      default:
        return new Response(
          JSON.stringify({ success: false, error: "Invalid analytics type" }),
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Analytics error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: "Failed to fetch analytics data",
        details: error.message 
      }),
      { status: 500 }
    );
  }
};

async function getOverviewStats(QuoteActivity, matchFilter) {
  try {
    // Get counts for each activity type using parallel queries
    const [quoteSavedCount, emailSentCount, pdfDownloadCount, allActivities] = await Promise.all([
      QuoteActivity.countDocuments({ ...matchFilter, activity_type: 'quote_saved' }),
      QuoteActivity.countDocuments({ ...matchFilter, activity_type: 'email_summary_sent' }),
      QuoteActivity.countDocuments({ ...matchFilter, activity_type: 'pdf_downloaded' }),
      QuoteActivity.find(matchFilter).select('quote_reference customer_email').lean()
    ]);

    // Calculate unique counts
    const uniqueQuotes = new Set();
    const uniqueCustomers = new Set();

    allActivities.forEach(activity => {
      if (activity.quote_reference && activity.quote_reference !== 'unknown') {
        uniqueQuotes.add(activity.quote_reference);
      }
      if (activity.customer_email) {
        uniqueCustomers.add(activity.customer_email);
      }
    });

    const totals = {
      total_activities: allActivities.length,
      total_quotes: uniqueQuotes.size,
      total_customers: uniqueCustomers.size,
      quote_saved: quoteSavedCount,
      email_summary_sent: emailSentCount,
      pdf_downloaded: pdfDownloadCount
    };

    // Get recent activities
    const recentActivities = await QuoteActivity.find(matchFilter)
      .sort({ created_at: -1 })
      .limit(5)
      .select('activity_type quote_reference customer_email created_at activity_data')
      .lean();

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          totals,
          recentActivities
        }
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error("Overview stats error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: "Failed to fetch overview statistics" 
      }),
      { status: 500 }
    );
  }
}

async function getDetails(QuoteActivity, activityType, matchFilter, page, limit, skip) {
  try {
    matchFilter.activity_type = activityType;

    const [data, total] = await Promise.all([
      QuoteActivity.find(matchFilter)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .select('quote_reference customer_email customer_ip created_at activity_data email_sent_successfully email_error')
        .lean(),
      QuoteActivity.countDocuments(matchFilter)
    ]);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          activities: data,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
          }
        }
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error(`${activityType} details error:`, error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: `Failed to fetch ${activityType} details` 
      }),
      { status: 500 }
    );
  }
}