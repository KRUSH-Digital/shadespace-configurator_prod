import {authenticate} from '../shopify.server'

export const action = async({request})=>{
    try {

        if(request.method !== "POST") return new Response(JSON.stringify({success: false, error: "Method not allowed."}),{status: 405})

        const {admin} = await authenticate.public.appProxy(request)

        if(!admin) return new Response(JSON.stringify({success:false, error:"Unauthorized."}),{status: 401})

        const {email} = await request.json()

        if(!email) return new Response(JSON.stringify({success: false, error:"Please provide required field."}),{status: 400})
        
        const searchResponse = await admin.graphql(
            `query($query: String!) {
                customers(first: 1, query: $query) {
                    edges {
                        node {
                            id
                            email
                            emailMarketingConsent {
                                marketingState
                                marketingOptInLevel
                            }
                        }
                    }
                }
            }`,
            {
                variables: {
                    query: `email:${email}`
                }
            }
        );

        const searchData = await searchResponse.json();
        const existingCustomer = searchData.data?.customers?.edges[0]?.node;

        if (!existingCustomer) {
            console.log('Customer does not exist - creating new customer');
            
            // First, create the customer
            const createResponse = await admin.graphql(
                `mutation customerCreate($input: CustomerInput!) {
                    customerCreate(input: $input) {
                        customer {
                            id
                            email
                        }
                        userErrors {
                            field
                            message
                        }
                    }
                }`,
                {
                    variables: {
                        input: {
                            email: email
                        }
                    }
                }
            );

            const createData = await createResponse.json();
            
            if (createData.data?.customerCreate?.userErrors?.length > 0) {
                return new Response(
                    JSON.stringify({ 
                        success: false, 
                        error: createData.data.customerCreate.userErrors 
                    }),
                    { status: 400 }
                );
            }

            const newCustomerId = createData.data?.customerCreate?.customer?.id;

            // Then, update the marketing consent with timestamp
            const consentResponse = await admin.graphql(
                `mutation customerEmailMarketingConsentUpdate($input: CustomerEmailMarketingConsentUpdateInput!) {
                    customerEmailMarketingConsentUpdate(input: $input) {
                        customer {
                            id
                            email
                            emailMarketingConsent {
                                marketingState
                                marketingOptInLevel
                                consentUpdatedAt
                            }
                        }
                        userErrors {
                            field
                            message
                        }
                    }
                }`,
                {
                    variables: {
                        input: {
                            customerId: newCustomerId,
                            emailMarketingConsent: {
                                marketingState: "SUBSCRIBED",
                                marketingOptInLevel: "SINGLE_OPT_IN",   
                                consentUpdatedAt: new Date().toISOString()
                            }
                        }
                    }
                }
            );

            const consentData = await consentResponse.json();

            if (consentData.data?.customerEmailMarketingConsentUpdate?.userErrors?.length > 0) {
                return new Response(
                    JSON.stringify({ 
                        success: false, 
                        error: consentData.data.customerEmailMarketingConsentUpdate.userErrors 
                    }),
                    { status: 400 }
                );
            }

            return new Response(
                JSON.stringify({ 
                    success: true, 
                    message: "Customer created and subscribed successfully.",
                    customer: consentData.data.customerEmailMarketingConsentUpdate.customer
                }),
                { status: 201 }
            );

        } else {
            console.log('Customer exists - updating subscription');
            
            const updateResponse = await admin.graphql(
                `mutation customerEmailMarketingConsentUpdate($input: CustomerEmailMarketingConsentUpdateInput!) {
                    customerEmailMarketingConsentUpdate(input: $input) {
                        customer {
                            id
                            email
                            emailMarketingConsent {
                                marketingState
                                marketingOptInLevel
                                consentUpdatedAt
                            }
                        }
                        userErrors {
                            field
                            message
                        }
                    }
                }`,
                {
                    variables: {
                        input: {
                            customerId: existingCustomer.id,
                            emailMarketingConsent: {
                                marketingState: "SUBSCRIBED",
                                marketingOptInLevel: "SINGLE_OPT_IN",
                                consentUpdatedAt: new Date().toISOString()
                            }
                        }
                    }
                }
            );

            const updateData = await updateResponse.json();

            if (updateData.data?.customerEmailMarketingConsentUpdate?.userErrors?.length > 0) {
                return new Response(
                    JSON.stringify({ 
                        success: false, 
                        error: updateData.data.customerEmailMarketingConsentUpdate.userErrors 
                    }),
                    { status: 400 }
                );
            }

            return new Response(
                JSON.stringify({ 
                    success: true, 
                    message: "Subscription updated successfully.",
                    customer: updateData.data.customerEmailMarketingConsentUpdate.customer
                }),
                { status: 200 }
            );
        }

    } catch (error) {
        if(error instanceof Error){
            console.log(`An error occurred while subscribing customer: ${error.message}`);
        }else{
            console.log(`An unknown error occurred.`);
        }

        return new Response(JSON.stringify({success: false, error:"Internal server error."}),{status: 500})
    }
}
