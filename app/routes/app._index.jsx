import React, { useState, useEffect, useCallback } from "react";
import {
  Page,
  Card,
  InlineStack,
  BlockStack,
  Text,
  Tabs,
  Select,
  TextField,
  Button,
  DataTable,
  Modal,
  Pagination,
  EmptyState,
  Toast,
  SkeletonBodyText,
  Box,
  Badge,
  Divider,
  Frame,
} from "@shopify/polaris";
import { 
  SaveIcon,
  EmailIcon,
  FileIcon,
  NoteIcon,
  LinkIcon,
  CalendarIcon,
} from "@shopify/polaris-icons";
import { TitleBar } from "@shopify/app-bridge-react";

const TAB_ITEMS = [
  { id: "overview", content: "Overview" },
  { id: "quote_saved", content: "Quote Saved" },
  { id: "email_summary_sent", content: "Email Summary Sent" },
  { id: "pdf_downloaded", content: "PDF Downloaded" },
];

const PDF_GENERATE_URL = "/api/v1/quote/generate-pdf";

export default function Analytics() {
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [filters, setFilters] = useState({
    activityType: "all",
    dateFrom: "",
    dateTo: "",
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
  });

  const [toast, setToast] = useState(null);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const fetchAnalytics = useCallback(
    async (tab = activeTab, page = 1) => {
      setLoading(true);
      try {
        const res = await fetch("/api/v1/analytics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: tab,
            page,
            limit: pagination.limit,
            ...filters,
          }),
        });

        const result = await res.json();

        if (result.success) {
          setData(result.data ?? null);
          if (result.data?.pagination)
            setPagination(result.data.pagination);
        } else {
          setData(null);
        }
      } catch (err) {
        console.error(err);
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [activeTab, filters, pagination.limit]
  );

  useEffect(() => {
    fetchAnalytics(activeTab, 1);
  }, [activeTab, filters, fetchAnalytics]);

  const formatDate = (d) =>
    new Date(d).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const handlePageChange = (newPage) => fetchAnalytics(activeTab, newPage);

  // Generate PDF on runtime
  const generateAndDownloadPdf = async (activity) => {
    setGeneratingPdf(true);
    try {
      const response = await fetch(PDF_GENERATE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteData: activity.quote_data || activity.activity_data,
          activityType: activity.activity_type,
          customerEmail: activity.customer_email,
          quoteReference: activity.quote_reference,
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        
        // Create download link
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `quote-${activity.quote_reference || 'unknown'}-${new Date().getTime()}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        setToast({ content: "PDF generated and downloaded successfully" });
      } else {
        throw new Error('PDF generation failed');
      }
    } catch (error) {
      console.error('PDF generation error:', error);
      setToast({ content: "Failed to generate PDF", error: true });
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Check if activity should have download button
  const shouldShowDownloadButton = (activityType) => {
    return activityType === "email_summary_sent" || activityType === "pdf_downloaded";
  };

  // Handle download based on activity type
  const handleDownload = async (e, activity) => {
    e?.stopPropagation?.();
    
    // For activities that should have download buttons
    if (shouldShowDownloadButton(activity.activity_type)) {
      await generateAndDownloadPdf(activity);
    }
  };

  const getActivityBadge = (type) => {
    const badges = {
      quote_saved: { status: "info", label: "Quote Saved" },
      email_summary_sent: { status: "success", label: "Email Sent" },
      pdf_downloaded: { status: "attention", label: "PDF Downloaded" },
    };
    const badge = badges[type] || { status: "default", label: type };
    return <Badge tone={badge.status}>{badge.label}</Badge>;
  };

  // Parse quote data with expanded details
  const parseQuoteData = (quoteData) => {
    if (!quoteData) return [];
    
    const items = [];
    
    // Helper function to recursively parse nested objects
    const parseObject = (obj, prefix = '') => {
      Object.entries(obj).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') return;
        
        const fullKey = prefix ? `${prefix}.${key}` : key;
        const formattedKey = fullKey.split('.').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
        
        let displayValue = value;
        
        // Format specific values
        if (key.includes('price') || key.includes('cost') || key.includes('Price') || key.includes('Cost')) {
          if (typeof value === 'number') {
            displayValue = value.toLocaleString();
          }
        } else if (key.includes('area') || key.includes('perimeter') || key.includes('measurement')) {
          if (typeof value === 'number') {
            displayValue = `${value} mm`;
          }
        } else if (key.includes('factor') || key.includes('percentage')) {
          if (typeof value === 'number') {
            displayValue = `${value}%`;
          }
        }
        
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          // Recursively parse nested objects
          parseObject(value, fullKey);
        } else if (Array.isArray(value)) {
          if (value.length > 0) {
            // Handle arrays of objects vs arrays of primitives
            if (typeof value[0] === 'object') {
              value.forEach((item, index) => {
                if (item && typeof item === 'object') {
                  parseObject(item, `${fullKey}[${index}]`);
                }
              });
            } else {
              displayValue = value.join(', ');
              items.push({ 
                label: formattedKey, 
                value: String(displayValue)
              });
            }
          }
        } else {
          if (typeof value === 'boolean') {
            displayValue = value ? 'Yes' : 'No';
          }
          
          items.push({ 
            label: formattedKey, 
            value: String(displayValue)
          });
        }
      });
    };
    
    parseObject(quoteData);
    return items;
  };

  const parseActivityData = (data) => {
    if (!data) return [];
    
    const items = [];
    
    Object.entries(data).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') return;
      
      const formattedKey = key.split('_').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ');
      
      let displayValue = value;
      
      // Format date values
      if (key.includes('date') || key.includes('time') || key.includes('expires')) {
        try {
          displayValue = new Date(value).toLocaleString("en-GB", {
            day: "2-digit",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
          });
        } catch (e) {}
      }
      
      if (typeof value === 'object' && value !== null) {
        displayValue = JSON.stringify(value, null, 2);
      } else if (typeof value === 'boolean') {
        displayValue = value ? 'Yes' : 'No';
      }
      
      items.push({ 
        label: formattedKey, 
        value: String(displayValue)
      });
    });
    
    return items;
  };

  // Helper function to safely render HTML content
  const sanitizeHtml = (html) => {
    if (!html) return '';
    
    // Basic sanitization - remove scripts and styles
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/on\w+="[^"]*"/g, '') // Remove event handlers
      .replace(/on\w+='[^']*'/g, '') // Remove event handlers
      .substring(0, 2000) + (html.length > 2000 ? "..." : "");
  };

  const buildRows = (activities = []) =>
    activities.map((a) => [
      a.quote_reference ?? "-",
      a.customer_email ?? "-",
      a.customer_ip ?? "-",
      formatDate(a.created_at),
      <InlineStack gap="200">
        {/* Show download button only for email_summary_sent and pdf_downloaded */}
        {shouldShowDownloadButton(a.activity_type) && (
          <Button 
            size="slim" 
            onClick={(e) => handleDownload(e, a)}
            loading={generatingPdf}
            disabled={generatingPdf}
          >
            {generatingPdf ? "Generating..." : "Download PDF"}
          </Button>
        )}
        <Button size="slim" variant="primary" onClick={() => setSelectedActivity(a)}>
          View Details
        </Button>
      </InlineStack>,
    ]);

  return (
    <Frame>
      <Page title="Analytics Dashboard">
        <TitleBar title="Analytics" />

        {toast && (
          <Toast 
            content={toast.content} 
            onDismiss={() => setToast(null)} 
            error={toast.error}
          />
        )}

        <BlockStack gap="500">
          {/* Tabs + Filters */}
          <Card>
            <BlockStack gap="400">
              <Tabs
                tabs={TAB_ITEMS}
                selected={TAB_ITEMS.findIndex((t) => t.id === activeTab)}
                onSelect={(index) => setActiveTab(TAB_ITEMS[index].id)}
              />

              <Divider />

              <div style={{ 
                display: "grid", 
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", 
                gap: "16px", 
                alignItems: "end" 
              }}>
                <Select
                  label="Activity Type"
                  options={[
                    { label: "All Activities", value: "all" },
                    { label: "Quote Saved", value: "quote_saved" },
                    { label: "Email Summary Sent", value: "email_summary_sent" },
                    { label: "PDF Downloaded", value: "pdf_downloaded" },
                  ]}
                  value={filters.activityType}
                  onChange={(v) => setFilters((f) => ({ ...f, activityType: v }))}
                />
                <TextField
                  type="date"
                  label="From Date"
                  value={filters.dateFrom}
                  onChange={(v) => setFilters((f) => ({ ...f, dateFrom: v }))}
                />
                <TextField
                  type="date"
                  label="To Date"
                  value={filters.dateTo}
                  onChange={(v) => setFilters((f) => ({ ...f, dateTo: v }))}
                />
              </div>
            </BlockStack>
          </Card>

          {/* === OVERVIEW DASHBOARD === */}
          {activeTab === "overview" && (
            <>
              {loading ? (
                <Card>
                  <SkeletonBodyText lines={8} />
                </Card>
              ) : !data?.totals ? (
                <Card>
                  <EmptyState
                    heading="No data available"
                    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                  >
                    <p>Start tracking analytics to see insights here.</p>
                  </EmptyState>
                </Card>
              ) : (
                <>
                  {/* KPI Metrics Grid */}
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                    gap: "16px"
                  }}>
                    {[
                      { label: "Total Activities", value: data.totals.total_activities, icon: "📊" },
                      { label: "Quotes Saved", value: data.totals.quote_saved, icon: "💾" },
                      { label: "Emails Sent", value: data.totals.email_summary_sent, icon: "📧" },
                      { label: "PDF Downloads", value: data.totals.pdf_downloaded, icon: "📄" },
                      { label: "Unique Quotes", value: data.totals.total_quotes, icon: "📋" },
                      { label: "Unique Customers", value: data.totals.total_customers, icon: "👥" },
                    ].map((metric, i) => (
                      <Card key={i} padding="400">
                        <div style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between"
                        }}>
                          <div>
                            <Text variant="bodySm" tone="subdued">{metric.label}</Text>
                            <div style={{ 
                              fontSize: "32px", 
                              fontWeight: "600", 
                              marginTop: "8px",
                              color: "#202223"
                            }}>
                              {metric.value ?? 0}
                            </div>
                          </div>
                          <div style={{
                            fontSize: "32px",
                            opacity: 0.3
                          }}>
                            {metric.icon}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>

                  {/* Recent Activities Card */}
                  <Card>
                    <BlockStack gap="400">
                      <Text variant="headingMd" as="h2">Recent Activities</Text>
                      {data.recentActivities?.length > 0 ? (
                        <DataTable
                          columnContentTypes={["text", "text", "text", "text"]}
                          headings={["Activity Type", "Quote Reference", "Customer Email", "Date & Time"]}
                          rows={data.recentActivities.map((r) => [
                            <div key={r.id}>{getActivityBadge(r.activity_type)}</div>,
                            r.quote_reference ?? "-",
                            r.customer_email ?? "-",
                            formatDate(r.created_at),
                          ])}
                        />
                      ) : (
                        <EmptyState
                          heading="No recent activities"
                          image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                        >
                          <p>Activity will appear here once customers interact with quotes.</p>
                        </EmptyState>
                      )}
                    </BlockStack>
                  </Card>
                </>
              )}
            </>
          )}

          {/* === DETAILS TABS === */}
          {activeTab !== "overview" && (
            <>
              {loading ? (
                <Card>
                  <SkeletonBodyText lines={10} />
                </Card>
              ) : !data?.activities?.length ? (
                <Card>
                  <EmptyState
                    heading="No results found"
                    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                  >
                    <p>Try adjusting your filters to see more results.</p>
                  </EmptyState>
                </Card>
              ) : (
                <Card>
                  <BlockStack gap="400">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                      <Text variant="headingMd" as="h2">
                        {TAB_ITEMS.find(t => t.id === activeTab)?.content}
                      </Text>
                      <Badge tone="info">{pagination.total} results</Badge>
                    </div>

                    <DataTable
                      columnContentTypes={["text", "text", "text", "text", "text"]}
                      headings={["Quote Reference", "Customer Email", "IP Address", "Date & Time", "Actions"]}
                      rows={buildRows(data.activities)}
                    />

                    {pagination.pages > 1 && (
                      <Box paddingBlockStart="400">
                        <div style={{ display: "flex", justifyContent: "center" }}>
                          <Pagination
                            hasPrevious={pagination.page > 1}
                            onPrevious={() => handlePageChange(pagination.page - 1)}
                            hasNext={pagination.page < pagination.pages}
                            onNext={() => handlePageChange(pagination.page + 1)}
                            label={`Page ${pagination.page} of ${pagination.pages}`}
                          />
                        </div>
                      </Box>
                    )}
                  </BlockStack>
                </Card>
              )}
            </>
          )}
        </BlockStack>

        {/* === ACTIVITY DETAILS MODAL === */}
        {selectedActivity && (
          <Modal
            open
            onClose={() => {
              setSelectedActivity(null);
            }}
            title="Activity Details"
            primaryAction={{ 
              content: "Close", 
              onAction: () => {
                setSelectedActivity(null);
              }
            }}
            large
          >
            <Modal.Section>
              <BlockStack gap="400">
                {/* Header Info */}
                <Card>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: "16px" }}>
                    <div style={{ flex: 1 }}>
                      <Text variant="headingMd" as="h3">{selectedActivity.quote_reference || "No Reference"}</Text>
                      <div style={{ marginTop: "8px" }}>
                        <Text variant="bodySm" tone="subdued">{formatDate(selectedActivity.created_at)}</Text>
                      </div>
                    </div>
                    <div>{getActivityBadge(selectedActivity.activity_type)}</div>
                  </div>
                </Card>

                {/* Customer Information */}
                <Card>
                  <BlockStack gap="300">
                    <Text variant="headingSm" as="h4">Customer Information</Text>
                    
                    <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: "12px", alignItems: "start" }}>
                      <Text variant="bodySm" tone="subdued">Email</Text>
                      <Text variant="bodySm">{selectedActivity.customer_email || "Not provided"}</Text>
                      
                      <Text variant="bodySm" tone="subdued">IP Address</Text>
                      <Text variant="bodySm">{selectedActivity.customer_ip || "Not available"}</Text>
                    </div>
                  </BlockStack>
                </Card>

                {/* Email Content Section - Show for email_summary_sent activities */}
                {selectedActivity.activity_type === "email_summary_sent" && selectedActivity.email_content && (
                  <Card>
                    <BlockStack gap="300">
                      <Text variant="headingSm" as="h4">Email Summary Content</Text>
                      
                      {/* Email Subject */}
                      <div style={{ 
                        display: "grid", 
                        gridTemplateColumns: "140px 1fr", 
                        gap: "12px",
                        alignItems: "start",
                        paddingBottom: "12px",
                        borderBottom: "1px solid #e3e3e3"
                      }}>
                        <Text variant="bodySm" tone="subdued">Subject</Text>
                        <div style={{ wordBreak: "break-word" }}>
                          <Text variant="bodySm">{selectedActivity.email_content.subject || "No subject"}</Text>
                        </div>
                      </div>

                      {/* Text Content */}
                      {selectedActivity.email_content.text_content && (
                        <div style={{ 
                          display: "grid", 
                          gridTemplateColumns: "140px 1fr", 
                          gap: "12px",
                          alignItems: "start",
                          paddingBottom: "12px",
                          borderBottom: "1px solid #e3e3e3"
                        }}>
                          <Text variant="bodySm" tone="subdued">Text Content</Text>
                          <div style={{ wordBreak: "break-word" }}>
                            <Text variant="bodySm">{selectedActivity.email_content.text_content}</Text>
                          </div>
                        </div>
                      )}

                      {/* HTML Content Preview */}
                      {selectedActivity.email_content.html_content && (
                        <div>
                          <Text variant="bodySm" tone="subdued" style={{ marginBottom: "8px" }}>HTML Preview</Text>
                          <div 
                            style={{ 
                              border: "1px solid #e3e3e3",
                              borderRadius: "6px",
                              padding: "16px",
                              backgroundColor: "#f9f9f9",
                              maxHeight: "300px",
                              overflow: "auto",
                              fontSize: "12px",
                              lineHeight: "1.4"
                            }}
                          >
                            {/* This will render a sanitized preview of the HTML */}
                            <div dangerouslySetInnerHTML={{ 
                              __html: sanitizeHtml(selectedActivity.email_content.html_content)
                            }} />
                          </div>
                          <Text variant="bodySm" tone="subdued" style={{ marginTop: "4px" }}>
                            {selectedActivity.email_content.html_content.length > 2000 
                              ? "Content truncated - full HTML available in email" 
                              : "Full HTML content"}
                          </Text>
                        </div>
                      )}

                      {/* PDF Content Info */}
                      {selectedActivity.pdf_file && selectedActivity.pdf_file.content && (
                        <div style={{ 
                          display: "grid", 
                          gridTemplateColumns: "140px 1fr", 
                          gap: "12px",
                          alignItems: "start",
                          paddingTop: "12px",
                          borderTop: "1px solid #e3e3e3"
                        }}>
                          <Text variant="bodySm" tone="subdued">PDF Attached</Text>
                          <div style={{ wordBreak: "break-word" }}>
                            <Text variant="bodySm">
                              {selectedActivity.pdf_file.filename || "PDF File"} 
                              ({Math.round(selectedActivity.pdf_file.size / 1024)} KB)
                            </Text>
                            {selectedActivity.pdf_file.content && selectedActivity.pdf_file.content.$binary && (
                              <div style={{ marginTop: "4px" }}>
                                <Text variant="bodySm" tone="subdued">
                                  Base64 content available ({selectedActivity.pdf_file.content.$binary.base64.length} characters)
                                </Text>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </BlockStack>
                  </Card>
                )}

                {/* Quote Data Section - Show for pdf_downloaded activities */}
                {selectedActivity.activity_type === "pdf_downloaded" && selectedActivity.quote_data && (
                  <Card>
                    <BlockStack gap="300">
                      <Text variant="headingSm" as="h4">Quote Configuration Data</Text>
                      
                      <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxHeight: "400px", overflowY: "auto" }}>
                        {parseQuoteData(selectedActivity.quote_data).map((item, idx) => (
                          <div 
                            key={idx} 
                            style={{ 
                              display: "grid", 
                              gridTemplateColumns: "140px 1fr", 
                              gap: "12px",
                              alignItems: "start",
                              paddingBottom: "12px",
                              borderBottom: idx < parseQuoteData(selectedActivity.quote_data).length - 1 ? "1px solid #e3e3e3" : "none"
                            }}
                          >
                            <Text variant="bodySm" tone="subdued">{item.label}</Text>
                            <div style={{ wordBreak: "break-word" }}>
                              <Text variant="bodySm">{item.value}</Text>
                            </div>
                          </div>
                        ))}
                      </div>
                    </BlockStack>
                  </Card>
                )}

                {/* Activity Data */}
                {parseActivityData(selectedActivity.activity_data).length > 0 && (
                  <Card>
                    <BlockStack gap="300">
                      <Text variant="headingSm" as="h4">Activity Details</Text>
                      
                      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        {parseActivityData(selectedActivity.activity_data).map((item, idx) => (
                          <div 
                            key={idx} 
                            style={{ 
                              display: "grid", 
                              gridTemplateColumns: "140px 1fr", 
                              gap: "12px",
                              alignItems: "start",
                              paddingBottom: "12px",
                              borderBottom: idx < parseActivityData(selectedActivity.activity_data).length - 1 ? "1px solid #e3e3e3" : "none"
                            }}
                          >
                            <Text variant="bodySm" tone="subdued">{item.label}</Text>
                            <div style={{ wordBreak: "break-word" }}>
                              <Text variant="bodySm">{item.value}</Text>
                            </div>
                          </div>
                        ))}
                      </div>
                    </BlockStack>
                  </Card>
                )}
              </BlockStack>
            </Modal.Section>
          </Modal>
        )}
      </Page>
    </Frame>
  );
}