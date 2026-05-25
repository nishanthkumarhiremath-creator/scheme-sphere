"use server";

import { prisma } from "@/lib/prisma";

export type BookmarkSchemeInput = {
  schemeId: string;
  title: string;
  benefit: string;
  link: string;
};

export async function toggleBookmark(
  userId: string,
  scheme: BookmarkSchemeInput
) {
  if (!userId) {
    throw new Error("Unauthorized access. Missing valid user ID.");
  }

  const existing = await prisma.bookmark.findUnique({
    where: {
      userId_schemeId: {
        userId,
        schemeId: scheme.schemeId
      }
    }
  });

  if (existing) {
    await prisma.bookmark.delete({
      where: {
        id: existing.id
      }
    });

    return { bookmarked: false };
  }

  const bookmark = await prisma.bookmark.create({
    data: {
      userId,
      schemeId: scheme.schemeId,
      title: scheme.title,
      benefit: scheme.benefit,
      link: scheme.link
    }
  });

  return { bookmarked: true, bookmark };
}

export async function getSavedBookmarks(userId: string) {
  if (!userId) {
    return [];
  }

  return prisma.bookmark.findMany({
    where: { userId },
    orderBy: {
      createdAt: "desc"
    }
  });
}
