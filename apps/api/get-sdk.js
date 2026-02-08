const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const app = await prisma.application.findFirst({
    select: { sdkKey: true, name: true }
  });
  console.log('SDK Key:', app.sdkKey);
  console.log('App Name:', app.name);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
