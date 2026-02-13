/* eslint-disable import/no-anonymous-default-export */

import { mockDeep, DeepMockProxy } from "jest-mock-extended";
import { PrismaClient } from "@prisma/client";

// Typed deep mock of PrismaClient
const mocked = mockDeep<PrismaClient>();

// Export as the `prisma` object used across the codebase
export const prisma = mocked as unknown as DeepMockProxy<PrismaClient>;

export default { prisma };
