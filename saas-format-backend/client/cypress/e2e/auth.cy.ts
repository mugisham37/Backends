describe("Authentication", () => {
  beforeEach(() => {
    // Clear cookies and local storage before each test
    cy.clearCookies()
    cy.clearLocalStorage()
  })

  it("should display login page", () => {
    cy.visit("/auth/login")
    cy.get("h1").should("contain", "Sign In")
    cy.get("form").should("exist")
    cy.get('input[name="email"]').should("exist")
    cy.get('input[name="password"]').should("exist")
    cy.get('button[type="submit"]').should("exist")
  })

  it("should validate login form", () => {
    cy.visit("/auth/login")

    // Submit empty form
    cy.get('button[type="submit"]').click()

    // Check validation messages
    cy.get("form").should("contain", "Email is required")
    cy.get("form").should("contain", "Password is required")

    // Enter invalid email
    cy.get('input[name="email"]').type("invalid-email")
    cy.get('button[type="submit"]').click()
    cy.get("form").should("contain", "Invalid email address")
  })

  it("should handle invalid credentials", () => {
    cy.visit("/auth/login")

    // Enter invalid credentials
    cy.get('input[name="email"]').type("test@example.com")
    cy.get('input[name="password"]').type("wrongpassword")
    cy.get('button[type="submit"]').click()

    // Check error message
    cy.get('[role="alert"]').should("contain", "Invalid credentials")
  })

  it("should navigate to registration page", () => {
    cy.visit("/auth/login")
    cy.contains("Sign up").click()
    cy.url().should("include", "/auth/register")
  })

  it("should navigate to forgot password page", () => {
    cy.visit("/auth/login")
    cy.contains("Forgot password?").click()
    cy.url().should("include", "/auth/forgot-password")
  })

  it("should display registration page", () => {
    cy.visit("/auth/register")
    cy.get("h1").should("contain", "Create an Account")
    cy.get("form").should("exist")
    cy.get('input[name="firstName"]').should("exist")
    cy.get('input[name="lastName"]').should("exist")
    cy.get('input[name="email"]').should("exist")
    cy.get('input[name="password"]').should("exist")
    cy.get('input[name="confirmPassword"]').should("exist")
    cy.get('button[type="submit"]').should("exist")
  })

  it("should validate registration form", () => {
    cy.visit("/auth/register")

    // Submit empty form
    cy.get('button[type="submit"]').click()

    // Check validation messages
    cy.get("form").should("contain", "First name is required")
    cy.get("form").should("contain", "Last name is required")
    cy.get("form").should("contain", "Email is required")
    cy.get("form").should("contain", "Password is required")

    // Enter mismatched passwords
    cy.get('input[name="firstName"]').type("John")
    cy.get('input[name="lastName"]').type("Doe")
    cy.get('input[name="email"]').type("john.doe@example.com")
    cy.get('input[name="password"]').type("password123")
    cy.get('input[name="confirmPassword"]').type("password456")
    cy.get('button[type="submit"]').click()

    // Check validation message
    cy.get("form").should("contain", "Passwords do not match")
  })
})
