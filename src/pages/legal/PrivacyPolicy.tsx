import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PrivacyPolicy = () => {
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
            <CardTitle className="text-3xl">Privacy Policy</CardTitle>
            <p className="text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none space-y-6">
            <section>
              <h2 className="text-xl font-semibold mb-3">1. Introduction</h2>
              <p className="text-muted-foreground">
                Welcome to Blue Harvests. We respect your privacy and are committed to protecting your personal data. 
                This privacy policy will inform you about how we look after your personal data when you visit our platform 
                and tell you about your privacy rights and how the law protects you.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">2. Information We Collect</h2>
              <p className="text-muted-foreground mb-2">We collect and process the following types of information:</p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                <li><strong>Identity Data:</strong> Full name, email address, phone number</li>
                <li><strong>Profile Data:</strong> Delivery address, ZIP code, farm information</li>
                <li><strong>Transaction Data:</strong> Order details, payment information, delivery dates</li>
                <li><strong>Technical Data:</strong> IP address, browser type, device information</li>
                <li><strong>Usage Data:</strong> How you use our platform, products viewed, pages visited</li>
                <li><strong>Documents:</strong> Driver's licenses, insurance certificates, COI documents (for verification)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">3. How We Use Your Information</h2>
              <p className="text-muted-foreground mb-2">We use your personal data to:</p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                <li>Process and fulfill your orders</li>
                <li>Manage your account and provide customer support</li>
                <li>Verify identity and credentials for farmers and drivers</li>
                <li>Process payments and prevent fraud</li>
                <li>Send you important updates about your orders and account</li>
                <li>Improve our platform and user experience</li>
                <li>Comply with legal obligations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">4. Data Sharing</h2>
              <p className="text-muted-foreground mb-2">
                We may share your personal data with:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                <li>Farmers and drivers to fulfill your orders</li>
                <li>Payment processors to handle transactions securely</li>
                <li>Service providers who help us operate our platform</li>
                <li>Law enforcement when required by law</li>
              </ul>
              <p className="text-muted-foreground mt-2">
                We never sell your personal data to third parties.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">5. Data Security</h2>
              <p className="text-muted-foreground">
                We implement appropriate security measures to protect your personal data against unauthorized access, 
                alteration, disclosure, or destruction. All payment information is encrypted using SSL technology. 
                Sensitive documents are stored securely with restricted access.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">6. Your Rights</h2>
              <p className="text-muted-foreground mb-2">You have the right to:</p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                <li>Access your personal data</li>
                <li>Correct inaccurate data</li>
                <li>Request deletion of your data</li>
                <li>Object to processing of your data</li>
                <li>Request transfer of your data</li>
                <li>Withdraw consent whenever you choose</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">7. Cookies</h2>
              <p className="text-muted-foreground">
                We use cookies to improve your experience on our platform. Cookies help us remember your preferences, 
                understand how you use our site, and provide personalized content. You can control cookies through 
                your browser settings.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">8. Data Retention</h2>
              <p className="text-muted-foreground">
                We retain your personal data only for as long as necessary to fulfill the purposes outlined in this policy 
                or as required by law. Order data is typically retained for 7 years for tax and accounting purposes.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">9. Children's Privacy</h2>
              <p className="text-muted-foreground">
                Our platform is not intended for children under 18 years of age. We do not knowingly collect personal 
                data from children. If you believe we have collected information from a child, please contact us immediately.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">10. Changes to This Policy</h2>
              <p className="text-muted-foreground">
                We may update this privacy policy from time to time. We will notify you of changes by posting the
                new policy on this page and updating the "Last updated" date.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">11. Contact Us</h2>
              <p className="text-muted-foreground">
                If you have questions about this privacy policy or our privacy practices, please contact us at:
              </p>
              <p className="text-muted-foreground mt-2">
                Email: privacy@blueharvests.com<br />
                Phone: (555) 123-4567
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
