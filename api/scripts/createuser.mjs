import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

await prisma.$connect();

const usr = await prisma.account.create({
    data: {
        username: process.argv[2],
        passwordHash:
            '$2a$10$Ta2ZnpdYM63IMWwRiSRDS.tChZEOqAFb1pOpTAoIo4qgqn8iRF.Xa',
        user: {
            create: {
                relations: [],
            },
        },
    },
});

console.log(usr);
