import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms of Service for Support Helper',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Link href="/login" className="text-sm text-primary hover:underline">
            &larr; Back
          </Link>
        </div>

        <div className="bg-card border rounded-lg p-8 shadow-sm space-y-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
            <p className="mt-2 text-sm text-muted-foreground">Last updated: February 2026</p>
          </div>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              By accessing or using Support Helper (&quot;the Service&quot;), you agree to be bound by these
              Terms of Service. If you do not agree to these terms, please do not use the Service.
              These terms apply to all users, including organization owners, administrators, and members.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">2. Use License</h2>
            <p className="text-muted-foreground leading-relaxed">
              Subject to your compliance with these Terms, Support Helper grants you a limited,
              non-exclusive, non-transferable, revocable license to access and use the Service for
              your internal business purposes. You may not sublicense, sell, resell, transfer, assign,
              or otherwise exploit the Service for commercial purposes without our express written consent.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              You agree not to: (a) reverse engineer or attempt to extract the source code of the
              Service; (b) use the Service to transmit harmful, offensive, or unlawful content;
              (c) interfere with or disrupt the integrity or performance of the Service; or
              (d) attempt to gain unauthorized access to any part of the Service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">3. Disclaimer</h2>
            <p className="text-muted-foreground leading-relaxed">
              The Service is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind,
              either express or implied, including but not limited to implied warranties of
              merchantability, fitness for a particular purpose, or non-infringement. Support Helper
              does not warrant that the Service will be uninterrupted, error-free, or free of
              viruses or other harmful components.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">4. Limitations of Liability</h2>
            <p className="text-muted-foreground leading-relaxed">
              To the fullest extent permitted by applicable law, Support Helper and its affiliates,
              officers, employees, and agents shall not be liable for any indirect, incidental,
              special, consequential, or punitive damages, including but not limited to loss of
              profits, data, goodwill, or other intangible losses, arising from your use of or
              inability to use the Service.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              In no event shall our total liability to you for all claims relating to the Service
              exceed the amount you paid us in the twelve months preceding the claim.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">5. Account Responsibilities</h2>
            <p className="text-muted-foreground leading-relaxed">
              You are responsible for maintaining the confidentiality of your account credentials
              and for all activities that occur under your account. You agree to notify us immediately
              of any unauthorized use of your account. Support Helper cannot and will not be liable
              for any loss or damage arising from your failure to comply with this obligation.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">6. Termination</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may terminate or suspend your access to the Service immediately, without prior notice
              or liability, for any reason, including if you breach these Terms. Upon termination,
              your right to use the Service will cease. All provisions of these Terms which by their
              nature should survive termination shall survive.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">7. Governing Law</h2>
            <p className="text-muted-foreground leading-relaxed">
              These Terms shall be governed and construed in accordance with applicable law, without
              regard to its conflict of law provisions. Any disputes arising under these Terms shall
              be subject to the exclusive jurisdiction of the competent courts.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">8. Changes to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              We reserve the right to modify these Terms at any time. We will notify you of material
              changes by updating the date at the top of this page. Continued use of the Service after
              such changes constitutes your acceptance of the new Terms.
            </p>
          </section>

          <div className="border-t pt-6">
            <p className="text-sm text-muted-foreground">
              For questions about these Terms, please contact us. You may also review our{' '}
              <Link href="/privacy" className="text-primary hover:underline">
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
