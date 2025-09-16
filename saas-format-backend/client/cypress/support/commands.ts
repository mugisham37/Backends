/// <reference types="cypress" />

// Custom command to log in
Cypress.Commands.add("login", (email, password) => {
  // Intercept login request
  cy.intercept("POST", "/api/auth/login").as("loginRequest")

  // Visit login page
  cy.visit("/auth/login")

  // Fill login form
  cy.get('input[name="email"]').type(email)
  cy.get('input[name="password"]').type(password)
  cy.get('button[type="submit"]').click()

  // Wait for login request to complete
  cy.wait("@loginRequest")

  // Check if redirected to dashboard
  cy.url().should("include", "/dashboard")
})

// Custom command to create a project
Cypress.Commands.add("createProject", (name, description) => {
  // Intercept project creation request
  cy.intercept("POST", "/api/projects").as("createProjectRequest")

  // Visit projects page
  cy.visit("/dashboard/projects")

  // Click create project button
  cy.contains("Create Project").click()

  // Fill project form
  cy.get('input[name="name"]').type(name)
  cy.get('textarea[name="description"]').type(description)
  cy.get('button[type="submit"]').click()

  // Wait for project creation request to complete
  cy.wait("@createProjectRequest")

  // Check if redirected to project page
  cy.url().should("include", "/dashboard/projects/")
})

// Custom command to create a task
Cypress.Commands.add("createTask", (projectId, title, description) => {
  // Intercept task creation request
  cy.intercept("POST", `/api/projects/${projectId}/tasks`).as("createTaskRequest")
  
  // Visit project page
  cy.visit(`/dashboard/projects/${projectId}`)
  
  // Click create task button
  cy.contains("Add Task").click()

// Fill task form
