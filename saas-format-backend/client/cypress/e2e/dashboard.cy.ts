describe("Dashboard", () => {
  beforeEach(() => {
    // Log in before each test
    cy.login("test@example.com", "password123")
  })

  it("should display dashboard page", () => {
    cy.visit("/dashboard")
    cy.get("h1").should("contain", "Dashboard")

    // Check if sidebar is visible
    cy.get("nav").should("be.visible")
    cy.get("nav").should("contain", "Projects")
    cy.get("nav").should("contain", "Team")
    cy.get("nav").should("contain", "Analytics")

    // Check if user menu is visible
    cy.get("header").find("button").contains("Test").should("be.visible")
  })

  it("should navigate to projects page", () => {
    cy.visit("/dashboard")
    cy.contains("Projects").click()
    cy.url().should("include", "/dashboard/projects")
    cy.get("h1").should("contain", "Projects")
  })

  it("should navigate to team page", () => {
    cy.visit("/dashboard")
    cy.contains("Team").click()
    cy.url().should("include", "/dashboard/team")
    cy.get("h1").should("contain", "Team")
  })

  it("should navigate to analytics page", () => {
    cy.visit("/dashboard")
    cy.contains("Analytics").click()
    cy.url().should("include", "/dashboard/analytics")
    cy.get("h1").should("contain", "Analytics")
  })

  it("should toggle sidebar", () => {
    cy.visit("/dashboard")

    // Check if sidebar is expanded
    cy.get("nav").should("have.class", "w-64")

    // Toggle sidebar
    cy.get("header").find("button[aria-label='Toggle menu']").click()

    // Check if sidebar is collapsed
    cy.get("nav").should("have.class", "w-[70px]")
  })

  it("should log out", () => {
    cy.visit("/dashboard")

    // Open user menu
    cy.get("header").find("button").contains("Test").click()

    // Click logout
    cy.contains("Log out").click()

    // Check if redirected to login page
    cy.url().should("include", "/auth/login")
  })
})
