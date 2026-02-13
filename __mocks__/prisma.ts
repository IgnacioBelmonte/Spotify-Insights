// Jest manual mock for Prisma client
import { DeepMockProxy, mockDeep } from "jest-mock-extended";
import { PrismaClient } from "@prisma/client";

jest.mock("@/src/lib/db/prisma", () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>() as unknown as DeepMockProxy<PrismaClient>,
}));
