import { prisma } from '../db/prisma.js';

export async function getMemberTeam(teamId, userId) {
  const membership = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
    include: { team: true },
  });
  if (membership) return membership;
  const team = await prisma.team.findFirst({ where: { id: teamId, createdById: userId } });
  return team ? { team, teamId, userId, role: 'Lead' } : null;
}

export function isTeamLead(membership) {
  return membership?.role === 'Lead';
}
