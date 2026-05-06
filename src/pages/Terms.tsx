import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText } from 'lucide-react';

export default function Terms() {
  return (
    <Layout>
      <div className="container py-8 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold font-display flex items-center justify-center gap-2">
            <FileText className="h-8 w-8 text-primary" />
            Terms and Conditions
          </h1>
          <p className="text-muted-foreground">Last updated: January 2026</p>
        </div>

        <Card>
          <CardContent className="py-6">
            <ScrollArea className="h-[600px] pr-4">
              <div className="space-y-6 text-sm leading-relaxed">
                <section className="space-y-2">
                  <h2 className="text-lg font-semibold">1. Acceptance of Terms</h2>
                  <p className="text-muted-foreground">
                    By accessing and using Bestonconnect, you accept and agree to be bound by the terms and provisions 
                    of this agreement. If you do not agree to abide by these terms, please do not use this service.
                  </p>
                </section>

                <section className="space-y-2">
                  <h2 className="text-lg font-semibold">2. User Accounts</h2>
                  <p className="text-muted-foreground">
                    When you create an account with us, you must provide information that is accurate, complete, and 
                    current at all times. Failure to do so constitutes a breach of the Terms, which may result in 
                    immediate termination of your account on our platform.
                  </p>
                </section>

                <section className="space-y-2">
                  <h2 className="text-lg font-semibold">3. Promoter Terms</h2>
                  <p className="text-muted-foreground">
                    As a promoter on Bestonconnect, you agree to:
                  </p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                    <li>Promote products honestly and accurately</li>
                    <li>Not engage in fraudulent activities or fake referrals</li>
                    <li>Comply with all applicable laws and regulations</li>
                    <li>Maintain accurate banking information for withdrawals</li>
                    <li>Accept that commissions are subject to return window policies</li>
                  </ul>
                </section>

                <section className="space-y-2">
                  <h2 className="text-lg font-semibold">4. Commission and Payments</h2>
                  <p className="text-muted-foreground">
                    Commission rates are set by Bestonconnect and may vary by product category. Payments are processed 
                    after a specified return window period. We reserve the right to withhold or reverse commissions in 
                    cases of fraud, returns, or policy violations.
                  </p>
                </section>

                <section className="space-y-2">
                  <h2 className="text-lg font-semibold">5. Buyer Terms</h2>
                  <p className="text-muted-foreground">
                    As a buyer on Bestonconnect, you agree to:
                  </p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                    <li>Provide accurate shipping and payment information</li>
                    <li>Pay for all orders placed through the platform</li>
                    <li>Report any issues within the specified timeframe</li>
                    <li>Use products in accordance with their intended purpose</li>
                  </ul>
                </section>

                <section className="space-y-2">
                  <h2 className="text-lg font-semibold">6. Returns and Refunds</h2>
                  <p className="text-muted-foreground">
                    Return policies vary by product. Please refer to individual product pages for specific return 
                    information. Refunds will be processed within 7-14 business days after the return is received 
                    and approved.
                  </p>
                </section>

                <section className="space-y-2">
                  <h2 className="text-lg font-semibold">7. Privacy Policy</h2>
                  <p className="text-muted-foreground">
                    Your privacy is important to us. We collect and use your personal information in accordance with 
                    our Privacy Policy. By using our service, you consent to such collection and use.
                  </p>
                </section>

                <section className="space-y-2">
                  <h2 className="text-lg font-semibold">8. Intellectual Property</h2>
                  <p className="text-muted-foreground">
                    The platform and its original content, features, and functionality are owned by Bestonconnect 
                    and are protected by international copyright, trademark, patent, trade secret, and other 
                    intellectual property laws.
                  </p>
                </section>

                <section className="space-y-2">
                  <h2 className="text-lg font-semibold">9. Limitation of Liability</h2>
                  <p className="text-muted-foreground">
                    In no event shall Bestonconnect, nor its directors, employees, partners, agents, suppliers, or 
                    affiliates, be liable for any indirect, incidental, special, consequential, or punitive damages, 
                    including without limitation, loss of profits, data, use, goodwill, or other intangible losses.
                  </p>
                </section>

                <section className="space-y-2">
                  <h2 className="text-lg font-semibold">10. Changes to Terms</h2>
                  <p className="text-muted-foreground">
                    We reserve the right, at our sole discretion, to modify or replace these Terms at any time. 
                    We will provide notice of any changes by posting the new Terms on this page. Your continued 
                    use of the platform after any changes constitutes acceptance of those changes.
                  </p>
                </section>

                <section className="space-y-2">
                  <h2 className="text-lg font-semibold">11. Contact Us</h2>
                  <p className="text-muted-foreground">
                    If you have any questions about these Terms, please contact us at{' '}
                    <a href="mailto:legal@bestonconnect.com" className="text-primary hover:underline">
                      legal@bestonconnect.com
                    </a>
                  </p>
                </section>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
