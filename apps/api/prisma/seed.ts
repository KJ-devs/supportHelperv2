import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Clean existing data
  await prisma.agentMessage.deleteMany();
  await prisma.agentSession.deleteMany();
  await prisma.classificationFeedback.deleteMany();
  await prisma.videoEvent.deleteMany();
  await prisma.media.deleteMany();
  await prisma.githubIssue.deleteMany();
  await prisma.githubConnection.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.application.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();

  // Create test tenant
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Test Company',
      slug: 'test-company',
      plan: 'pro',
      settings: {
        maxVideoSize: 100000000, // 100MB
        maxTicketsPerMonth: 500,
      },
    },
  });

  console.log(`✅ Created tenant: ${tenant.id}`);

  // Create test users
  const passwordHash = await bcrypt.hash('password123', 10);

  const owner = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'owner@test.local',
      name: 'Owner User',
      role: 'owner',
      passwordHash,
      authProvider: 'email',
    },
  });

  const support = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'support@test.local',
      name: 'Support Agent',
      role: 'support',
      passwordHash,
      authProvider: 'email',
    },
  });

  console.log(`✅ Created users: ${owner.id}, ${support.id}`);

  // Create test application
  const application = await prisma.application.create({
    data: {
      tenantId: tenant.id,
      name: 'My Awesome App',
      platform: 'web',
      sdkKey: 'sdk_test_default_key_12345',
      settings: {
        recordVideo: true,
        captureLogs: true,
      },
    },
  });

  console.log(`✅ Created application: ${application.id}`);

  // Create test tickets - generate enough to test pagination
  const statuses = ['new', 'open', 'in_progress', 'resolved', 'closed'] as const;
  const types = ['bug', 'crash', 'performance', 'ui', 'feature_request', 'other'] as const;
  const severities = ['critical', 'high', 'medium', 'low'] as const;
  const browsers = ['Chrome 120', 'Firefox 121', 'Safari 17', 'Edge 120'];
  const osList = ['Windows 11', 'macOS Sonoma', 'Ubuntu 22.04', 'iOS 17', 'Android 14'];

  const ticketTemplates = [
    {
      title: 'App crashes when uploading files',
      desc: 'The application crashes when trying to upload files larger than 50MB.',
    },
    {
      title: 'Performance issue on dashboard',
      desc: 'Dashboard takes about 10 seconds to load with large datasets.',
    },
    {
      title: 'Login button unresponsive',
      desc: 'Clicking the login button does nothing on mobile browsers.',
    },
    {
      title: 'Dark mode toggle broken',
      desc: 'Switching to dark mode causes text to become invisible.',
    },
    {
      title: 'Search returns wrong results',
      desc: 'Search for exact ticket titles returns unrelated tickets.',
    },
    {
      title: 'Export to CSV fails silently',
      desc: 'Clicking export button produces no file download.',
    },
    {
      title: 'Notification bell shows wrong count',
      desc: 'Notification badge shows 99+ but there are only 3 notifications.',
    },
    {
      title: 'Form validation bypassed',
      desc: 'Submitting empty required fields does not show errors.',
    },
    {
      title: 'Video player controls missing',
      desc: 'Play/pause buttons do not render on iOS Safari.',
    },
    {
      title: 'Memory leak in real-time updates',
      desc: 'Browser tab memory grows to 2GB after 1 hour.',
    },
    {
      title: 'API returns 500 on date filter',
      desc: 'Filtering tickets by date range causes server error.',
    },
    {
      title: 'Image thumbnails not loading',
      desc: 'Screenshot thumbnails show broken image placeholder.',
    },
    {
      title: 'Keyboard shortcuts conflict',
      desc: 'Ctrl+S triggers both save and browser bookmark.',
    },
    {
      title: 'Multi-select dropdown clips offscreen',
      desc: 'Filter dropdowns clip at bottom of screen on small viewports.',
    },
    {
      title: 'Email notifications delayed',
      desc: 'Assignment emails arrive 30+ minutes after action.',
    },
  ];

  const createdTicketIds: string[] = [];
  const now = Date.now();

  for (let i = 0; i < 50; i++) {
    const template = ticketTemplates[i % ticketTemplates.length];
    const status = statuses[i % statuses.length];
    const type = types[i % types.length];
    const severity = severities[i % severities.length];
    const isResolved = status === 'resolved' || status === 'closed';
    const daysAgo = Math.floor(Math.random() * 60);
    const createdAt = new Date(now - daysAgo * 24 * 60 * 60 * 1000);

    const ticket = await prisma.ticket.create({
      data: {
        tenantId: tenant.id,
        applicationId: application.id,
        reporterId: i % 3 === 0 ? owner.id : i % 3 === 1 ? support.id : null,
        title: i < ticketTemplates.length ? template.title : `${template.title} (#${i + 1})`,
        description: template.desc,
        status,
        type,
        typeConfidence: +(0.7 + Math.random() * 0.3).toFixed(2),
        severity,
        severityConfidence: +(0.6 + Math.random() * 0.4).toFixed(2),
        assignedTo: i % 4 === 0 ? support.id : null,
        assignedAt: i % 4 === 0 ? createdAt : null,
        resolvedAt: isResolved
          ? new Date(createdAt.getTime() + Math.random() * 7 * 24 * 60 * 60 * 1000)
          : null,
        createdAt,
        userContext: {
          os: osList[i % osList.length],
          browser: browsers[i % browsers.length],
          viewport: { width: 1920, height: 1080 },
          url: `https://app.example.com/page-${i}`,
        },
        aiSummary: i % 2 === 0 ? `AI analysis: ${template.desc}` : null,
        aiAnalysis: i % 3 === 0 ? { severity, type, keywords: [type, severity] } : undefined,
        keywords: [type, severity, 'test'].filter(Boolean) as string[],
      },
    });
    createdTicketIds.push(ticket.id);
  }

  console.log(`  Created ${createdTicketIds.length} tickets`);

  // Create agent session for the second ticket
  const agentSession = await prisma.agentSession.create({
    data: {
      ticketId: createdTicketIds[1],
      status: 'active',
      agentState: {
        phase: 'analyzing',
      },
    },
  });

  // Create agent messages
  await prisma.agentMessage.create({
    data: {
      sessionId: agentSession.id,
      role: 'assistant',
      content:
        'I analyzed the issue. It seems like a rendering performance problem. Have you tried implementing pagination?',
      channel: 'system',
    },
  });

  console.log(`✅ Created agent session: ${agentSession.id}`);

  console.log('✨ Seed completed successfully!');
}

main()
  .catch(e => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
