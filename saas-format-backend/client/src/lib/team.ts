import { apiGet, apiPost, apiPut, apiDelete } from "./api"
import { trackEvent } from "./analytics"
import { toast } from "@/components/ui/use-toast"

export interface TeamMember {
  id: string
  userId: string
  teamId: string
  role: "owner" | "admin" | "member" | "guest"
  user: {
    id: string
    email: string
    firstName: string
    lastName: string
    avatarUrl?: string
  }
  createdAt: string
  updatedAt: string
}

export interface Team {
  id: string
  name: string
  description?: string
  avatarUrl?: string
  tenantId: string
  createdBy: string
  members: TeamMember[]
  createdAt: string
  updatedAt: string
}

export interface CreateTeamDto {
  name: string
  description?: string
}

export interface UpdateTeamDto {
  name?: string
  description?: string
}

export interface InviteTeamMemberDto {
  email: string
  role: "admin" | "member" | "guest"
  message?: string
}

export interface UpdateTeamMemberDto {
  role: "admin" | "member" | "guest"
}

// Get all teams
export const getTeams = async (): Promise<Team[]> => {
  return await apiGet<Team[]>("/teams", { cache: true })
}

// Get team by ID
export const getTeamById = async (teamId: string): Promise<Team> => {
  return await apiGet<Team>(`/teams/${teamId}`, { cache: true })
}

// Create a new team
export const createTeam = async (data: CreateTeamDto): Promise<Team> => {
  try {
    const team = await apiPost<Team>("/teams", data)

    toast({
      title: "Team created",
      description: `Team "${team.name}" has been created successfully.`,
    })

    trackEvent("team_created", {
      teamId: team.id,
      teamName: team.name,
      timestamp: new Date().toISOString(),
    })

    return team
  } catch (error) {
    throw error
  }
}

// Update a team
export const updateTeam = async (teamId: string, data: UpdateTeamDto): Promise<Team> => {
  try {
    const team = await apiPut<Team>(`/teams/${teamId}`, data)

    toast({
      title: "Team updated",
      description: `Team "${team.name}" has been updated successfully.`,
    })

    trackEvent("team_updated", {
      teamId: team.id,
      teamName: team.name,
      updatedFields: Object.keys(data),
      timestamp: new Date().toISOString(),
    })

    return team
  } catch (error) {
    throw error
  }
}

// Delete a team
export const deleteTeam = async (teamId: string): Promise<void> => {
  try {
    await apiDelete(`/teams/${teamId}`)

    toast({
      title: "Team deleted",
      description: "The team has been deleted successfully.",
    })

    trackEvent("team_deleted", {
      teamId,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    throw error
  }
}

// Get team members
export const getTeamMembers = async (teamId: string): Promise<TeamMember[]> => {
  return await apiGet<TeamMember[]>(`/teams/${teamId}/members`, { cache: true })
}

// Invite a team member
export const inviteTeamMember = async (teamId: string, data: InviteTeamMemberDto): Promise<void> => {
  try {
    await apiPost(`/teams/${teamId}/invitations`, data)

    toast({
      title: "Invitation sent",
      description: `An invitation has been sent to ${data.email}.`,
    })

    trackEvent("team_member_invited", {
      teamId,
      email: data.email,
      role: data.role,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    throw error
  }
}

// Update a team member's role
export const updateTeamMember = async (
  teamId: string,
  memberId: string,
  data: UpdateTeamMemberDto,
): Promise<TeamMember> => {
  try {
    const member = await apiPut<TeamMember>(`/teams/${teamId}/members/${memberId}`, data)

    toast({
      title: "Member updated",
      description: `The team member's role has been updated to ${data.role}.`,
    })

    trackEvent("team_member_updated", {
      teamId,
      memberId,
      newRole: data.role,
      timestamp: new Date().toISOString(),
    })

    return member
  } catch (error) {
    throw error
  }
}

// Remove a team member
export const removeTeamMember = async (teamId: string, memberId: string): Promise<void> => {
  try {
    await apiDelete(`/teams/${teamId}/members/${memberId}`)

    toast({
      title: "Member removed",
      description: "The team member has been removed successfully.",
    })

    trackEvent("team_member_removed", {
      teamId,
      memberId,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    throw error
  }
}

// Accept a team invitation
export const acceptTeamInvitation = async (invitationId: string): Promise<void> => {
  try {
    await apiPost(`/teams/invitations/${invitationId}/accept`)

    toast({
      title: "Invitation accepted",
      description: "You have successfully joined the team.",
    })

    trackEvent("team_invitation_accepted", {
      invitationId,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    throw error
  }
}

// Decline a team invitation
export const declineTeamInvitation = async (invitationId: string): Promise<void> => {
  try {
    await apiPost(`/teams/invitations/${invitationId}/decline`)

    toast({
      title: "Invitation declined",
      description: "You have declined the team invitation.",
    })

    trackEvent("team_invitation_declined", {
      invitationId,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    throw error
  }
}

// Get pending invitations for the current user
export const getPendingInvitations = async (): Promise<any[]> => {
  return await apiGet<any[]>("/teams/invitations/pending", { cache: true })
}

// Get team activity
export const getTeamActivity = async (teamId: string, limit = 20): Promise<any[]> => {
  return await apiGet<any[]>(`/teams/${teamId}/activity?limit=${limit}`)
}
