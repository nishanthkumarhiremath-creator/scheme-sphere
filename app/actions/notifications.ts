"use server";

import { Gender } from "@prisma/client";

import { prisma } from "@/lib/db";

export type UserNotification = {
  id: string;
  title: string;
  message: string;
  category: string;
  createdAt: string;
  link?: string;
  readAt?: string | null;
};

function parseIncomeLimit(value: string) {
  const normalized = value.replace(/,/g, "");
  const amount = normalized.match(/(\d+(?:\.\d+)?)/)?.[1];

  if (!amount) {
    return null;
  }

  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount)) {
    return null;
  }

  return /lpa|lakh|lakhs/i.test(normalized)
    ? Math.round(numericAmount * 100000)
    : Math.round(numericAmount);
}

function normalizeGender(value?: string | null) {
  if (!value || value === "Any") {
    return Gender.ANY;
  }

  const upperValue = value.toUpperCase();

  if (upperValue === "TRANSGENDER") {
    return Gender.OTHER;
  }

  return Object.values(Gender).includes(upperValue as Gender)
    ? (upperValue as Gender)
    : Gender.ANY;
}

function toUserNotification(notification: {
  id: string;
  title: string;
  message: string;
  category: string;
  createdAt: Date;
  link: string | null;
  readAt: Date | null;
}): UserNotification {
  return {
    id: notification.id,
    title: notification.title,
    message: notification.message,
    category: notification.category,
    createdAt: notification.createdAt.toISOString(),
    link: notification.link ?? undefined,
    readAt: notification.readAt?.toISOString() ?? null
  };
}

export async function getUserNotifications(
  userId: string
): Promise<UserNotification[]> {
  if (!userId) {
    return [];
  }

  try {
    const profile = await prisma.userProfile.findUnique({
      where: { userId }
    });

    if (!profile) {
      return [];
    }

    const state = profile.state.trim();
    const category = profile.category.trim();
    const occupation = profile.occupation.trim();
    const incomeLimit = parseIncomeLimit(profile.incomeLimit);
    const gender = normalizeGender(profile.gender);

    const candidateSchemes = await prisma.scheme.findMany({
      where: {
        OR: [
          { states: { has: state } },
          { categories: { has: category } },
          { occupation: { contains: occupation, mode: "insensitive" } }
        ]
      },
      orderBy: {
        updatedAt: "desc"
      },
      take: 12
    });

    const matchedSchemes = candidateSchemes
      .filter((scheme) => {
        if (profile.age && scheme.minAge && profile.age < scheme.minAge) {
          return false;
        }

        if (profile.age && scheme.maxAge && profile.age > scheme.maxAge) {
          return false;
        }

        if (
          incomeLimit &&
          scheme.incomeLimit &&
          incomeLimit > scheme.incomeLimit
        ) {
          return false;
        }

        if (gender !== Gender.ANY && scheme.gender !== Gender.ANY) {
          return scheme.gender === gender;
        }

        return true;
      })
      .slice(0, 8);

    const profileNotifications = [
      {
        fingerprint: `profile-state-${profile.id}`,
        title: `${state} eligibility alerts are active`,
        message: `SchemeSphere is monitoring scheme updates for ${state} residents in your profile matrix.`,
        category: "State",
        link: "/search"
      },
      {
        fingerprint: `profile-demographic-${profile.id}`,
        title: "Profile matrix monitoring enabled",
        message: `Alerts now include ${profile.gender ?? "Any gender"}, ${
          profile.age ? `age ${profile.age}` : "all ages"
        }, ${category}, ${occupation}, and ${profile.incomeLimit}.`,
        category: "Profile",
        link: "/dashboard"
      }
    ];

    const schemeNotifications = matchedSchemes.map((scheme) => ({
      fingerprint: `scheme-${scheme.id}`,
      schemeId: scheme.id,
      title: scheme.title,
      message:
        scheme.summary ||
        scheme.benefits ||
        `This scheme appears to match your ${category} profile in ${state}.`,
      category: scheme.categories[0] || "Scheme",
      link: scheme.officialLink
    }));

    await Promise.all(
      [...schemeNotifications, ...profileNotifications].map((notification) => {
        const schemeId =
          "schemeId" in notification &&
          typeof notification.schemeId === "string"
            ? notification.schemeId
            : null;

        return prisma.notification.upsert({
          where: {
            userId_fingerprint: {
              userId,
              fingerprint: notification.fingerprint
            }
          },
          update: {
            category: notification.category,
            link: notification.link,
            message: notification.message,
            schemeId,
            title: notification.title
          },
          create: {
            category: notification.category,
            fingerprint: notification.fingerprint,
            link: notification.link,
            message: notification.message,
            schemeId,
            title: notification.title,
            userId
          }
        });
      })
    );

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: {
        createdAt: "desc"
      },
      take: 50
    });

    return notifications.map(toUserNotification);
  } catch (error) {
    console.error("Notification pipeline error:", error);
    return [];
  }
}

export async function getUnreadNotificationCount(userId: string) {
  if (!userId) {
    return 0;
  }

  try {
    return await prisma.notification.count({
      where: {
        readAt: null,
        userId
      }
    });
  } catch (error) {
    console.error("Unread notification count error:", error);
    return 0;
  }
}

export async function markUserNotificationsRead(userId: string) {
  if (!userId) {
    return { updated: 0 };
  }

  try {
    const result = await prisma.notification.updateMany({
      data: {
        readAt: new Date()
      },
      where: {
        readAt: null,
        userId
      }
    });

    return { updated: result.count };
  } catch (error) {
    console.error("Mark notifications read error:", error);
    return { updated: 0 };
  }
}
