"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { AlertCircle, Edit, MoreHorizontal, Plus, RefreshCw, Trash, UserPlus, Users } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import {
  getTeams,
  getTeamById,
  createTeam,
  updateTeam,
  deleteTeam,
  inviteTeamMember,
  updateTeamMember,
  removeTeamMember,
  getTeamActivity,
} from "@/lib/team"
import { useToast } from "@/components/ui/use-toast"
import { useTranslation } from "react-i18next"
import { formatDistanceToNow } from "date-fns"

// Form schemas
const createTeamSchema = z.object({
  name: z
    .string()
    .min(2, "Team name must be at least 2 characters")
    .max(50, "Team name must be less than 50 characters"),
  description: z.string().max(200, "Description must be less than 200 characters").optional(),
})

const inviteMemberSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  role: z.enum(["admin", "member", "guest"], {
    required_error: "Please select a role",
  }),
  message: z.string().max(500, "Message must be less than 500 characters").optional(),
})

export default function TeamManagement() {
  const { t } = useTranslation()
  const router = useRouter()
  const { toast } = useToast()

  const [teams, setTeams] = useState<any[]>([])
  const [selectedTeam, setSelectedTeam] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("members")
  const [isCreatingTeam, setIsCreatingTeam] = useState(false)
  const [isInvitingMember, setIsInvitingMember] = useState(false)
  const [isEditingTeam, setIsEditingTeam] = useState(false)
  const [isDeletingTeam, setIsDeletingTeam] = useState(false)
  const [teamActivity, setTeamActivity] = useState<any[]>([])
  const [activityLoading, setActivityLoading] = useState(false)

  // Create team form
  const createTeamForm = useForm<z.infer<typeof createTeamSchema>>({
    resolver: zodResolver(createTeamSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  })

  // Edit team form
  const editTeamForm = useForm<z.infer<typeof createTeamSchema>>({
    resolver: zodResolver(createTeamSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  })

  // Invite member form
  const inviteMemberForm = useForm<z.infer<typeof inviteMemberSchema>>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: {
      email: "",
      role: "member",
      message: "",
    },
  })

  // Fetch teams on component mount
  useEffect(() => {
    fetchTeams()
  }, [])

  // Fetch team details when selected team changes
  useEffect(() => {
    if (selectedTeam?.id) {
      fetchTeamDetails(selectedTeam.id)
    }
  }, [selectedTeam?.id])

  // Fetch teams
  const fetchTeams = async () => {
    try {
      setLoading(true)
      const data = await getTeams()
      setTeams(data)

      // Select the first team by default if available
      if (data.length > 0 && !selectedTeam) {
        setSelectedTeam(data[0])
      }

      setError(null)
    } catch (err: any) {
      setError(err.message || "Failed to fetch teams")
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch teams. Please try again.",
      })
    } finally {
      setLoading(false)
    }
  }

  // Fetch team details
  const fetchTeamDetails = async (teamId: string) => {
    try {
      const data = await getTeamById(teamId)
      setSelectedTeam(data)

      // Fetch team activity
      fetchTeamActivity(teamId)

      setError(null)
    } catch (err: any) {
      setError(err.message || "Failed to fetch team details")
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch team details. Please try again.",
      })
    }
  }

  // Fetch team activity
  const fetchTeamActivity = async (teamId: string) => {
    try {
      setActivityLoading(true)
      const data = await getTeamActivity(teamId)
      setTeamActivity(data)
    } catch (err: any) {
      console.error("Failed to fetch team activity:", err)
    } finally {
      setActivityLoading(false)
    }
  }

  // Handle create team form submission
  const onCreateTeamSubmit = async (values: z.infer<typeof createTeamSchema>) => {
    try {
      const newTeam = await createTeam(values)
      setTeams([...teams, newTeam])
      setSelectedTeam(newTeam)
      setIsCreatingTeam(false)
      createTeamForm.reset()

      toast({
        title: "Team created",
        description: `Team "${newTeam.name}" has been created successfully.`,
      })
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message || "Failed to create team. Please try again.",
      })
    }
  }

  // Handle edit team form submission
  const onEditTeamSubmit = async (values: z.infer<typeof createTeamSchema>) => {
    if (!selectedTeam) return

    try {
      const updatedTeam = await updateTeam(selectedTeam.id, values)

      // Update teams list
      setTeams(teams.map((team) => (team.id === updatedTeam.id ? updatedTeam : team)))
      setSelectedTeam(updatedTeam)
      setIsEditingTeam(false)

      toast({
        title: "Team updated",
        description: `Team "${updatedTeam.name}" has been updated successfully.`,
      })
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message || "Failed to update team. Please try again.",
      })
    }
  }

  // Handle delete team
  const handleDeleteTeam = async () => {
    if (!selectedTeam) return

    try {
      await deleteTeam(selectedTeam.id)

      // Remove team from list
      setTeams(teams.filter((team) => team.id !== selectedTeam.id))
      setSelectedTeam(teams.length > 1 ? teams.find((team) => team.id !== selectedTeam.id) : null)
      setIsDeletingTeam(false)

      toast({
        title: "Team deleted",
        description: "The team has been deleted successfully.",
      })
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message || "Failed to delete team. Please try again.",
      })
    }
  }

  // Handle invite member form submission
  const onInviteMemberSubmit = async (values: z.infer<typeof inviteMemberSchema>) => {
    if (!selectedTeam) return

    try {
      await inviteTeamMember(selectedTeam.id, values)
      setIsInvitingMember(false)
      inviteMemberForm.reset()

      // Refresh team details to get updated members list
      fetchTeamDetails(selectedTeam.id)

      toast({
        title: "Invitation sent",
        description: `An invitation has been sent to ${values.email}.`,
      })
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message || "Failed to invite member. Please try again.",
      })
    }
  }

  // Handle update member role
  const handleUpdateMemberRole = async (memberId: string, role: "admin" | "member" | "guest") => {
    if (!selectedTeam) return

    try {
      await updateTeamMember(selectedTeam.id, memberId, { role })

      // Refresh team details to get updated members list
      fetchTeamDetails(selectedTeam.id)

      toast({
        title: "Member updated",
        description: `The team member's role has been updated to ${role}.`,
      })
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message || "Failed to update member role. Please try again.",
      })
    }
  }

  // Handle remove member
  const handleRemoveMember = async (memberId: string) => {
    if (!selectedTeam) return

    try {
      await removeTeamMember(selectedTeam.id, memberId)

      // Refresh team details to get updated members list
      fetchTeamDetails(selectedTeam.id)

      toast({
        title: "Member removed",
        description: "The team member has been removed successfully.",
      })
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message || "Failed to remove member. Please try again.",
      })
    }
  }

  // Open edit team dialog
  const openEditTeamDialog = () => {
    if (!selectedTeam) return

    editTeamForm.reset({
      name: selectedTeam.name,
      description: selectedTeam.description || "",
    })

    setIsEditingTeam(true)
  }

  // Get role badge color
  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "owner":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300"
      case "admin":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
      case "member":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
      case "guest":
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
    }
  }

  // Get activity icon
  const getActivityIcon = (type: string) => {
    switch (type) {
      case "member_added":
        return <UserPlus className="h-4 w-4 text-green-500" />
      case "member_removed":
        return <Trash className="h-4 w-4 text-red-500" />
      case "member_role_updated":
        return <Edit className="h-4 w-4 text-blue-500" />
      case "team_updated":
        return <Edit className="h-4 w-4 text-blue-500" />
      default:
        return <RefreshCw className="h-4 w-4" />
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="md:col-span-1">
            <Skeleton className="h-[400px] w-full" />
          </div>
          <div className="md:col-span-3">
            <Skeleton className="h-[400px] w-full" />
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold tracking-tight">{t("Team Management")}</h2>
        <Button onClick={() => setIsCreatingTeam(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t("Create Team")}
        </Button>
      </div>

      {teams.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("No Teams Found")}</CardTitle>
            <CardDescription>{t("Create your first team to get started")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setIsCreatingTeam(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t("Create Team")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Teams List */}
          <div className="md:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>{t("Your Teams")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {teams.map((team) => (
                    <div
                      key={team.id}
                      className={`flex items-center p-2 rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 ${
                        selectedTeam?.id === team.id ? "bg-gray-100 dark:bg-gray-800" : ""
                      }`}
                      onClick={() => setSelectedTeam(team)}
                    >
                      <Avatar className="h-8 w-8 mr-2">
                        <AvatarImage src={team.avatarUrl || "/placeholder.svg"} alt={team.name} />
                        <AvatarFallback>{team.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{team.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {team.members?.length || 0} {t("members")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full" onClick={() => setIsCreatingTeam(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  {t("Create Team")}
                </Button>
              </CardFooter>
            </Card>
          </div>

          {/* Team Details */}
          <div className="md:col-span-3">
            {selectedTeam ? (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div>
                    <CardTitle className="text-xl">{selectedTeam.name}</CardTitle>
                    <CardDescription>{selectedTeam.description}</CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>{t("Team Actions")}</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={openEditTeamDialog}>
                        <Edit className="mr-2 h-4 w-4" />
                        {t("Edit Team")}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setIsInvitingMember(true)}>
                        <UserPlus className="mr-2 h-4 w-4" />
                        {t("Invite Member")}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setIsDeletingTeam(true)}
                        className="text-red-600 dark:text-red-400"
                      >
                        <Trash className="mr-2 h-4 w-4" />
                        {t("Delete Team")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>
                <CardContent>
                  <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="mb-4">
                      <TabsTrigger value="members">
                        <Users className="mr-2 h-4 w-4" />
                        {t("Members")}
                      </TabsTrigger>
                      <TabsTrigger value="activity">
                        <RefreshCw className="mr-2 h-4 w-4" />
                        {t("Activity")}
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="members">
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <h3 className="text-lg font-medium">{t("Team Members")}</h3>
                          <Button size="sm" onClick={() => setIsInvitingMember(true)}>
                            <UserPlus className="mr-2 h-4 w-4" />
                            {t("Invite")}
                          </Button>
                        </div>

                        <div className="space-y-2">
                          {selectedTeam.members?.map((member: any) => (
                            <div key={member.id} className="flex items-center justify-between p-3 border rounded-md">
                              <div className="flex items-center">
                                <Avatar className="h-8 w-8 mr-3">
                                  <AvatarImage
                                    src={member.user.avatarUrl || "/placeholder.svg"}
                                    alt={`${member.user.firstName} ${member.user.lastName}`}
                                  />
                                  <AvatarFallback>
                                    {member.user.firstName?.charAt(0)}
                                    {member.user.lastName?.charAt(0)}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium">
                                    {member.user.firstName} {member.user.lastName}
                                  </p>
                                  <p className="text-sm text-gray-500 dark:text-gray-400">{member.user.email}</p>
                                </div>
                              </div>
                              <div className="flex items-center">
                                <Badge className={`mr-3 ${getRoleBadgeColor(member.role)}`}>
                                  {t(member.role.charAt(0).toUpperCase() + member.role.slice(1))}
                                </Badge>

                                {/* Only show actions if not the owner */}
                                {member.role !== "owner" && (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon">
                                        <MoreHorizontal className="h-4 w-4" />
                                        <span className="sr-only">Actions</span>
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuLabel>{t("Member Actions")}</DropdownMenuLabel>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem onClick={() => handleUpdateMemberRole(member.id, "admin")}>
                                        {t("Set as Admin")}
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleUpdateMemberRole(member.id, "member")}>
                                        {t("Set as Member")}
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleUpdateMemberRole(member.id, "guest")}>
                                        {t("Set as Guest")}
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        onClick={() => handleRemoveMember(member.id)}
                                        className="text-red-600 dark:text-red-400"
                                      >
                                        {t("Remove from Team")}
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="activity">
                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">{t("Recent Activity")}</h3>

                        {activityLoading ? (
                          <div className="space-y-2">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Skeleton key={i} className="h-16 w-full" />
                            ))}
                          </div>
                        ) : teamActivity.length === 0 ? (
                          <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                            {t("No recent activity found")}
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {teamActivity.map((activity) => (
                              <div key={activity.id} className="flex p-3 border rounded-md">
                                <div className="mr-3 mt-0.5">{getActivityIcon(activity.type)}</div>
                                <div className="flex-1">
                                  <p className="text-sm">{activity.description}</p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>{t("No Team Selected")}</CardTitle>
                  <CardDescription>{t("Select a team from the list or create a new one")}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={() => setIsCreatingTeam(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    {t("Create Team")}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Create Team Dialog */}
      <Dialog open={isCreatingTeam} onOpenChange={setIsCreatingTeam}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Create New Team")}</DialogTitle>
            <DialogDescription>{t("Create a new team to collaborate with others")}</DialogDescription>
          </DialogHeader>

          <Form {...createTeamForm}>
            <form onSubmit={createTeamForm.handleSubmit(onCreateTeamSubmit)} className="space-y-4">
              <FormField
                control={createTeamForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("Team Name")}</FormLabel>
                    <FormControl>
                      <Input placeholder={t("Enter team name")} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={createTeamForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("Description")}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t("Enter team description (optional)")}
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormDescription>{t("Briefly describe the purpose of this team")}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreatingTeam(false)}>
                  {t("Cancel")}
                </Button>
                <Button type="submit">{t("Create Team")}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Team Dialog */}
      <Dialog open={isEditingTeam} onOpenChange={setIsEditingTeam}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Edit Team")}</DialogTitle>
            <DialogDescription>{t("Update your team information")}</DialogDescription>
          </DialogHeader>

          <Form {...editTeamForm}>
            <form onSubmit={editTeamForm.handleSubmit(onEditTeamSubmit)} className="space-y-4">
              <FormField
                control={editTeamForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("Team Name")}</FormLabel>
                    <FormControl>
                      <Input placeholder={t("Enter team name")} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editTeamForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("Description")}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t("Enter team description (optional)")}
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormDescription>{t("Briefly describe the purpose of this team")}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditingTeam(false)}>
                  {t("Cancel")}
                </Button>
                <Button type="submit">{t("Save Changes")}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Invite Member Dialog */}
      <Dialog open={isInvitingMember} onOpenChange={setIsInvitingMember}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Invite Team Member")}</DialogTitle>
            <DialogDescription>{t("Invite someone to join your team")}</DialogDescription>
          </DialogHeader>

          <Form {...inviteMemberForm}>
            <form onSubmit={inviteMemberForm.handleSubmit(onInviteMemberSubmit)} className="space-y-4">
              <FormField
                control={inviteMemberForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("Email Address")}</FormLabel>
                    <FormControl>
                      <Input placeholder={t("Enter email address")} type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={inviteMemberForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("Role")}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("Select a role")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="admin">{t("Admin")}</SelectItem>
                        <SelectItem value="member">{t("Member")}</SelectItem>
                        <SelectItem value="guest">{t("Guest")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {field.value === "admin" && t("Can manage team settings and members")}
                      {field.value === "member" && t("Can view and edit team resources")}
                      {field.value === "guest" && t("Can only view team resources")}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={inviteMemberForm.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("Personal Message")}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t("Add a personal message (optional)")}
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsInvitingMember(false)}>
                  {t("Cancel")}
                </Button>
                <Button type="submit">{t("Send Invitation")}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Team Confirmation Dialog */}
      <Dialog open={isDeletingTeam} onOpenChange={setIsDeletingTeam}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Delete Team")}</DialogTitle>
            <DialogDescription>
              {t("Are you sure you want to delete this team? This action cannot be undone.")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{t("Warning")}</AlertTitle>
              <AlertDescription>
                {t("Deleting this team will remove all team data, including projects, tasks, and member associations.")}
              </AlertDescription>
            </Alert>

            <p className="text-sm">
              {t("Please type")} <span className="font-bold">{selectedTeam?.name}</span> {t("to confirm.")}
            </p>

            <Input
              placeholder={t("Type team name to confirm")}
              onChange={(e) => {
                const deleteButton = document.getElementById("confirm-delete-button") as HTMLButtonElement
                if (e.target.value === selectedTeam?.name) {
                  deleteButton.disabled = false
                } else {
                  deleteButton.disabled = true
                }
              }}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsDeletingTeam(false)}>
              {t("Cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              id="confirm-delete-button"
              onClick={handleDeleteTeam}
              disabled={true}
            >
              {t("Delete Team")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
