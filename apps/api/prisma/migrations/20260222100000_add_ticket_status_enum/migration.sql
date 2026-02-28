-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM (
  'new',
  'open',
  'in_progress',
  'pending',
  'analyzing',
  'analyzed',
  'analysis_failed',
  'triaged',
  'waiting',
  'waiting_response',
  'escalated',
  'fix_proposed',
  'resolved',
  'merged',
  'closed'
);

-- AlterTable: convert status column from VARCHAR to enum
-- First cast all existing values; unknown values fall back to 'new'
ALTER TABLE "tickets"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "TicketStatus"
    USING (
      CASE "status"
        WHEN 'new'              THEN 'new'::"TicketStatus"
        WHEN 'open'             THEN 'open'::"TicketStatus"
        WHEN 'in_progress'      THEN 'in_progress'::"TicketStatus"
        WHEN 'pending'          THEN 'pending'::"TicketStatus"
        WHEN 'analyzing'        THEN 'analyzing'::"TicketStatus"
        WHEN 'analyzed'         THEN 'analyzed'::"TicketStatus"
        WHEN 'analysis_failed'  THEN 'analysis_failed'::"TicketStatus"
        WHEN 'triaged'          THEN 'triaged'::"TicketStatus"
        WHEN 'waiting'          THEN 'waiting'::"TicketStatus"
        WHEN 'waiting_response' THEN 'waiting_response'::"TicketStatus"
        WHEN 'escalated'        THEN 'escalated'::"TicketStatus"
        WHEN 'fix_proposed'     THEN 'fix_proposed'::"TicketStatus"
        WHEN 'resolved'         THEN 'resolved'::"TicketStatus"
        WHEN 'merged'           THEN 'merged'::"TicketStatus"
        WHEN 'closed'           THEN 'closed'::"TicketStatus"
        ELSE 'new'::"TicketStatus"
      END
    ),
  ALTER COLUMN "status" SET DEFAULT 'new'::"TicketStatus";
