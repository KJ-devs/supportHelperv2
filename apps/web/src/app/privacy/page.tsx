import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Privacy Policy for Support Helper',
};

export default function PrivacyPage() {
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
            <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
            <p className="mt-2 text-sm text-muted-foreground">Last updated: February 2026</p>
          </div>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">1. Information We Collect</h2>
            <p className="text-muted-foreground leading-relaxed">
              We collect information you provide directly to us when creating an account, such as
              your name, email address, and password. We also collect information generated through
              your use of the Service, including ticket data, video recordings submitted through
              our SDK, usage logs, and device/browser information.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              When you use our web SDK, it may collect user context such as browser type, operating
              system, viewport dimensions, and console errors to help diagnose reported issues.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">2. Use of Information</h2>
            <p className="text-muted-foreground leading-relaxed">
              We use the information we collect to: provide, maintain, and improve the Service;
              process and analyze support tickets using AI; send you notifications and updates;
              respond to your comments and questions; and monitor usage patterns to improve
              the Service.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              We do not sell your personal information to third parties. We may share aggregated,
              non-personally identifiable information publicly and with our partners.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">3. Data Protection</h2>
            <p className="text-muted-foreground leading-relaxed">
              We implement industry-standard security measures to protect your information from
              unauthorized access, alteration, disclosure, or destruction. This includes encryption
              of data in transit (TLS) and at rest, access controls, and regular security reviews.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Your data is logically isolated per organization (tenant) and our systems enforce
              strict access controls to ensure data is only accessible to authorized users within
              your organization.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">4. Data Retention</h2>
            <p className="text-muted-foreground leading-relaxed">
              We retain your data for as long as your account is active or as needed to provide
              the Service. You may request deletion of your account and associated data at any time.
              We will delete or anonymize your data within 30 days of such a request, except where
              we are required by law to retain it.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">5. Cookies</h2>
            <p className="text-muted-foreground leading-relaxed">
              We use cookies and similar tracking technologies to maintain your session and
              improve your experience. Authentication tokens are stored in your browser&apos;s
              local storage. You can control cookie behavior through your browser settings,
              though disabling certain cookies may affect the functionality of the Service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">6. Third-Party Services</h2>
            <p className="text-muted-foreground leading-relaxed">
              The Service may integrate with third-party services such as GitHub, Jira, Slack,
              and HubSpot. When you connect these integrations, you authorize us to access and
              use your data from those services as described in this policy. Third-party services
              are governed by their own privacy policies.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              We use OpenAI to analyze uploaded videos and generate AI summaries of support
              tickets. Data submitted for analysis may be processed by OpenAI in accordance
              with their data usage policies.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">7. Your Rights</h2>
            <p className="text-muted-foreground leading-relaxed">
              Depending on your location, you may have the right to access, correct, or delete
              your personal data; object to or restrict our processing of your data; and receive
              a copy of your data in a portable format. To exercise these rights, please contact us.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">8. Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have questions or concerns about this Privacy Policy or our data practices,
              please contact us through your account settings or via the support channels provided
              in the application.
            </p>
          </section>

          <div className="border-t pt-6">
            <p className="text-sm text-muted-foreground">
              You may also review our{' '}
              <Link href="/terms" className="text-primary hover:underline">
                Terms of Service
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
