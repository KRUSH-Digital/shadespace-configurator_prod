import QuoteActivity from "../model/QuoteActivity";

export const action = async ({ request }) => {
  try {
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
        return await getOverviewStats(matchFilter);
      case 'quote_saved':
        return await getQuoteSavedDetails(matchFilter, page, limit, skip);
      case 'email_summary_sent':
        return await getEmailSummaryDetails(matchFilter, page, limit, skip);
      case 'pdf_downloaded':
        return await getPdfDownloadDetails(matchFilter, page, limit, skip);
      default:
        return new Response(
          JSON.stringify({ success: false, error: "Invalid analytics type" }),
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Analytics error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Failed to fetch analytics data" }),
      { status: 500 }
    );
  }
};

async function getOverviewStats(matchFilter) {
  const pipeline = [
    { $match: matchFilter },
    {
      $group: {
        _id: "$activity_type",
        count: { $sum: 1 },
        unique_quotes: { $addToSet: "$quote_reference" },
        unique_customers: { $addToSet: "$customer_email" },
        total_email_sent: {
          $sum: {
            $cond: [{ $eq: ["$activity_type", "email_summary_sent"] }, 1, 0]
          }
        },
        total_pdf_downloads: {
          $sum: {
            $cond: [{ $eq: ["$activity_type", "pdf_downloaded"] }, 1, 0]
          }
        },
        total_quotes_saved: {
          $sum: {
            $cond: [{ $eq: ["$activity_type", "quote_saved"] }, 1, 0]
          }
        }
      }
    }
  ];

  const activityStats = await QuoteActivity.aggregate(pipeline);

  // Calculate totals
  const totals = {
    total_activities: 0,
    total_quotes: 0,
    total_customers: 0,
    email_summary_sent: 0,
    pdf_downloaded: 0,
    quote_saved: 0
  };

  const uniqueQuotes = new Set();
  const uniqueCustomers = new Set();

  activityStats.forEach(stat => {
    totals.total_activities += stat.count;
    totals[stat._id] = stat.count;
    
    stat.unique_quotes.forEach(quote => uniqueQuotes.add(quote));
    stat.unique_customers.forEach(customer => customer && uniqueCustomers.add(customer));
  });

  totals.total_quotes = uniqueQuotes.size;
  totals.total_customers = uniqueCustomers.size;

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
        activityStats,
        recentActivities
      }
    }),
    { status: 200 }
  );
}

async function getQuoteSavedDetails(matchFilter, page, limit, skip) {
  matchFilter.activity_type = 'quote_saved';

  const pipeline = [
    { $match: matchFilter },
    {
      $facet: {
        data: [
          { $sort: { created_at: -1 } },
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              quote_reference: 1,
              customer_email: 1,
              customer_ip: 1,
              user_agent: 1,
              email_sent_successfully: 1,
              created_at: 1,
              activity_data: 1
            }
          }
        ],
        pagination: [
          { $count: "total" }
        ]
      }
    }
  ];

  const result = await QuoteActivity.aggregate(pipeline);
  const data = result[0].data;
  const total = result[0].pagination[0]?.total || 0;

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
}

async function getEmailSummaryDetails(matchFilter, page, limit, skip) {
  matchFilter.activity_type = 'email_summary_sent';

  const pipeline = [
    { $match: matchFilter },
    {
      $facet: {
        data: [
          { $sort: { created_at: -1 } },
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              quote_reference: 1,
              customer_email: 1,
              customer_ip: 1,
              email_sent_successfully: 1,
              email_error: 1,
              created_at: 1,
              activity_data: 1
            }
          }
        ],
        pagination: [
          { $count: "total" }
        ]
      }
    }
  ];

  const result = await QuoteActivity.aggregate(pipeline);
  const data = result[0].data;
  const total = result[0].pagination[0]?.total || 0;

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
}

async function getPdfDownloadDetails(matchFilter, page, limit, skip) {
  matchFilter.activity_type = 'pdf_downloaded';

  const pipeline = [
    { $match: matchFilter },
    {
      $facet: {
        data: [
          { $sort: { created_at: -1 } },
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              quote_reference: 1,
              customer_email: 1,
              customer_ip: 1,
              user_agent: 1,
              created_at: 1,
              activity_data: 1
            }
          }
        ],
        pagination: [
          { $count: "total" }
        ]
      }
    }
  ];

  const result = await QuoteActivity.aggregate(pipeline);
  const data = result[0].data;
  const total = result[0].pagination[0]?.total || 0;

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
}