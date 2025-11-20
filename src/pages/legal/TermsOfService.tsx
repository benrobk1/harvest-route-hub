import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const TermsOfService = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-earth p-4">
      <div className="container max-w-4xl mx-auto py-8">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">Terms of Service</CardTitle>
            <p className="text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none space-y-6">
            <section>
              <h2 className="text-xl font-semibold mb-3">1. Acceptance of Terms</h2>
              <p className="text-muted-foreground">
                By accessing and using Blue Harvests ("Platform"), you accept and agree to be bound by the terms and 
                provision of this agreement. If you do not agree to these terms, please do not use our Platform.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">2. Description of Service</h2>
              <p className="text-muted-foreground">
                Blue Harvests is a local food marketplace platform connecting consumers with local farmers and managing 
                delivery logistics. We facilitate transactions between buyers and sellers but are not party to the actual 
                sales contracts between them.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">3. User Accounts</h2>
              <p className="text-muted-foreground mb-2">To use our Platform, you must:</p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                <li>Be at least 18 years of age</li>
                <li>Provide accurate, current, and complete information during registration</li>
                <li>Maintain the security of your account credentials</li>
                <li>Accept responsibility for all activities that occur under your account</li>
                <li>Notify us immediately about unauthorized use of your account</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">4. User Roles and Responsibilities</h2>
              
              <h3 className="font-semibold mt-4 mb-2">4.1 Consumers</h3>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                <li>Provide accurate delivery information</li>
                <li>Be available to receive deliveries at scheduled times</li>
                <li>Pay for orders in full and on time</li>
                <li>Report issues with orders promptly</li>
              </ul>

              <h3 className="font-semibold mt-4 mb-2">4.2 Farmers</h3>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                <li>Provide accurate product descriptions and pricing</li>
                <li>Maintain required insurance and certifications</li>
                <li>Deliver products as described and on time</li>
                <li>Comply with all food safety regulations</li>
                <li>Respond promptly to customer inquiries</li>
              </ul>

              <h3 className="font-semibold mt-4 mb-2">4.3 Drivers</h3>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                <li>Maintain valid driver's license and insurance</li>
                <li>Complete deliveries safely and on time</li>
                <li>Handle products with care</li>
                <li>Maintain professional conduct with customers</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">5. Verification and Approval</h2>
              <p className="text-muted-foreground">
                Farmers and drivers must submit required documentation for verification before being approved to use the Platform. 
                We reserve the right to reject applications or suspend accounts that do not meet our standards.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">6. Orders and Payments</h2>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                <li>All orders are subject to product availability</li>
                <li>Prices are subject to change without notice</li>
                <li>Payment is due at the time of order placement</li>
                <li>A 10% platform fee applies to all orders</li>
                <li>Delivery fees vary by location</li>
                <li>Credits may be awarded for promotional purposes and expire as specified</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">7. Cancellations and Refunds</h2>
              <p className="text-muted-foreground mb-2">
                Orders can be cancelled before the cutoff time specified for your delivery date. Cancellations after 
                cutoff time are subject to farmer approval. Refunds are provided for:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                <li>Cancelled orders within the allowable timeframe</li>
                <li>Defective or incorrect products</li>
                <li>Undelivered orders due to Platform error</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">8. Payouts</h2>
              <p className="text-muted-foreground">
                Farmers receive 90% of product sales, and drivers receive delivery fees. Payouts are processed via 
                Stripe Connect after order completion. Users must complete onboarding and maintain valid payment 
                account information.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">9. Intellectual Property</h2>
              <p className="text-muted-foreground">
                All content on the Platform, including text, graphics, logos, and software, is the property of 
                Blue Harvests or its content suppliers and is protected by intellectual property laws.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">10. Prohibited Activities</h2>
              <p className="text-muted-foreground mb-2">You agree not to:</p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                <li>Violate laws or regulations</li>
                <li>Infringe on others' rights</li>
                <li>Transmit harmful code or malware</li>
                <li>Attempt to gain unauthorized access to the Platform</li>
                <li>Harass or abuse other users</li>
                <li>Provide false or misleading information</li>
                <li>Engage in fraudulent activities</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">11. Limitation of Liability</h2>
              <p className="text-muted-foreground">
                To the maximum extent permitted by law, Blue Harvests shall not be liable for indirect, incidental,
                special, consequential, or punitive damages, or for loss of profits or revenues, whether incurred directly
                or indirectly, or for loss of data, use, goodwill, or other intangible losses.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">12. Indemnification</h2>
              <p className="text-muted-foreground">
                You agree to indemnify and hold harmless Blue Harvests from claims, damages, losses, liabilities,
                and expenses arising from your use of the Platform or violation of these Terms.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">13. Termination</h2>
              <p className="text-muted-foreground">
                We reserve the right to suspend or terminate your account at our discretion for violation of these Terms or
                for other reasons. Upon termination, your right to use the Platform will
                immediately cease.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">14. Governing Law</h2>
              <p className="text-muted-foreground">
                These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which 
                Blue Harvests operates, without regard to its conflict of law provisions.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">15. Changes to Terms</h2>
              <p className="text-muted-foreground">
                We reserve the right to modify these Terms whenever necessary. We will notify users of material changes
                by posting the new Terms on this page and updating the "Last updated" date. Your continued use of the
                Platform after changes constitutes acceptance of the new Terms.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">16. Contact Information</h2>
              <p className="text-muted-foreground">
                For questions about these Terms, please contact us at:
              </p>
              <p className="text-muted-foreground mt-2">
                Email: legal@blueharvests.com<br />
                Phone: (555) 123-4567
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TermsOfService;
