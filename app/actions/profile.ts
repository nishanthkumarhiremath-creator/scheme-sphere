"use server";

import { prisma } from "@/lib/prisma";

type UserProfileInput = {
    age?: number | string | null;
    gender?: string | null;
    category: string;
    occupation: string;
    state: string;
    incomeLimit: string;
};

function normalizeAge(age: UserProfileInput["age"]) {
  if (age === undefined || age === null || age === "") {
    return null;
  }

  const parsedAge = typeof age === "number" ? age : Number(age);

  return Number.isFinite(parsedAge) ? parsedAge : null;
}

// 1. Save or update the user profile
export async function saveUserProfile(
    userId: string,
    data: UserProfileInput
) {
  if (!userId) {
    throw new Error("Unauthorized access. Missing valid token ID.");
  }

  const age = normalizeAge(data.age);

  return await prisma.userProfile.upsert({
    where: { userId },
    update: {
      age,
      gender: data.gender || null,
      category: data.category,
      occupation: data.occupation,
      state: data.state,
      incomeLimit: data.incomeLimit
    },
    create: {
      userId,
      age,
      gender: data.gender || null,
      category: data.category,
      occupation: data.occupation,
      state: data.state,
      incomeLimit: data.incomeLimit
    }
  });
}

// 2. Fetch the user profile safely via passed userId parameter
export async function getUserProfile(userId: string) {
  if (!userId) return null;

  return await prisma.userProfile.findUnique({
    where: { userId }
  });
}
