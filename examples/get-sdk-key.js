const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const app = await prisma.application.findFirst({
    select: { sdkKey: true, name: true }
  });
  console.log('\n=== SDK Key ===');
  console.log('Application:', app.name);
  console.log('SDK Key:', app.sdkKey);
  console.log('===============\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
