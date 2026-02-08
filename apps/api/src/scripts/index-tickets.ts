/**
 * Script to bulk-index existing tickets in Meilisearch
 * Run with: npx ts-node src/scripts/index-tickets.ts
 */

import { PrismaClient } from '@prisma/client';
import { MeiliSearch } from 'meilisearch';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });

const prisma = new PrismaClient();

async function indexTickets() {
  const meilisearchHost = process.env.MEILISEARCH_HOST || 'http://localhost:7700';
  const meilisearchKey = process.env.MEILISEARCH_MASTER_KEY;

  console.log('🔍 Connecting to Meilisearch at:', meilisearchHost);

  const client = new MeiliSearch({
    host: meilisearchHost,
    apiKey: meilisearchKey,
  });

  const index = client.index('tickets');

  try {
    // Fetch all tickets from database
    console.log('📥 Fetching tickets from database...');
    const tickets = await prisma.ticket.findMany({
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        type: true,
        severity: true,
        aiSummary: true,
        keywords: true,
        tenantId: true,
        applicationId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (tickets.length === 0) {
      console.log('⚠️  No tickets found in database');
      return;
    }

    console.log(`📊 Found ${tickets.length} tickets`);

    // Transform tickets for Meilisearch
    const documents = tickets.map((ticket) => ({
      id: ticket.id,
      title: ticket.title,
      description: ticket.description,
      status: ticket.status,
      type: ticket.type,
      severity: ticket.severity,
      aiSummary: ticket.aiSummary,
      keywords: ticket.keywords || [],
      tenantId: ticket.tenantId,
      applicationId: ticket.applicationId,
      createdAt: new Date(ticket.createdAt).getTime(),
      updatedAt: new Date(ticket.updatedAt).getTime(),
    }));

    // Index documents
    console.log('📤 Indexing tickets in Meilisearch...');
    const result = await index.addDocuments(documents);

    console.log('✅ Indexing task created:', result.taskUid);
    console.log('⏳ Waiting for indexing to complete...');

    // Wait for indexing to complete
    await client.waitForTask(result.taskUid);

    console.log('✨ Successfully indexed', tickets.length, 'tickets!');

    // Show stats
    const stats = await index.getStats();
    console.log('📈 Index stats:', {
      numberOfDocuments: stats.numberOfDocuments,
      isIndexing: stats.isIndexing,
    });
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

indexTickets();